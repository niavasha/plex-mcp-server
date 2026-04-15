/**
 * Plex API constants and configuration defaults
 */

export const PLEX_TYPE_IDS: Record<string, number> = {
  movie: 1,
  show: 2,
  episode: 4,
  artist: 8,
  album: 9,
  track: 10,
};

/**
 * Numeric libtype IDs used inside smart playlist search URIs
 * (e.g. /library/sections/1/all?type=N). This is a superset of PLEX_TYPE_IDS
 * — it includes season/photoalbum/photo which are valid smart-playlist filter
 * targets but are not exposed elsewhere.
 */
export const SMART_PLAYLIST_LIBTYPE_IDS: Record<string, number> = {
  movie: 1,
  show: 2,
  season: 3,
  episode: 4,
  artist: 8,
  album: 9,
  track: 10,
  photoalbum: 13,
  photo: 14,
};

export const DEFAULT_LIMITS = {
  recentlyAdded: 50,
  recentlyWatched: 100,
  watchHistory: 500,
  fullyWatched: 500,
  popularContent: 50,
  libraryItems: 1000,
  searchMedia: 500,
  exportPageSize: 500,
  recommendations: 10,
} as const;

// Recommendation engine constants
export const RECENCY_HALF_LIFE_DAYS = 180;
export const TASTE_TOP_GENRES = 10;
export const TASTE_TOP_DIRECTORS = 10;
export const TASTE_TOP_ACTORS = 20;
export const MIN_WATCHED_FOR_RECOMMENDATIONS = 5;

export const DEFAULT_PLEX_URL = "http://localhost:32400";
export const PLEX_CONTAINER_SIZE = 1000;
export const SUMMARY_PREVIEW_LENGTH = 500;
export const PLEX_MUTATIVE_OPS_ENV_VAR = "PLEX_ENABLE_MUTATIVE_OPS";

/** Standardized completion threshold (90%) — was inconsistent 85%/90% across codebase */
export const COMPLETION_THRESHOLD = 0.90;

export function isMutativeOpsEnabled(): boolean {
  return process.env[PLEX_MUTATIVE_OPS_ENV_VAR] === "true";
}
