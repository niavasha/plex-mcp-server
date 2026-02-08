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
} as const;

/** Standardized completion threshold (90%) — was inconsistent 85%/90% across codebase */
export const COMPLETION_THRESHOLD = 0.90;
