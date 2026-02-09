/**
 * MCP tool schema definitions for Trakt tools.
 * Mirrors the pattern from plex/tool-schemas.ts.
 */

export const TRAKT_TOOL_SCHEMAS = [
  {
    name: "trakt_authenticate",
    description: "Start Trakt.tv OAuth authentication process",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "Optional state parameter for OAuth flow" },
      },
    },
  },
  {
    name: "trakt_complete_auth",
    description: "Complete Trakt.tv authentication with authorization code",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Authorization code from Trakt OAuth callback" },
      },
      required: ["code"],
    },
  },
  {
    name: "trakt_get_auth_status",
    description: "Check Trakt.tv authentication status",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_sync_to_trakt",
    description: "Sync Plex watch history to Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        dryRun: { type: "boolean", description: "Preview sync without making changes", default: false },
        batchSize: { type: "number", description: "Number of items to sync per batch", default: 50 },
        includeProgress: { type: "boolean", description: "Include watch progress information", default: false },
      },
    },
  },
  {
    name: "trakt_sync_from_trakt",
    description: "Get watch history from Trakt.tv for comparison",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_get_user_stats",
    description: "Get enhanced viewing statistics from Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "number", description: "Optional Plex user ID for correlation" },
      },
    },
  },
  {
    name: "trakt_start_scrobbling",
    description: "Enable real-time scrobbling to Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        ratingKey: { type: "string", description: "Plex media rating key" },
        title: { type: "string", description: "Media title" },
        type: { type: "string", enum: ["movie", "episode"], description: "Media type" },
        progress: { type: "number", description: "Current progress percentage (0-100)" },
        duration: { type: "number", description: "Total duration in milliseconds" },
      },
      required: ["ratingKey", "title", "type", "progress"],
    },
  },
  {
    name: "trakt_get_sync_status",
    description: "Check status of ongoing sync operations",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_search",
    description: "Search for movies and shows on Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        type: { type: "string", enum: ["movie", "show"], description: "Optional media type filter" },
        year: { type: "number", description: "Optional year filter" },
      },
      required: ["query"],
    },
  },
];
