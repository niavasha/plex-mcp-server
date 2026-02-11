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

export const DEFAULT_LIMITS = {
  recentlyAdded: 10,
  recentlyWatched: 25,
  watchHistory: 50,
  fullyWatched: 100,
  popularContent: 10,
  libraryItems: 200,
  searchMedia: 50,
  exportPageSize: 500,
} as const;

export const DEFAULT_PLEX_URL = "http://localhost:32400";
export const PLEX_CONTAINER_SIZE = 1000;
export const SUMMARY_PREVIEW_LENGTH = 200;

/** Standardized completion threshold (90%) — was inconsistent 85%/90% across codebase */
export const COMPLETION_THRESHOLD = 0.90;
