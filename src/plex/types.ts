/**
 * Shared Plex types used across both servers
 */

export interface PlexConfig {
  baseUrl: string;
  token: string;
}

export interface MCPResponse {
  [key: string]: unknown;
  content: Array<{ type: string; text: string }>;
}

export interface SearchMediaArgs {
  query: string;
  type?: string;
}

export interface GetRecentlyAddedArgs {
  limit?: number;
}

export interface GetMediaDetailsArgs {
  ratingKey: string;
}

export interface GetRecentlyWatchedArgs {
  limit?: number;
  mediaType?: string;
}

export interface GetFullyWatchedArgs {
  libraryKey?: string;
  mediaType?: string;
  limit?: number;
}

export interface GetWatchStatsArgs {
  timeRange?: number;
  statType?: string;
}

export interface GetUserStatsArgs {
  timeRange?: number;
}

export interface GetLibraryStatsArgs {
  libraryKey?: string;
}

export interface GetPopularContentArgs {
  timeRange?: number;
  metric?: string;
  mediaType?: string;
  limit?: number;
}

export interface GetWatchHistoryArgs {
  limit?: number;
  userId?: string;
  mediaType?: string;
}
