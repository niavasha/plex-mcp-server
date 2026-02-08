/**
 * Trakt Sync Engine
 * Handles bidirectional synchronization between Plex and Trakt
 */

import { TraktClient } from './client.js';
import { PlexToTraktMapper, PlexMovie, PlexEpisode, PlexWatchSession } from './mapper.js';
import {
  SyncResult,
  SyncOptions,
  SyncConflict,
  ConflictResolution,
  TraktSyncResult,
  TraktWatchedMovie,
  TraktWatchedShow,
  TraktScrobbleResponse
} from './types.js';

export interface PlexAPIClient {
  // Methods we need from the Plex client to perform sync
  getWatchedMovies(userId?: number): Promise<PlexMovie[]>;
  getWatchedEpisodes(userId?: number): Promise<PlexEpisode[]>;
  getCurrentSessions(): Promise<PlexWatchSession[]>;
  markAsWatched(ratingKey: string, userId?: number): Promise<void>;
  updateProgress(ratingKey: string, progress: number, userId?: number): Promise<void>;
}

export class TraktSyncEngine {
  private traktClient: TraktClient;
  private plexClient: PlexAPIClient;
  private mapper: PlexToTraktMapper;
  private syncInProgress: boolean = false;
  private currentSyncId: string | null = null;

  constructor(traktClient: TraktClient, plexClient: PlexAPIClient) {
    this.traktClient = traktClient;
    this.plexClient = plexClient;
    this.mapper = new PlexToTraktMapper();
  }

  /**
   * Perform a full sync between Plex and Trakt
   */
  async performFullSync(options: Partial<SyncOptions> = {}): Promise<SyncResult> {
    const syncOptions: SyncOptions = {
      direction: 'plex-to-trakt',
      dryRun: false,
      autoResolveConflicts: true,
      includeProgress: false,
      syncRatings: false,
      batchSize: 50,
      ...options
    };

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    this.currentSyncId = `sync_${Date.now()}`;
    
    const startTime = new Date();
    let result: SyncResult = {
      success: false,
      itemsProcessed: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsFailed: 0,
      conflicts: [],
      errors: [],
      startTime,
      endTime: new Date(),
      duration: 0
    };

    try {
      console.log(`Starting full sync (${syncOptions.direction}, dry-run: ${syncOptions.dryRun})`);

      if (syncOptions.direction === 'plex-to-trakt' || syncOptions.direction === 'bidirectional') {
        const plexToTraktResult = await this.syncPlexToTrakt(syncOptions);
        this.mergeResults(result, plexToTraktResult);
      }

      if (syncOptions.direction === 'trakt-to-plex' || syncOptions.direction === 'bidirectional') {
        const traktToPlexResult = await this.syncTraktToPlex(syncOptions);
        this.mergeResults(result, traktToPlexResult);
      }

      result.success = result.errors.length === 0 || result.itemsProcessed > 0;
      console.log(`Sync completed: ${result.itemsProcessed} processed, ${result.itemsAdded} added, ${result.errors.length} errors`);

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      console.error('Sync failed:', error);
    } finally {
      result.endTime = new Date();
      result.duration = result.endTime.getTime() - result.startTime.getTime();
      this.syncInProgress = false;
      this.currentSyncId = null;
    }

    return result;
  }

