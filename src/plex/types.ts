/**
 * Shared Plex types used across both servers
 */

export interface PlexConfig {
  baseUrl: string;
  token: string;
  clientIdentifier?: string;
}

/** An MCP resource_link block: points at a resource the client fetches with resources/read. */
export interface ResourceLinkContent {
  type: "resource_link";
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  description?: string;
}

export interface MCPResponse {
  [key: string]: unknown;
  content: Array<{ type: string; text: string }>;
  /** Appended to `content` by the server when the response goes on the wire. */
  resourceLinks?: ResourceLinkContent[];
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

