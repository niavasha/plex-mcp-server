/**
 * Tool Registry — eliminates switch statements for tool dispatch.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { PlexTools } from "./tools.js";
import { MCPResponse } from "./types.js";
import { DEFAULT_LIMITS } from "./constants.js";

type ToolHandler = (args: Record<string, unknown>) => Promise<MCPResponse>;

export class ToolRegistry {
  private handlers = new Map<string, ToolHandler>();

  register(name: string, handler: ToolHandler): void {
    this.handlers.set(name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  async handle(name: string, args: Record<string, unknown> = {}): Promise<MCPResponse> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return handler(args);
  }
}

/** Pre-registers all Plex tools */
export function createPlexToolRegistry(tools: PlexTools): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register("get_libraries", () => tools.getLibraries());

  registry.register("get_library_items", (args) =>
    tools.getLibraryItems(
      args.libraryKey as string,
      args.type as string | undefined,
      (args.limit as number) || DEFAULT_LIMITS.libraryItems,
      (args.offset as number) || 0,
      args.sort as string | undefined
    )
  );

  registry.register("export_library", (args) =>
    tools.exportLibrary(
      args.libraryKey as string,
      args.type as string | undefined,
      args.outputPath as string | undefined,
      (args.pageSize as number) || DEFAULT_LIMITS.exportPageSize
    )
  );

  registry.register("search_media", (args) =>
    tools.searchMedia(
      args.query as string,
      args.type as string | undefined,
      args.libraryKey as string | undefined,
      (args.limit as number) || DEFAULT_LIMITS.searchMedia,
      (args.offset as number) || 0
    )
  );

  registry.register("get_recently_added", (args) =>
    tools.getRecentlyAdded((args.limit as number) || DEFAULT_LIMITS.recentlyAdded)
  );

  registry.register("get_on_deck", () => tools.getOnDeck());

  registry.register("get_media_details", (args) =>
    tools.getMediaDetails(args.ratingKey as string)
  );

  registry.register("get_editable_fields", (args) =>
    tools.getEditableFields(args.ratingKey as string)
  );

  registry.register("get_playlist_items", (args) =>
    tools.getPlaylistItems(args.playlistId as string)
  );

  registry.register("get_playlists", () => tools.getPlaylists());

  registry.register("get_watchlist", () => tools.getWatchlist());

  registry.register("get_recently_watched", (args) =>
    tools.getRecentlyWatched(
      (args.limit as number) || DEFAULT_LIMITS.recentlyWatched,
      (args.mediaType as string) || "all"
    )
  );

  registry.register("get_watch_history", (args) =>
    tools.getWatchHistory(
      (args.limit as number) || DEFAULT_LIMITS.watchHistory,
      args.userId as string | undefined,
      (args.mediaType as string) || "all"
    )
  );

  registry.register("get_fully_watched", (args) =>
    tools.getFullyWatched(
      args.libraryKey as string | undefined,
      (args.mediaType as string) || "all",
      (args.limit as number) || DEFAULT_LIMITS.fullyWatched
    )
  );

  registry.register("get_watch_stats", (args) =>
    tools.getWatchStats((args.timeRange as number) || 30, (args.statType as string) || "plays")
  );

  registry.register("get_user_stats", (args) =>
    tools.getUserStats((args.timeRange as number) || 30)
  );

  registry.register("get_library_stats", (args) =>
    tools.getLibraryStats(args.libraryKey as string | undefined)
  );

  registry.register("get_popular_content", (args) =>
    tools.getPopularContent(
      (args.timeRange as number) || 30,
      (args.metric as string) || "plays",
      (args.mediaType as string) || "all",
      (args.limit as number) || DEFAULT_LIMITS.popularContent
    )
  );

  return registry;
}
