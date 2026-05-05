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

/**
 * Sanitize search query: limit length and strip control characters
 * @param query Raw search query from user
 * @param maxLength Maximum allowed length (default 500)
 * @returns Sanitized query safe for API calls
 * @throws McpError if query is empty or invalid after sanitization
 */
export function sanitizeSearchQuery(query: string | undefined, maxLength: number = 500): string {
  if (!query || typeof query !== 'string') {
    throw new McpError(ErrorCode.InvalidRequest, 'query is required and must be a string');
  }

  // Strip control characters (0x00-0x1F, 0x7F) and newlines
  let sanitized = query.replace(/[\x00-\x1F\x7F\n\r\t]/g, ' ').trim();

  if (!sanitized) {
    throw new McpError(ErrorCode.InvalidRequest, 'query cannot be empty or contain only control characters');
  }

  // Limit length
  if (sanitized.length > maxLength) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `query exceeds maximum length of ${maxLength} characters (got ${sanitized.length})`
    );
  }

  return sanitized;
}

/**
 * Validate that a Plex API MediaContainer response has expected shape.
 * Throws McpError if validation fails.
 */
export function validatePlexMediaContainer(
  data: unknown,
  expectedFields?: string[]
): { MediaContainer?: { Metadata?: Record<string, unknown>[] } } {
  if (!data || typeof data !== 'object') {
    throw new McpError(ErrorCode.InternalError, 'Invalid Plex response: not an object');
  }

  const obj = data as Record<string, unknown>;
  const container = obj.MediaContainer;

  if (container && typeof container !== 'object') {
    throw new McpError(ErrorCode.InternalError, 'Invalid Plex response: MediaContainer is not an object');
  }

  if (container) {
    const mc = container as Record<string, unknown>;
    if (mc.Metadata && !Array.isArray(mc.Metadata)) {
      throw new McpError(ErrorCode.InternalError, 'Invalid Plex response: Metadata is not an array');
    }

    // Validate expected fields if provided
    if (expectedFields) {
      for (const field of expectedFields) {
        if (!(field in mc)) {
          throw new McpError(ErrorCode.InternalError, `Invalid Plex response: missing field ${field}`);
        }
      }
    }
  }

  return obj as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
}

/**
 * Validate that a Plex API response has expected totalSize field.
 */
export function validatePlexTotalSize(
  data: unknown
): { MediaContainer?: { Metadata?: Record<string, unknown>[]; totalSize?: number } } {
  const validated = validatePlexMediaContainer(data);
  const container = (validated.MediaContainer as Record<string, unknown> | undefined);

  if (container && container.totalSize !== undefined && typeof container.totalSize !== 'number') {
    throw new McpError(ErrorCode.InternalError, 'Invalid Plex response: totalSize is not a number');
  }

  return validated as { MediaContainer?: { Metadata?: Record<string, unknown>[]; totalSize?: number } };
}
