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

export interface LibraryMovieRecord {
  ratingKey: string;
  title: string;
  year: number | undefined;
  viewCount: number;
  lastViewedAt: number | undefined;
  rating: number | undefined;
  genres: string[];
  directors: string[];
  actors: string[];
}

export interface TasteProfile {
  genreScores: Map<string, number>;
  directorCounts: Map<string, number>;
  actorCounts: Map<string, number>;
  weightedAvgRating: number;
  yearMean: number;
  yearStdDev: number;
}

