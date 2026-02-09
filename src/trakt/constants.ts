/**
 * Trakt API constants and configuration defaults
 */

export const DEFAULT_TRAKT_API_URL = "https://api-v2launch.trakt.tv";
export const TRAKT_OAUTH_URL = "https://api.trakt.tv/oauth/authorize";
export const TRAKT_API_TIMEOUT = 10000;
export const TRAKT_INITIAL_RATE_LIMIT_DELAY = 1000;
export const TRAKT_DEFAULT_RETRY_AFTER = 60;
export const TRAKT_RATE_LIMIT_BACKOFF_MULTIPLIER = 2;
export const TRAKT_BATCH_DELAY_MS = 1000;
export const DEFAULT_BATCH_SIZE = 50;
export const INCREMENTAL_BATCH_SIZE = 25;
export const TRAKT_PREVIEW_LIMIT = 10;

export const ACHIEVEMENT_THRESHOLDS = {
  movies: 100,
  episodes: 1000,
  hours: 100,
} as const;
