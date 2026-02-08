/**
 * Trakt.tv API Type Definitions
 * Based on Trakt API v2 specification
 */

// Authentication Types
export interface TraktConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface TraktTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  created_at: number;
}

export interface TraktAuthStatus {
  authenticated: boolean;
  user?: TraktUser;
  expiresAt?: number;
  scopes?: string[];
}

// User Types
export interface TraktUser {
  username: string;
  private: boolean;
  name: string;
  vip: boolean;
  vip_ep: boolean;
  ids: {
    slug: string;
  };
  joined_at: string;
  location?: string;
  about?: string;
  gender?: string;
  age?: number;
  images: {
    avatar: {
      full: string;
    };
  };
}

// Media Types
export interface TraktIds {
  trakt: number;
  slug: string;
  imdb?: string;
  tmdb?: number;
  tvdb?: number;
}

export interface TraktMovie {
  title: string;
  year: number;
  ids: TraktIds;
  overview?: string;
  rating?: number;
  votes?: number;
  runtime?: number;
  genres?: string[];
  certification?: string;
  released?: string;
  updated_at?: string;
  trailer?: string;
  homepage?: string;
  language?: string;
  available_translations?: string[];
}

export interface TraktShow {
  title: string;
  year: number;
  ids: TraktIds;
  overview?: string;
  first_aired?: string;
  airs?: {
    day: string;
    time: string;
    timezone: string;
  };
  runtime?: number;
  certification?: string;
  network?: string;
  country?: string;
  trailer?: string;
  homepage?: string;
  status?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  aired_episodes?: number;
  language?: string;
  available_translations?: string[];
}

export interface TraktSeason {
  number: number;
  ids: TraktIds;
  episodes?: TraktEpisode[];
  episode_count?: number;
  aired_episodes?: number;
  title?: string;
  overview?: string;
  rating?: number;
  votes?: number;
  first_aired?: string;
  updated_at?: string;
  available_translations?: string[];
}

export interface TraktEpisode {
  season: number;
  number: number;
  title: string;
  ids: TraktIds;
  overview?: string;
  rating?: number;
  votes?: number;
  runtime?: number;
  first_aired?: string;
  updated_at?: string;
  available_translations?: string[];
}

// Watch/Sync Types
export interface TraktWatchedItem {
  last_watched_at: string;
  last_updated_at: string;
  plays: number;
  reset_at?: string;
}

export interface TraktWatchedMovie extends TraktWatchedItem {
  movie: TraktMovie;
}

export interface TraktWatchedShow extends TraktWatchedItem {
  show: TraktShow;
  seasons: Array<{
    number: number;
    episodes: Array<{
      number: number;
      plays: number;
      last_watched_at: string;
    }>;
  }>;
}

// Scrobble Types
export interface TraktScrobbleItem {
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
  progress: number;
  app_version: string;
  app_date: string;
}

export interface TraktScrobbleResponse {
  id: number;
  action: 'start' | 'pause' | 'stop';
  progress: number;
  sharing: {
    facebook: boolean;
    twitter: boolean;
    tumblr: boolean;
  };
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
}

// Sync Types
export interface TraktSyncRequest {
  movies?: Array<{
    watched_at?: string;
    ids: Partial<TraktIds>;
    title?: string;
    year?: number;
  }>;
  shows?: Array<{
    watched_at?: string;
    ids: Partial<TraktIds>;
    title?: string;
    year?: number;
    seasons?: Array<{
      number: number;
      episodes?: Array<{
        number: number;
        watched_at?: string;
      }>;
    }>;
  }>;
  episodes?: Array<{
    watched_at?: string;
    ids: Partial<TraktIds>;
    title?: string;
    season?: number;
    number?: number;
  }>;
}

export interface TraktSyncResult {
  added: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  existing: {
    movies: number;
    shows: number;
    seasons: number;
    episodes: number;
  };
  not_found: {
    movies: Array<{
      ids: Partial<TraktIds>;
      title?: string;
      year?: number;
    }>;
    shows: Array<{
      ids: Partial<TraktIds>;
      title?: string;
      year?: number;
    }>;
    seasons: Array<{
      ids: Partial<TraktIds>;
      title?: string;
      year?: number;
    }>;
    episodes: Array<{
      ids: Partial<TraktIds>;
      title?: string;
      season?: number;
      number?: number;
    }>;
  };
}

// Statistics Types
export interface TraktUserStats {
  movies: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  shows: {
    watched: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  seasons: {
    ratings: number;
    comments: number;
  };
  episodes: {
    plays: number;
    watched: number;
    minutes: number;
    collected: number;
    ratings: number;
    comments: number;
  };
  network: {
    friends: number;
    followers: number;
    following: number;
  };
  ratings: {
    total: number;
    distribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
      6: number;
      7: number;
      8: number;
      9: number;
      10: number;
    };
  };
}

// Progress Types
export interface TraktProgress {
  progress: number;
  movie?: TraktMovie;
  show?: TraktShow;
  episode?: TraktEpisode;
  paused_at: string;
  id: number;
}

// Error Types
export interface TraktAPIError {
  error: string;
  error_description: string;
}

export interface TraktRateLimitError {
  message: string;
  code: number;
  retry_after: number;
}

// Sync Engine Types
export interface SyncConflict {
  type: 'watch_date' | 'play_count' | 'progress';
  plexData: any;
  traktData: any;
  mediaId: string;
  mediaTitle: string;
}

export interface ConflictResolution {
  conflictId: string;
  resolution: 'plex_wins' | 'trakt_wins' | 'merge' | 'skip';
  resolvedValue?: any;
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  itemsAdded: number;
  itemsUpdated: number;
  itemsFailed: number;
  conflicts: SyncConflict[];
  errors: string[];
  startTime: Date;
  endTime: Date;
  duration: number;
}

export interface SyncOptions {
  direction: 'plex-to-trakt' | 'trakt-to-plex' | 'bidirectional';
  dryRun: boolean;
  autoResolveConflicts: boolean;
  includeProgress: boolean;
  syncRatings: boolean;
  batchSize: number;
}

// MCP Response Types
export interface MCPStatsResponse {
  userId: number;
  userName: string;
  traktStats: TraktUserStats;
  enhancedStats: {
    totalHours: number;
    averageRating: number;
    topGenres: Array<{ genre: string; count: number }>;
    recentActivity: Array<{
      title: string;
      type: string;
      watchedAt: string;
    }>;
    milestones: Array<{
      type: string;
      achieved: boolean;
      progress: number;
      target: number;
    }>;
  };
  generatedAt: string;
}