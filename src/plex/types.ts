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

