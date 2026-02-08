/**
 * Plex module barrel exports
 */

export { PlexClient } from "./client.js";
export { PlexTools } from "./tools.js";
export { ToolRegistry, createPlexToolRegistry } from "./tool-registry.js";
export { PLEX_TOOL_SCHEMAS, PLEX_CORE_TOOL_SCHEMAS, PLEX_EXTENDED_TOOL_SCHEMAS } from "./tool-schemas.js";
export { PLEX_TYPE_IDS, DEFAULT_LIMITS, COMPLETION_THRESHOLD } from "./constants.js";
export type { PlexConfig, MCPResponse, SearchMediaArgs, GetRecentlyAddedArgs, GetMediaDetailsArgs, GetRecentlyWatchedArgs, GetFullyWatchedArgs, GetWatchStatsArgs, GetUserStatsArgs, GetLibraryStatsArgs, GetPopularContentArgs, GetWatchHistoryArgs } from "./types.js";
