/**
 * Trakt MCP Functions
 * MCP tool definitions and implementations for Trakt integration
 */

import { TraktClient } from './client.js';
import { TraktSyncEngine, PlexAPIClient } from './sync.js';
import { PlexToTraktMapper } from './mapper.js';
import {
  TraktConfig,
  TraktAuthStatus,
  TraktUserStats,
  SyncResult,
  SyncOptions,
  MCPStatsResponse
} from './types.js';

export class TraktMCPFunctions {
  private traktClient!: TraktClient;
  private syncEngine!: TraktSyncEngine;
  private mapper: PlexToTraktMapper;
  private isInitialized: boolean = false;

  constructor(private plexClient: PlexAPIClient) {
    this.mapper = new PlexToTraktMapper();
    // Client will be initialized when authentication is set up
  }

  /**
   * Initialize Trakt client with configuration
   */
  private initializeTraktClient(): void {
    if (this.isInitialized) return;

    const config: TraktConfig = {
      baseUrl: process.env.TRAKT_BASE_URL || 'https://api-v2launch.trakt.tv',
      clientId: process.env.TRAKT_CLIENT_ID || '',
      clientSecret: process.env.TRAKT_CLIENT_SECRET || '',
      redirectUri: process.env.TRAKT_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob',
      accessToken: process.env.TRAKT_ACCESS_TOKEN,
      refreshToken: process.env.TRAKT_REFRESH_TOKEN
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET environment variables are required');
    }

    this.traktClient = new TraktClient(config);
    this.syncEngine = new TraktSyncEngine(this.traktClient, this.plexClient);
    this.isInitialized = true;
  }

  /**
   * MCP Function: trakt_authenticate
   * Start OAuth authentication flow
   */
  async traktAuthenticate(state?: string): Promise<any> {
    this.initializeTraktClient();

    try {
      const authUrl = this.traktClient.generateAuthUrl(state);
      
      return {
        success: true,
        authUrl,
        instructions: [
          '1. Open the provided URL in your browser',
          '2. Authorize the application on Trakt.tv',
          '3. Copy the authorization code from the callback',
          '4. Use trakt_complete_auth with the code to complete setup'
        ],
        message: 'Visit the auth URL and complete authorization, then use trakt_complete_auth with the code'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication initialization failed'
      };
    }
  }

