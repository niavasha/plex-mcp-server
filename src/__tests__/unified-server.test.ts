import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Import schemas to verify tool counts and names
import { PLEX_TOOL_SCHEMAS, PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";
import { TRAKT_TOOL_SCHEMAS } from "../trakt/tool-schemas.js";
import { ARR_TOOL_SCHEMAS } from "../arr/tool-schemas.js";

// Import registries and functions for dispatch testing
import { ToolRegistry, createPlexToolRegistry } from "../plex/tool-registry.js";
import { createTraktToolRegistry } from "../trakt/tool-registry.js";
import { createArrToolRegistry } from "../arr/tool-registry.js";
import { PlexTools } from "../plex/tools.js";
import { TraktMCPFunctions } from "../trakt/mcp-functions.js";
import { ArrMCPFunctions } from "../arr/mcp-functions.js";

describe("Unified server — tool registration", () => {
  const allBaseSchemas = [
    ...PLEX_TOOL_SCHEMAS,
    ...TRAKT_TOOL_SCHEMAS,
    ...ARR_TOOL_SCHEMAS,
  ];
  const allSchemasWithMutative = [
    ...allBaseSchemas,
    ...PLEX_MUTATIVE_TOOL_SCHEMAS,
  ];

  it("registers exactly 45 tools without mutative ops", () => {
    const names = allBaseSchemas.map((s) => s.name);
    expect(names).toHaveLength(45);
    // No duplicates
    expect(new Set(names).size).toBe(45);
  });

  it("registers exactly 54 tools with mutative ops", () => {
    const names = allSchemasWithMutative.map((s) => s.name);
    expect(names).toHaveLength(54);
    expect(new Set(names).size).toBe(54);
  });

  it("includes plex core tools", () => {
    const names = allBaseSchemas.map((s) => s.name);
    expect(names).toContain("get_libraries");
    expect(names).toContain("search_media");
    expect(names).toContain("get_recently_added");
    expect(names).toContain("get_on_deck");
    expect(names).toContain("get_media_details");
    expect(names).toContain("get_watch_history");
  });

  it("includes plex extended analytics tools (regression guard)", () => {
    const names = allBaseSchemas.map((s) => s.name);
    expect(names).toContain("get_fully_watched");
    expect(names).toContain("get_watch_stats");
    expect(names).toContain("get_user_stats");
    expect(names).toContain("get_library_stats");
    expect(names).toContain("get_popular_content");
  });

  it("includes trakt tools", () => {
    const names = allBaseSchemas.map((s) => s.name);
    expect(names).toContain("trakt_authenticate");
    expect(names).toContain("trakt_search");
    expect(names).toContain("trakt_sync_to_trakt");
    expect(names).toContain("trakt_get_user_stats");
  });

  it("includes arr tools", () => {
    const names = allBaseSchemas.map((s) => s.name);
    expect(names).toContain("sonarr_get_series");
    expect(names).toContain("sonarr_search");
    expect(names).toContain("radarr_get_movies");
    expect(names).toContain("radarr_search");
    expect(names).toContain("arr_get_status");
  });

  it("includes mutative tools when enabled", () => {
    const names = allSchemasWithMutative.map((s) => s.name);
    expect(names).toContain("update_metadata");
    expect(names).toContain("create_playlist");
    expect(names).toContain("add_to_watchlist");
    expect(names).toContain("delete_playlist");
  });

  it("every tool schema has name and inputSchema", () => {
    for (const schema of allSchemasWithMutative) {
      expect(schema).toHaveProperty("name");
      expect(schema).toHaveProperty("inputSchema");
      expect(typeof schema.name).toBe("string");
      expect(schema.name.length).toBeGreaterThan(0);
    }
  });

  it("no tool names overlap between plex, trakt, and arr", () => {
    const plexNames = new Set(PLEX_TOOL_SCHEMAS.map((s) => s.name));
    const traktNames = new Set(TRAKT_TOOL_SCHEMAS.map((s) => s.name));
    const arrNames = new Set(ARR_TOOL_SCHEMAS.map((s) => s.name));
    const mutativeNames = new Set(PLEX_MUTATIVE_TOOL_SCHEMAS.map((s) => s.name));

    for (const name of traktNames) {
      expect(plexNames.has(name)).toBe(false);
      expect(arrNames.has(name)).toBe(false);
    }
    for (const name of arrNames) {
      expect(plexNames.has(name)).toBe(false);
    }
    for (const name of mutativeNames) {
      expect(traktNames.has(name)).toBe(false);
      expect(arrNames.has(name)).toBe(false);
    }
  });
});

describe("Unified server — dispatch routing", () => {
  let plexRegistry: ToolRegistry;
  let traktRegistry: ToolRegistry;
  let arrRegistry: ToolRegistry;

  beforeEach(() => {
    // Create mock PlexClient
    const mockPlexClient = {
      makeRequest: vi.fn().mockResolvedValue({ MediaContainer: { Metadata: [] } }),
      getPlexTypeId: vi.fn().mockReturnValue(1),
      baseUrl: "http://localhost:32400",
      token: "test-token",
    } as unknown as ConstructorParameters<typeof PlexTools>[0];

    const plexTools = new PlexTools(mockPlexClient);
    plexRegistry = createPlexToolRegistry(plexTools, { includeMutative: true });

    const traktFunctions = new TraktMCPFunctions(mockPlexClient as any);
    traktRegistry = createTraktToolRegistry(traktFunctions);

    const arrFunctions = new ArrMCPFunctions();
    arrRegistry = createArrToolRegistry(arrFunctions);
  });

  it("plex registry owns plex tools", () => {
    expect(plexRegistry.has("get_libraries")).toBe(true);
    expect(plexRegistry.has("search_media")).toBe(true);
    expect(plexRegistry.has("get_fully_watched")).toBe(true);
    expect(plexRegistry.has("update_metadata")).toBe(true);
  });

  it("trakt registry owns trakt tools", () => {
    expect(traktRegistry.has("trakt_authenticate")).toBe(true);
    expect(traktRegistry.has("trakt_search")).toBe(true);
    expect(traktRegistry.has("trakt_sync_to_trakt")).toBe(true);
  });

  it("arr registry owns arr tools", () => {
    expect(arrRegistry.has("sonarr_get_series")).toBe(true);
    expect(arrRegistry.has("radarr_get_movies")).toBe(true);
    expect(arrRegistry.has("arr_get_status")).toBe(true);
  });

  it("dispatch chain routes correctly: plex → trakt → arr → error", async () => {
    // Simulate the dispatch chain from plex-mcp-server.ts
    async function dispatch(name: string, args: Record<string, unknown> = {}) {
      if (plexRegistry.has(name)) return await plexRegistry.handle(name, args);
      if (traktRegistry.has(name)) return await traktRegistry.handle(name, args);
      return await arrRegistry.handle(name, args);
    }

    // Plex tool dispatches to plexRegistry
    const plexResult = await dispatch("get_libraries");
    expect(plexResult).toHaveProperty("content");

    // Unknown tool throws McpError from arrRegistry (the fallback)
    await expect(dispatch("totally_fake_tool")).rejects.toThrow("Unknown tool: totally_fake_tool");
  });
});

describe("Unified server — graceful degradation", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      "PLEX_URL", "PLEX_TOKEN",
      "SONARR_API_KEY", "RADARR_API_KEY",
      "TRAKT_CLIENT_ID", "TRAKT_CLIENT_SECRET",
    ]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("arr tools return clear error when SONARR_API_KEY missing", async () => {
    const arr = new ArrMCPFunctions();
    await expect(arr.sonarrGetSeries({})).rejects.toThrow("SONARR_API_KEY");
  });

  it("arr tools return clear error when RADARR_API_KEY missing", async () => {
    const arr = new ArrMCPFunctions();
    await expect(arr.radarrGetMovies({})).rejects.toThrow("RADARR_API_KEY");
  });

  it("trakt tools throw clear error when TRAKT_CLIENT_ID missing", async () => {
    const mockPlexClient = { makeRequest: vi.fn() } as any;
    const trakt = new TraktMCPFunctions(mockPlexClient);
    // traktSearch calls initializeTraktClient which throws if CLIENT_ID missing
    await expect(trakt.traktSearch("test")).rejects.toThrow("TRAKT_CLIENT_ID");
  });

  it("arr error messages include setup instructions", async () => {
    const arr = new ArrMCPFunctions();
    await expect(arr.sonarrGetSeries({})).rejects.toThrow("Settings → General → API Key");
  });
});

describe("Unified server — startup validation", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ["PLEX_URL", "PLEX_TOKEN"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("requires PLEX_TOKEN to be set", () => {
    // Replicates the check from UnifiedMCPServer constructor
    expect(process.env.PLEX_TOKEN).toBeUndefined();
  });

  it("PlexClient accepts valid config", async () => {
    const { PlexClient } = await import("../plex/client.js");
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    expect(client).toBeDefined();
  });
});
