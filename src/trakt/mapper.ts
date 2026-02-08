/**
 * Data Mapping Layer between Plex and Trakt formats
 * Converts Plex API responses to Trakt API format and vice versa
 */

import {
  TraktMovie,
  TraktShow,
  TraktEpisode,
  TraktScrobbleItem,
  TraktSyncRequest,
  TraktIds
} from './types.js';

// Plex data types (simplified versions of what we get from Plex API)
export interface PlexMovie {
  ratingKey: string;
  title: string;
  year?: number;
  guid?: string;
  imdbId?: string;
  tmdbId?: string;
  duration?: number;
  viewCount?: number;
  lastViewedAt?: number;
  addedAt?: number;
  updatedAt?: number;
  genres?: string[];
  summary?: string;
}

export interface PlexShow {
  ratingKey: string;
  title: string;
  year?: number;
  guid?: string;
  imdbId?: string;
  tvdbId?: number;
  tmdbId?: number;
  summary?: string;
  genres?: string[];
  network?: string;
  contentRating?: string;
}

export interface PlexEpisode {
  ratingKey: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  duration?: number;
  viewCount?: number;
  lastViewedAt?: number;
  guid?: string;
  imdbId?: string;
  tvdbId?: number;
  tmdbId?: number;
  show?: PlexShow;
}

export interface PlexWatchSession {
  ratingKey: string;
  title: string;
  type: 'movie' | 'episode';
  viewOffset?: number;
  duration?: number;
  progress?: number;
  sessionKey?: string;
  userId?: number;
  userName?: string;
  state?: 'playing' | 'paused' | 'stopped';
  // For episodes
  seasonNumber?: number;
  episodeNumber?: number;
  show?: PlexShow;
  // For movies
  movie?: PlexMovie;
}

export class PlexToTraktMapper {
  
  /**
   * Extract external IDs from Plex GUID
   * Plex GUIDs look like: com.plexapp.agents.imdb://tt1234567?lang=en
   */
  private extractIdsFromGuid(guid?: string): Partial<TraktIds> {
    const ids: Partial<TraktIds> = {};
    
    if (!guid) return ids;

    // IMDB ID extraction
    const imdbMatch = guid.match(/imdb:\/\/tt(\d+)/);
    if (imdbMatch) {
      ids.imdb = `tt${imdbMatch[1]}`;
    }

    // TMDB ID extraction  
    const tmdbMatch = guid.match(/themoviedb:\/\/(\d+)/);
    if (tmdbMatch) {
      ids.tmdb = parseInt(tmdbMatch[1]);
    }

    // TVDB ID extraction
    const tvdbMatch = guid.match(/thetvdb:\/\/(\d+)/);
    if (tvdbMatch) {
      ids.tvdb = parseInt(tvdbMatch[1]);
    }

    return ids;
  }

  /**
   * Extract IDs from multiple Plex fields
   */
  private extractAllIds(plexItem: PlexMovie | PlexShow | PlexEpisode): Partial<TraktIds> {
    const ids: Partial<TraktIds> = {};

    // From GUID field
    const guidIds = this.extractIdsFromGuid(plexItem.guid);
    Object.assign(ids, guidIds);

    // From explicit ID fields (if available)
    if ('imdbId' in plexItem && plexItem.imdbId) {
      ids.imdb = plexItem.imdbId;
    }
    if ('tmdbId' in plexItem && plexItem.tmdbId) {
      ids.tmdb = typeof plexItem.tmdbId === 'string' ? parseInt(plexItem.tmdbId) : plexItem.tmdbId;
    }
    if ('tvdbId' in plexItem && plexItem.tvdbId) {
      ids.tvdb = plexItem.tvdbId;
    }

    return ids;
  }

  /**
   * Convert Plex movie to Trakt format
   */
  mapPlexMovieToTrakt(plexMovie: PlexMovie): TraktMovie {
    const ids = this.extractAllIds(plexMovie);
    
    return {
      title: plexMovie.title,
      year: plexMovie.year || 0,
      ids: {
        trakt: 0, // Will be resolved by Trakt
        slug: '', // Will be resolved by Trakt
        ...ids
      },
      overview: plexMovie.summary,
      runtime: plexMovie.duration ? Math.round(plexMovie.duration / 60000) : undefined,
      genres: plexMovie.genres
    };
  }

  /**
   * Convert Plex show to Trakt format
   */
  mapPlexShowToTrakt(plexShow: PlexShow): TraktShow {
    const ids = this.extractAllIds(plexShow);

    return {
      title: plexShow.title,
      year: plexShow.year || 0,
      ids: {
        trakt: 0, // Will be resolved by Trakt
        slug: '', // Will be resolved by Trakt
        ...ids
      },
      overview: plexShow.summary,
      network: plexShow.network,
      certification: plexShow.contentRating,
      genres: plexShow.genres
    };
  }

