/**
 * MCP tool annotations (safety hints) applied to every advertised tool.
 *
 * Originally contributed by @warlyjr-cloud in #117.
 *
 * The MCP spec lets a server declare, per tool, whether it only reads
 * (`readOnlyHint`), whether it can irreversibly destroy data
 * (`destructiveHint`), and whether it touches an external system
 * (`openWorldHint`). Clients and approval UIs use these to decide how much
 * scrutiny a tool call needs. Without them every tool looks equally risky.
 *
 * ## Why the default is "not read-only"
 *
 * These hints are a safety signal, so the two possible misclassifications are
 * not symmetric:
 *
 *   - marking a read as a write → one unnecessary approval prompt
 *   - marking a write as a read → an approval UI runs it without asking
 *
 * Only the first is recoverable. So a tool is advertised as read-only *only*
 * when it appears in `READ_ONLY_TOOLS` below; anything unrecognised falls
 * through to "not read-only" and gets challenged. Forgetting to classify a new
 * tool is then merely noisy rather than dangerous.
 *
 * Naming conventions are not safe to infer from: `sonarr_search` queries
 * TheTVDB, but `sonarr_trigger_search` starts a download job.
 */

import { PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";

/** Tools that irreversibly remove data. */
const DESTRUCTIVE_TOOLS = new Set<string>(["delete_playlist", "clear_playlist"]);

/** Tools that only read. Everything absent from this set is treated as a write. */
const READ_ONLY_TOOLS = new Set<string>([
  // Plex
  "get_libraries",
  "get_library_items",
  "search_media",
  "get_recently_added",
  "get_on_deck",
  "get_media_details",
  "get_editable_fields",
  "get_playlist_items",
  "get_playlists",
  "get_watchlist",
  "get_recently_watched",
  "get_watch_history",
  "get_active_sessions",
  "get_fully_watched",
  "get_watch_stats",
  "get_user_stats",
  "get_library_stats",
  "get_popular_content",
  "get_recommendations",
  // Trakt
  "trakt_get_auth_status",
  "trakt_get_user_stats",
  "trakt_get_sync_status",
  "trakt_search",
  // Sonarr / Radarr
  "sonarr_get_series",
  "sonarr_search",
  "sonarr_get_missing",
  "sonarr_get_queue",
  "sonarr_get_calendar",
  "sonarr_get_profiles",
  "radarr_get_movies",
  "radarr_search",
  "radarr_get_missing",
  "radarr_get_queue",
  "radarr_get_calendar",
  "radarr_get_profiles",
  "arr_get_status",
]);

/**
 * The opt-in write tools, taken from the schema array itself rather than
 * retyped. A tool added to `PLEX_MUTATIVE_TOOL_SCHEMAS` is therefore classified
 * correctly the moment it exists, and cannot drift out of sync with a list
 * maintained by hand.
 */
const PLEX_MUTATIVE_NAMES = new Set<string>(PLEX_MUTATIVE_TOOL_SCHEMAS.map((s) => s.name));

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

/** A schema that is guaranteed to carry annotations. */
export type Annotated<T> = T & { annotations: Record<string, unknown> };

/**
 * Attach MCP annotations to each tool schema. Every tool here reaches Plex,
 * Trakt, or Sonarr/Radarr, so `openWorldHint` is always true.
 *
 * The return type states that `annotations` is present, so callers can read it
 * back without a cast — returning plain `T[]` would leave it optional even
 * though this function always sets it.
 */
export function withAnnotations<T extends ToolSchema>(schemas: readonly T[]): Annotated<T>[] {
  return schemas.map((schema) => {
    const destructive = DESTRUCTIVE_TOOLS.has(schema.name);
    const readOnly =
      !destructive && !PLEX_MUTATIVE_NAMES.has(schema.name) && READ_ONLY_TOOLS.has(schema.name);

    return {
      ...schema,
      annotations: {
        title: titleFromName(schema.name),
        readOnlyHint: readOnly,
        destructiveHint: destructive,
        openWorldHint: true,
        ...schema.annotations,
      },
    };
  });
}
