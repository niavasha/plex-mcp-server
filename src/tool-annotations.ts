/**
 * MCP tool annotations (safety hints) applied to every advertised tool.
 *
 * The MCP spec lets a server declare, per tool, whether it only reads
 * (`readOnlyHint`), whether it can irreversibly destroy data
 * (`destructiveHint`), and whether it touches an external system
 * (`openWorldHint`). Clients and approval UIs use these to decide how much
 * scrutiny a tool call needs. Without them every tool looks equally risky.
 *
 * Classification is by explicit name sets so it stays correct as tools are
 * added: anything not listed here is treated as read-only.
 */

// Tools that irreversibly remove data.
const DESTRUCTIVE_TOOLS = new Set<string>(["delete_playlist", "clear_playlist"]);

// Tools that change state but are not destructive (create/update/add/remove,
// write a file, trigger a background task, or push auth/scrobble/sync state).
const MUTATIVE_TOOLS = new Set<string>([
  "export_library",
  "update_metadata",
  "update_metadata_from_json",
  "create_playlist",
  "add_to_playlist",
  "remove_from_playlist",
  "add_to_watchlist",
  "remove_from_watchlist",
  "sonarr_add_series",
  "sonarr_trigger_search",
  "radarr_add_movie",
  "radarr_trigger_search",
  "trakt_authenticate",
  "trakt_complete_auth",
  "trakt_sync_to_trakt",
  "trakt_sync_from_trakt",
  "trakt_start_scrobbling",
]);

function titleFromName(name: string): string {
  return name
    .split("_")
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: unknown;
  annotations?: Record<string, unknown>;
}

/**
 * Attach MCP annotations to each tool schema. Every tool here reaches Plex,
 * Trakt, or Sonarr/Radarr, so `openWorldHint` is always true. `readOnlyHint`
 * and `destructiveHint` follow the name sets above.
 */
export function withAnnotations<T extends ToolSchema>(schemas: readonly T[]): T[] {
  return schemas.map((schema) => {
    const destructive = DESTRUCTIVE_TOOLS.has(schema.name);
    const mutative = destructive || MUTATIVE_TOOLS.has(schema.name);
    return {
      ...schema,
      annotations: {
        title: titleFromName(schema.name),
        readOnlyHint: !mutative,
        destructiveHint: destructive,
        openWorldHint: true,
        ...schema.annotations,
      },
    };
  });
}