  /**
   * Convert Plex episode to Trakt format
   */
  mapPlexEpisodeToTrakt(plexEpisode: PlexEpisode): { show: TraktShow; episode: TraktEpisode } {
    const show = plexEpisode.show ? this.mapPlexShowToTrakt(plexEpisode.show) : {
      title: 'Unknown Show',
      year: 0,
      ids: { trakt: 0, slug: '' }
    };

    const episodeIds = this.extractAllIds(plexEpisode);

    const episode: TraktEpisode = {
      season: plexEpisode.seasonNumber,
      number: plexEpisode.episodeNumber,
      title: plexEpisode.title,
      ids: {
        trakt: 0, // Will be resolved by Trakt
        slug: '', // Will be resolved by Trakt
        ...episodeIds
      },
      runtime: plexEpisode.duration ? Math.round(plexEpisode.duration / 60000) : undefined
    };

    return { show, episode };
  }

  /**
   * Convert Plex watch session to Trakt scrobble format
   */
  mapPlexWatchSessionToScrobble(session: PlexWatchSession): TraktScrobbleItem {
    const progress = session.progress || 0;
    
    const scrobbleItem: TraktScrobbleItem = {
      progress,
      app_version: '1.0',
      app_date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    };

    if (session.type === 'movie' && session.movie) {
      scrobbleItem.movie = this.mapPlexMovieToTrakt(session.movie);
    } else if (session.type === 'episode' && session.show) {
      const episodeData = this.mapPlexEpisodeToTrakt({
        ratingKey: session.ratingKey,
        title: session.title,
        seasonNumber: session.seasonNumber || 1,
        episodeNumber: session.episodeNumber || 1,
        duration: session.duration,
        viewCount: 1,
        lastViewedAt: Date.now() / 1000,
        show: session.show
      });
      
      scrobbleItem.show = episodeData.show;
      scrobbleItem.episode = episodeData.episode;
    }

    return scrobbleItem;
  }

  /**
   * Convert Plex movies to Trakt sync format
   */
  mapPlexMoviesForSync(plexMovies: PlexMovie[]): TraktSyncRequest['movies'] {
    return plexMovies.map(movie => ({
      watched_at: movie.lastViewedAt ? new Date(movie.lastViewedAt * 1000).toISOString() : undefined,
      ids: this.extractAllIds(movie),
      title: movie.title,
      year: movie.year
    }));
  }

  /**
   * Convert Plex episodes to Trakt sync format
   */
  mapPlexEpisodesForSync(plexEpisodes: PlexEpisode[]): TraktSyncRequest['shows'] {
    // Group episodes by show
    const showsMap = new Map<string, {
      show: PlexShow;
      episodes: PlexEpisode[];
    }>();

    plexEpisodes.forEach(episode => {
      if (!episode.show) return;
      
      const showKey = episode.show.ratingKey;
      if (!showsMap.has(showKey)) {
        showsMap.set(showKey, {
          show: episode.show,
          episodes: []
        });
      }
      showsMap.get(showKey)!.episodes.push(episode);
    });

    // Convert to Trakt format
    return Array.from(showsMap.values()).map(({ show, episodes }) => {
      // Group episodes by season
      const seasonMap = new Map<number, PlexEpisode[]>();
      episodes.forEach(ep => {
        const season = ep.seasonNumber;
        if (!seasonMap.has(season)) {
          seasonMap.set(season, []);
        }
        seasonMap.get(season)!.push(ep);
      });

      return {
        watched_at: undefined, // Will be set per episode
        ids: this.extractAllIds(show),
        title: show.title,
        year: show.year,
        seasons: Array.from(seasonMap.entries()).map(([seasonNumber, seasonEpisodes]) => ({
          number: seasonNumber,
          episodes: seasonEpisodes.map(ep => ({
            number: ep.episodeNumber,
            watched_at: ep.lastViewedAt ? new Date(ep.lastViewedAt * 1000).toISOString() : undefined
          }))
        }))
      };
    });
  }

  /**
   * Validate that a Plex item has enough data for Trakt sync
   */
  validatePlexItemForSync(item: PlexMovie | PlexShow | PlexEpisode): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!item.title) {
      errors.push('Missing title');
    }

    const ids = this.extractAllIds(item);
    if (!ids.imdb && !ids.tmdb && !ids.tvdb) {
      errors.push('No external IDs found (IMDB, TMDB, or TVDB required)');
    }

    if ('year' in item && !item.year) {
      errors.push('Missing year');
    }

    if ('seasonNumber' in item && (!item.seasonNumber || !item.episodeNumber)) {
      errors.push('Missing season or episode number');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean and prepare Trakt IDs object
   */
  cleanTraktIds(ids: Partial<TraktIds>): Partial<TraktIds> {
    const cleaned: Partial<TraktIds> = {};

    if (ids.imdb && ids.imdb.startsWith('tt')) {
      cleaned.imdb = ids.imdb;
    }
    if (ids.tmdb && ids.tmdb > 0) {
      cleaned.tmdb = ids.tmdb;
    }
    if (ids.tvdb && ids.tvdb > 0) {
      cleaned.tvdb = ids.tvdb;
    }

    return cleaned;
  }

}