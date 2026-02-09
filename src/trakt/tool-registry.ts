/**
 * Trakt Tool Registry — eliminates switch statement for Trakt tool dispatch.
 * Reuses ToolRegistry class from plex/tool-registry.ts.
 */

import { ToolRegistry } from "../plex/tool-registry.js";
import { TraktMCPFunctions } from "./mcp-functions.js";

export function createTraktToolRegistry(traktFunctions: TraktMCPFunctions): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register("trakt_authenticate", (args) =>
    traktFunctions.traktAuthenticate(args.state as string | undefined).then(wrapResponse)
  );

  registry.register("trakt_complete_auth", (args) =>
    traktFunctions.traktCompleteAuth(args.code as string).then(wrapResponse)
  );

  registry.register("trakt_get_auth_status", () =>
    traktFunctions.traktGetAuthStatus().then(wrapResponse)
  );

  registry.register("trakt_sync_to_trakt", (args) =>
    traktFunctions.traktSyncToTrakt({
      dryRun: args.dryRun as boolean | undefined,
      batchSize: args.batchSize as number | undefined,
      includeProgress: args.includeProgress as boolean | undefined,
    }).then(wrapResponse)
  );

  registry.register("trakt_sync_from_trakt", () =>
    traktFunctions.traktSyncFromTrakt().then(wrapResponse)
  );

  registry.register("trakt_get_user_stats", (args) =>
    traktFunctions.traktGetUserStats(args.userId as number | undefined).then(wrapResponse)
  );

  registry.register("trakt_start_scrobbling", (args) =>
    traktFunctions.traktStartScrobbling({
      ratingKey: args.ratingKey as string,
      title: args.title as string,
      type: args.type as "movie" | "episode",
      progress: args.progress as number,
      duration: args.duration as number | undefined,
    }).then(wrapResponse)
  );

  registry.register("trakt_get_sync_status", () =>
    traktFunctions.traktGetSyncStatus().then(wrapResponse)
  );

  registry.register("trakt_search", (args) =>
    traktFunctions.traktSearch(
      args.query as string,
      args.type as "movie" | "show" | undefined,
      args.year as number | undefined,
    ).then(wrapResponse)
  );

  return registry;
}

function wrapResponse(data: Record<string, unknown>) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}