  /**
   * Sync Plex watch history to Trakt
   */
  private async syncPlexToTrakt(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = this.createEmptyResult();
    
    try {
      // Get Plex watched movies
      console.log('Fetching Plex watched movies...');
      const plexMovies = await this.plexClient.getWatchedMovies();
      console.log(`Found ${plexMovies.length} watched movies in Plex`);

      // Validate and convert movies
      const validMovies = plexMovies.filter(movie => {
        const validation = this.mapper.validatePlexItemForSync(movie);
        if (!validation.valid) {
          result.errors.push(`Movie "${movie.title}": ${validation.errors.join(', ')}`);
          result.itemsFailed++;
          return false;
        }
        return true;
      });

      // Sync movies in batches
      if (validMovies.length > 0 && !options.dryRun) {
        const movieBatches = this.chunkArray(validMovies, options.batchSize);
        for (const batch of movieBatches) {
          try {
            const traktMovies = this.mapper.mapPlexMoviesForSync(batch);
            const syncResult = await this.traktClient.syncWatchedMovies(traktMovies);
            
            result.itemsProcessed += batch.length;
            result.itemsAdded += syncResult.added.movies;
            
            console.log(`Synced batch of ${batch.length} movies: ${syncResult.added.movies} added, ${syncResult.existing.movies} existing`);
            
            // Handle not found items
            if (syncResult.not_found.movies.length > 0) {
              syncResult.not_found.movies.forEach(movie => {
                result.errors.push(`Movie not found on Trakt: ${movie.title} (${movie.year})`);
                result.itemsFailed++;
              });
            }
          } catch (error) {
            result.errors.push(`Failed to sync movie batch: ${error}`);
            result.itemsFailed += batch.length;
          }

          // Small delay between batches to respect rate limits
          await this.sleep(1000);
        }
      }

      // Get Plex watched episodes
      console.log('Fetching Plex watched episodes...');
      const plexEpisodes = await this.plexClient.getWatchedEpisodes();
      console.log(`Found ${plexEpisodes.length} watched episodes in Plex`);

      // Validate and convert episodes
      const validEpisodes = plexEpisodes.filter(episode => {
        const validation = this.mapper.validatePlexItemForSync(episode);
        if (!validation.valid) {
          result.errors.push(`Episode "${episode.title}": ${validation.errors.join(', ')}`);
          result.itemsFailed++;
          return false;
        }
        return true;
      });

      // Sync episodes
      if (validEpisodes.length > 0 && !options.dryRun) {
        try {
          const traktShows = this.mapper.mapPlexEpisodesForSync(validEpisodes);
          const syncResult = await this.traktClient.syncWatchedShows(traktShows);
          
          result.itemsProcessed += validEpisodes.length;
          result.itemsAdded += syncResult.added.episodes;
          
          console.log(`Synced ${validEpisodes.length} episodes: ${syncResult.added.episodes} added, ${syncResult.existing.episodes} existing`);
          
          // Handle not found items
          if (syncResult.not_found.episodes.length > 0) {
            syncResult.not_found.episodes.forEach(episode => {
              result.errors.push(`Episode not found on Trakt: ${episode.title}`);
              result.itemsFailed++;
            });
          }
        } catch (error) {
          result.errors.push(`Failed to sync episodes: ${error}`);
          result.itemsFailed += validEpisodes.length;
        }
      }

      if (options.dryRun) {
        console.log(`Dry run complete: ${validMovies.length} movies and ${validEpisodes.length} episodes would be synced`);
        result.itemsProcessed = validMovies.length + validEpisodes.length;
      }

    } catch (error) {
      result.errors.push(`Plex to Trakt sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Sync Trakt watch history to Plex (read-only comparison for now)
   */
  private async syncTraktToPlex(options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = this.createEmptyResult();

    try {
      console.log('Fetching Trakt watched movies...');
      const traktMovies = await this.traktClient.getWatchedMovies();
      console.log(`Found ${traktMovies.length} watched movies on Trakt`);

      console.log('Fetching Trakt watched shows...');
      const traktShows = await this.traktClient.getWatchedShows();
      console.log(`Found ${traktShows.length} watched shows on Trakt`);

      // For now, just report what we found - full bidirectional sync would require
      // more complex matching and Plex write operations
      result.itemsProcessed = traktMovies.length + traktShows.length;
      
      if (options.dryRun) {
        console.log('Trakt to Plex sync (read-only): comparison completed');
      } else {
        result.errors.push('Trakt to Plex sync not yet implemented - use for comparison only');
      }

    } catch (error) {
      result.errors.push(`Trakt to Plex sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Perform incremental sync for recent changes
   */
  async performIncrementalSync(since: Date, options: Partial<SyncOptions> = {}): Promise<SyncResult> {
    console.log(`Starting incremental sync since ${since.toISOString()}`);
    
    // For now, just perform a full sync - a real implementation would
    // filter items by lastViewedAt/updatedAt timestamps
    return this.performFullSync({
      ...options,
      batchSize: 25 // Smaller batches for incremental
    });
  }

  /**
   * Start real-time scrobbling session
   */
  async startScrobbleSession(plexSession: PlexWatchSession): Promise<TraktScrobbleResponse | null> {
    if (!plexSession.duration) {
      console.warn('Cannot scrobble session without duration');
      return null;
    }

    try {
      const scrobbleItem = this.mapper.mapPlexWatchSessionToScrobble(plexSession);
      const response = await this.traktClient.scrobbleStart(scrobbleItem);
      
      console.log(`Started scrobbling: ${plexSession.title} (${response.progress}%)`);
      return response;
    } catch (error) {
      console.error(`Failed to start scrobbling: ${error}`);
      return null;
    }
  }

  /**
   * Update scrobble progress
   */
  async updateScrobbleProgress(plexSession: PlexWatchSession): Promise<TraktScrobbleResponse | null> {
    if (!plexSession.duration || !plexSession.viewOffset) {
      return null;
    }

    try {
      const scrobbleItem = this.mapper.mapPlexWatchSessionToScrobble(plexSession);
      const response = plexSession.state === 'paused' 
        ? await this.traktClient.scrobblePause(scrobbleItem)
        : await this.traktClient.scrobbleStart(scrobbleItem); // Continue watching
      
      console.log(`Updated scrobble progress: ${plexSession.title} (${response.progress}%)`);
      return response;
    } catch (error) {
      console.error(`Failed to update scrobble progress: ${error}`);
      return null;
    }
  }

  /**
   * End scrobble session
   */
  async endScrobbleSession(plexSession: PlexWatchSession): Promise<TraktScrobbleResponse | null> {
    if (!plexSession.duration) {
      return null;
    }

    try {
      const scrobbleItem = this.mapper.mapPlexWatchSessionToScrobble(plexSession);
      const response = await this.traktClient.scrobbleStop(scrobbleItem);
      
      console.log(`Ended scrobbling: ${plexSession.title} (${response.progress}%)`);
      return response;
    } catch (error) {
      console.error(`Failed to end scrobbling: ${error}`);
      return null;
    }
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): { inProgress: boolean; syncId: string | null; startedAt?: Date } {
    return {
      inProgress: this.syncInProgress,
      syncId: this.currentSyncId
    };
  }

  /**
   * Helper methods
   */
  private createEmptyResult(): SyncResult {
    return {
      success: false,
      itemsProcessed: 0,
      itemsAdded: 0,
      itemsUpdated: 0,
      itemsFailed: 0,
      conflicts: [],
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
      duration: 0
    };
  }

  private mergeResults(target: SyncResult, source: SyncResult): void {
    target.itemsProcessed += source.itemsProcessed;
    target.itemsAdded += source.itemsAdded;
    target.itemsUpdated += source.itemsUpdated;
    target.itemsFailed += source.itemsFailed;
    target.conflicts.push(...source.conflicts);
    target.errors.push(...source.errors);
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}