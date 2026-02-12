/**
 * Shared utility functions used across Plex and Trakt modules
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * Validate that a value is a numeric Plex ID (ratingKey, libraryKey, playlistId, etc.)
 * Prevents path traversal and injection when interpolated into API URLs.
 */
export function validatePlexId(value: string | undefined, paramName: string): string {
  if (!value || !/^\d+$/.test(value)) {
    throw new McpError(ErrorCode.InvalidRequest, `${paramName} must be a numeric Plex ID`);
  }
  return value;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen) + "...";
}
