import { describe, it, expect } from "vitest";
import { withAnnotations } from "../shared/tool-annotations.js";
import { PLEX_TOOL_SCHEMAS, PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";
import { TRAKT_TOOL_SCHEMAS } from "../trakt/tool-schemas.js";
import { ARR_TOOL_SCHEMAS } from "../arr/tool-schemas.js";

/**
 * These annotations are a safety signal: a client's approval UI uses
 * `readOnlyHint` to decide what it may run without asking a human. A tool that
 * is wrongly marked read-only therefore gets waved through silently.
 *
 * So the direction of the default matters more than the classification of any
 * individual tool, and it is asserted here explicitly.
 */

const ALL_SCHEMAS = [
  ...PLEX_TOOL_SCHEMAS,
  ...PLEX_MUTATIVE_TOOL_SCHEMAS,
  ...TRAKT_TOOL_SCHEMAS,
  ...ARR_TOOL_SCHEMAS,
];

const annotated = withAnnotations(ALL_SCHEMAS);
const byName = new Map(annotated.map((t) => [t.name, t.annotations]));

describe("withAnnotations", () => {
  it("annotates every advertised tool", () => {
    expect(annotated).toHaveLength(ALL_SCHEMAS.length);
    for (const tool of annotated) {
      expect(tool.annotations, `${tool.name} has no annotations`).toBeDefined();
    }
  });

  it("marks every tool as touching an external system", () => {
    // Every tool reaches Plex, Trakt or Sonarr/Radarr over the network.
    for (const tool of annotated) {
      expect(tool.annotations.openWorldHint, tool.name).toBe(true);
    }
  });

  it("gives each tool a human-readable title", () => {
    expect(byName.get("get_libraries")?.title).toBe("Get Libraries");
    expect(byName.get("delete_playlist")?.title).toBe("Delete Playlist");
  });

  it("preserves annotations a schema already declares", () => {
    const [tool] = withAnnotations([
      {
        name: "get_libraries",
        description: "x",
        inputSchema: {},
        annotations: { title: "Custom Title" },
      },
    ]);
    expect(tool.annotations.title).toBe("Custom Title");
  });
});

describe("safe-by-default classification", () => {
  /**
   * The regression this suite exists for. An unrecognised tool must NOT be
   * advertised as read-only: forgetting to classify a new mutating tool should
   * cause an extra approval prompt, never a silent auto-run.
   */
  it("does not mark an unrecognised tool as read-only", () => {
    const [tool] = withAnnotations([
      { name: "delete_all_libraries", description: "x", inputSchema: {} },
    ]);
    expect(tool.annotations.readOnlyHint).toBe(false);
  });

  it("does not mark an unrecognised tool as destructive either", () => {
    // Unknown means "needs approval", not "certainly destroys data".
    const [tool] = withAnnotations([
      { name: "some_future_tool", description: "x", inputSchema: {} },
    ]);
    expect(tool.annotations.destructiveHint).toBe(false);
  });

  it("treats every Plex mutative-op tool as not read-only", () => {
    // Derived from the schema array itself, so this cannot drift.
    for (const schema of PLEX_MUTATIVE_TOOL_SCHEMAS) {
      expect(byName.get(schema.name)?.readOnlyHint, schema.name).toBe(false);
    }
  });

  it("flags irreversible removals as destructive", () => {
    for (const name of ["delete_playlist", "clear_playlist"]) {
      expect(byName.get(name)?.destructiveHint, name).toBe(true);
      expect(byName.get(name)?.readOnlyHint, name).toBe(false);
    }
  });

  it("treats reversible writes as non-destructive but not read-only", () => {
    for (const name of [
      "update_metadata",
      "create_playlist",
      "add_to_playlist",
      "add_to_watchlist",
      "rate_media",
      "mark_watched",
      "mark_unwatched",
      "export_library",
      "sonarr_add_series",
      "radarr_add_movie",
      "trakt_sync_to_trakt",
    ]) {
      expect(byName.get(name)?.readOnlyHint, name).toBe(false);
      expect(byName.get(name)?.destructiveHint, name).toBe(false);
    }
  });

  it("marks genuine reads as read-only", () => {
    for (const name of [
      "get_libraries",
      "get_watch_history",
      "get_active_sessions",
      "get_recommendations",
      "search_media",
      "sonarr_get_series",
      "radarr_get_movies",
      "arr_get_status",
      "trakt_search",
    ]) {
      expect(byName.get(name)?.readOnlyHint, name).toBe(true);
      expect(byName.get(name)?.destructiveHint, name).toBe(false);
    }
  });

  it("does not mistake trigger_search for a read", () => {
    // Name-similarity trap: *_search reads a catalogue, *_trigger_search
    // starts a download job.
    for (const name of ["sonarr_trigger_search", "radarr_trigger_search"]) {
      expect(byName.get(name)?.readOnlyHint, name).toBe(false);
    }
  });

  it("classifies every advertised tool explicitly", () => {
    // Anything falling through to the unsafe default is a gap to close, not a
    // tool to leave unclassified.
    const unclassified = annotated
      .filter((t) => t.annotations.readOnlyHint === false && t.annotations.destructiveHint === false)
      .map((t) => t.name)
      .filter((name) => !KNOWN_WRITES.has(name));
    expect(unclassified).toEqual([]);
  });
});

const KNOWN_WRITES = new Set([
  ...PLEX_MUTATIVE_TOOL_SCHEMAS.map((s) => s.name),
  "export_library",
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