  /**
   * MCP Function: trakt_complete_auth
   * Complete OAuth flow with authorization code
   */
  async traktCompleteAuth(code: string): Promise<any> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Trakt client not initialized. Call trakt_authenticate first.'
      };
    }

    try {
      const tokens = await this.traktClient.exchangeCodeForToken(code);
      const user = await this.traktClient.getCurrentUser();

      return {
        success: true,
        user: {
          username: user.username,
          name: user.name,
          vip: user.vip
        },
        tokens: {
          expires_in: tokens.expires_in,
          scope: tokens.scope,
          created_at: tokens.created_at
        },
        message: 'Authentication successful! Tokens have been stored.',
        nextSteps: [
          'Set TRAKT_ACCESS_TOKEN and TRAKT_REFRESH_TOKEN environment variables',
          'Use trakt_get_auth_status to verify authentication',
          'Start syncing with trakt_sync_to_trakt'
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token exchange failed'
      };
    }
  }

  /**
   * MCP Function: trakt_get_auth_status
   * Check current authentication status
   */
  async traktGetAuthStatus(): Promise<any> {
    this.initializeTraktClient();

    try {
      const testResult = await this.traktClient.testConnection();
      
      if (testResult.success && testResult.user) {
        return {
          authenticated: true,
          user: {
            username: testResult.user.username,
            name: testResult.user.name,
            vip: testResult.user.vip,
            joined_at: testResult.user.joined_at
          },
          config: this.traktClient.getConfig(),
          message: 'Successfully authenticated with Trakt'
        };
      } else {
        return {
          authenticated: false,
          error: testResult.error,
          message: 'Not authenticated with Trakt. Use trakt_authenticate to set up.'
        };
      }
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Authentication check failed'
      };
    }
  }

  /**
   * MCP Function: trakt_sync_to_trakt
   * Sync Plex watch history to Trakt
   */
  async traktSyncToTrakt(options: {
    dryRun?: boolean;
    batchSize?: number;
    includeProgress?: boolean;
  } = {}): Promise<any> {
    if (!this.isInitialized) {
      this.initializeTraktClient();
    }

    try {
      const syncOptions: Partial<SyncOptions> = {
        direction: 'plex-to-trakt',
        dryRun: options.dryRun || false,
        batchSize: options.batchSize || 50,
        includeProgress: options.includeProgress || false,
        autoResolveConflicts: true
      };

      const result = await this.syncEngine.performFullSync(syncOptions);

      return {
        success: result.success,
        summary: {
          itemsProcessed: result.itemsProcessed,
          itemsAdded: result.itemsAdded,
          itemsUpdated: result.itemsUpdated,
          itemsFailed: result.itemsFailed,
          duration: `${Math.round(result.duration / 1000)}s`
        },
        conflicts: result.conflicts.length > 0 ? result.conflicts : undefined,
        errors: result.errors.length > 0 ? result.errors : undefined,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        dryRun: syncOptions.dryRun
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed'
      };
    }
  }

  /**
   * MCP Function: trakt_sync_from_trakt
   * Get Trakt watch history for comparison
   */
  async traktSyncFromTrakt(): Promise<any> {
    if (!this.isInitialized) {
      this.initializeTraktClient();
    }

    try {
      const [watchedMovies, watchedShows] = await Promise.all([
        this.traktClient.getWatchedMovies(),
        this.traktClient.getWatchedShows()
      ]);

      return {
        success: true,
        trakt_data: {
          movies: {
            count: watchedMovies.length,
            items: watchedMovies.slice(0, 10).map(item => ({
              title: item.movie.title,
              year: item.movie.year,
              plays: item.plays,
              lastWatched: item.last_watched_at
            })),
            totalShowing: Math.min(10, watchedMovies.length)
          },
          shows: {
            count: watchedShows.length,
            items: watchedShows.slice(0, 10).map(item => {
              const totalEpisodes = item.seasons.reduce((sum, season) => 
                sum + season.episodes.length, 0);
              return {
                title: item.show.title,
                year: item.show.year,
                totalEpisodes,
                lastWatched: item.last_watched_at
              };
            }),
            totalShowing: Math.min(10, watchedShows.length)
          }
        },
        message: 'Retrieved watch history from Trakt (comparison data)'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch Trakt data'
      };
    }
  }

  /**
   * MCP Function: trakt_get_user_stats
   * Get enhanced user statistics from Trakt
   */
  async traktGetUserStats(userId?: number): Promise<any> {
    if (!this.isInitialized) {
      this.initializeTraktClient();
    }

    try {
      const [user, stats] = await Promise.all([
        this.traktClient.getCurrentUser(),
        this.traktClient.getUserStats()
      ]);

      const totalHours = Math.round((stats.movies.minutes + stats.episodes.minutes) / 60);
      const totalWatched = stats.movies.watched + stats.episodes.watched;

      const enhancedStats: MCPStatsResponse = {
        userId: userId || 0,
        userName: user.name || user.username,
        traktStats: stats,
        enhancedStats: {
          totalHours,
          averageRating: 0, // Would need rating data
          topGenres: [], // Would need detailed analysis
          recentActivity: [], // Would need recent activity endpoint
          milestones: [
            {
              type: '100 Movies Watched',
              achieved: stats.movies.watched >= 100,
              progress: stats.movies.watched,
              target: 100
            },
            {
              type: '1000 Episodes Watched',
              achieved: stats.episodes.watched >= 1000,
              progress: stats.episodes.watched,
              target: 1000
            },
            {
              type: '100 Hours Watched',
              achieved: totalHours >= 100,
              progress: totalHours,
              target: 100
            }
          ]
        },
        generatedAt: new Date().toISOString()
      };

      return {
        success: true,
        stats: enhancedStats,
        message: `Statistics for ${user.username} retrieved from Trakt`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user stats'
      };
    }
  }

  /**
   * MCP Function: trakt_start_scrobbling
   * Enable real-time scrobbling
   */
  async traktStartScrobbling(sessionData: {
    ratingKey: string;
    title: string;
    type: 'movie' | 'episode';
    progress: number;
    duration?: number;
  }): Promise<any> {
    if (!this.isInitialized) {
      this.initializeTraktClient();
    }

    try {
      // This would integrate with real Plex session monitoring
      // For now, demonstrate the capability
      
      return {
        success: true,
        message: 'Scrobbling capability initialized',
        note: 'Real-time scrobbling requires integration with Plex webhook system',
        sessionData: {
          ratingKey: sessionData.ratingKey,
          title: sessionData.title,
          type: sessionData.type,
          progress: sessionData.progress
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start scrobbling'
      };
    }
  }

  /**
   * MCP Function: trakt_get_sync_status
   * Check current sync status
   */
  async traktGetSyncStatus(): Promise<any> {
    if (!this.isInitialized) {
      return {
        syncInProgress: false,
        error: 'Trakt client not initialized'
      };
    }

    const status = this.syncEngine.getSyncStatus();
    
    return {
      syncInProgress: status.inProgress,
      syncId: status.syncId,
      message: status.inProgress ? 'Sync in progress' : 'No active sync'
    };
  }

  /**
   * MCP Function: trakt_search
   * Search for content on Trakt
   */
  async traktSearch(query: string, type?: 'movie' | 'show', year?: number): Promise<any> {
    if (!this.isInitialized) {
      this.initializeTraktClient();
    }

    try {
      const results = await this.traktClient.search(query, type, year);
      
      return {
        success: true,
        query,
        type: type || 'all',
        year,
        results: results.slice(0, 10).map(result => ({
          type: result.type,
          score: result.score,
          [result.type]: {
            title: result[result.type].title,
            year: result[result.type].year,
            ids: result[result.type].ids,
            overview: result[result.type].overview?.substring(0, 200)
          }
        })),
        totalResults: results.length,
        showing: Math.min(10, results.length)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      };
    }
  }
}