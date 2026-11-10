import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PlexTools } from "../plex/tools.js";
import { PLEX_CONTAINER_SIZE } from "../plex/constants.js";

// The per-library tools merge each library's rows, sort them and keep the top `limit`.
// Now that Plex honours the size (#219), that is only the true top `limit` if every library
// can contribute `limit` rows that survive the tool's own filter, sorted on the merge's key.

type Row = Record<string, unknown>;
type Params = Record<string, string | number>;

const parse = (response: { content: Array<{ text: string }> }) => JSON.parse(response.content[0].text);

const RECENT_NOTE = "Retrieved from library metadata";
const HISTORY_NOTE = "Generated from library metadata (fallback method)";
const FULLY_NOTE = "Retrieved using fallback method - showing items with any view count";

let client: PlexClient;
let tools: PlexTools;
let errorSpy: ReturnType<typeof vi.spyOn>;

/**
 * Libraries keyed by section id. History, /library/all and the primary fully-watched query
 * (which sends `unwatched`) are down, so every tool takes its per-library path. Each library
 * honours `sort` (`field:desc`), X-Plex-Container-Start and -Size.
 */
function libraryServer(rows: Record<string, Row[]>) {
  const directory = Object.keys(rows).map((key) => ({ key, title: `Library ${key}` }));
  return async (path: string, params: Params = {}) => {
    if (path === "/library/sections") return { MediaContainer: { Directory: directory } };
    const match = /^\/library\/sections\/(\d+)\/all$/.exec(path);
    if (!match || params.unwatched !== undefined) throw new Error("unavailable");
    const field = String(params.sort ?? "").split(":")[0];
    const sorted = [...(rows[match[1]] ?? [])].sort(
      (a, b) => ((b[field] as number) || 0) - ((a[field] as number) || 0)
    );
    const start = Number(params["X-Plex-Container-Start"] ?? 0);
    const size = Number(params["X-Plex-Container-Size"] ?? sorted.length);
    return { MediaContainer: { totalSize: sorted.length, Metadata: sorted.slice(start, start + size) } };
  };
}

/**
 * `count` viewed movies in library `lib`. lastViewedAt counts down from `newest` and
 * viewCount from `plays`, so no two rows tie on either sort key.
 */
function viewed(lib: string, count: number, newest: number, plays: number): Row[] {
  return Array.from({ length: count }, (_, n) => ({
    ratingKey: `${lib}-${n}`,
    title: `${lib}-${n}`,
    type: "movie",
    lastViewedAt: newest - n,
    viewCount: plays - n,
    duration: 1000,
  }));
}

/** Started but never finished: viewed recently, no completed view. */
function inProgress(lib: string, count: number, newest: number): Row[] {
  return Array.from({ length: count }, (_, n) => ({
    ratingKey: `${lib}-p${n}`,
    title: `${lib}-p${n}`,
    type: "movie",
    lastViewedAt: newest - n,
    viewCount: 0,
    viewOffset: 500,
    duration: 1000,
  }));
}

const LIMIT = 20;
const keysOf = (items: Row[]) => items.map((item) => item.ratingKey);
const topOf = (lib: string, count: number) => Array.from({ length: count }, (_, n) => `${lib}-${n}`);

// Library 1 holds every one of the 20 most recent and the 20 most played views.
const skewed = () => ({
  "1": viewed("1", 25, 3_000_000, 900),
  "2": viewed("2", 25, 2_000_000, 600),
  "3": viewed("3", 25, 1_000_000, 300),
});

const serve = (rows: Record<string, Row[]>) => vi.spyOn(client, "makeRequest").mockImplementation(libraryServer(rows));

beforeEach(() => {
  client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  tools = new PlexTools(client);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("per-library fallbacks return the true top N when one library holds all of it", () => {
  it("getRecentlyWatched", async () => {
    serve(skewed());

    const result = parse(await tools.getRecentlyWatched(LIMIT));

    expect(result.note).toBe(RECENT_NOTE);
    expect(keysOf(result.recentlyWatched)).toEqual(topOf("1", LIMIT));
  });

  it("getWatchHistory", async () => {
    serve(skewed());

    const result = parse(await tools.getWatchHistory(LIMIT));

    expect(result.note).toBe(HISTORY_NOTE);
    expect(keysOf(result.watchHistory)).toEqual(topOf("1", LIMIT));
  });

  it("getFullyWatched", async () => {
    serve(skewed());

    const result = parse(await tools.getFullyWatched(undefined, "all", LIMIT));

    expect(result.note).toBe(FULLY_NOTE);
    expect(keysOf(result.fullyWatched)).toEqual(topOf("1", LIMIT));
  });

  it("getFullyWatched with libraryKey asks that one library for the whole limit", async () => {
    serve(skewed());

    const result = parse(await tools.getFullyWatched("1", "all", LIMIT));

    expect(result.note).toBe(FULLY_NOTE);
    expect(keysOf(result.fullyWatched)).toEqual(topOf("1", LIMIT));
  });

  it("getPopularContent by plays (guard: already green)", async () => {
    serve(skewed());

    const result = parse(await tools.getPopularContent(30, "plays", "all", LIMIT));

    expect(keysOf(result.popularContent)).toEqual(topOf("1", LIMIT));
  });
});

describe("items the filter drops do not take the place of ones it keeps", () => {
  // Five in-progress items are the most recently viewed in library 1, ahead of its 25 views.
  const crowded = () => ({
    "1": [...inProgress("1", 5, 4_000_000), ...viewed("1", 25, 3_000_000, 900)],
    "2": viewed("2", 25, 2_000_000, 600),
    "3": viewed("3", 25, 1_000_000, 300),
  });

  it("getRecentlyWatched", async () => {
    serve(crowded());

    const result = parse(await tools.getRecentlyWatched(LIMIT));

    expect(result.note).toBe(RECENT_NOTE);
    expect(keysOf(result.recentlyWatched)).toEqual(topOf("1", LIMIT));
  });

  it("getWatchHistory", async () => {
    serve(crowded());

    const result = parse(await tools.getWatchHistory(LIMIT));

    expect(result.note).toBe(HISTORY_NOTE);
    expect(keysOf(result.watchHistory)).toEqual(topOf("1", LIMIT));
  });

  it("getPopularContent by recency, above one Plex page", async () => {
    const want = PLEX_CONTAINER_SIZE + 5;
    serve({ "1": [...inProgress("1", 5, 9_000_000), ...viewed("1", want + 10, 5_000_000, 5_000)] });

    const result = parse(await tools.getPopularContent(30, "recent", "all", want));

    expect(keysOf(result.popularContent)).toEqual(topOf("1", want));
  });
});

describe("a library with fewer views than the limit costs one request", () => {
  /** 30 views, then a long tail of items never viewed: the shape of most real libraries. */
  const fewViews = () => ({
    "1": [
      ...viewed("1", 30, 3_000_000, 900),
      ...Array.from({ length: 6_000 }, (_, n) => ({ ratingKey: `1-u${n}`, title: `1-u${n}`, type: "movie", viewCount: 0 })),
    ],
  });
  const libraryRequests = (spy: ReturnType<typeof serve>) =>
    spy.mock.calls.filter((call: unknown[]) => /^\/library\/sections\/\d+\/all$/.test(call[0] as string)).length;

  it("getRecentlyWatched at its default limit", async () => {
    const spy = serve(fewViews());

    const result = parse(await tools.getRecentlyWatched());

    expect(result.note).toBe(RECENT_NOTE);
    expect(keysOf(result.recentlyWatched)).toEqual(topOf("1", 30));
    expect(result.scanCapped).toBeUndefined();
    expect(libraryRequests(spy)).toBe(1);
  });

  it("getWatchHistory at its default limit", async () => {
    const spy = serve(fewViews());

    const result = parse(await tools.getWatchHistory());

    expect(result.note).toBe(HISTORY_NOTE);
    expect(keysOf(result.watchHistory)).toEqual(topOf("1", 30));
    expect(result.scanCapped).toBeUndefined();
    expect(libraryRequests(spy)).toBe(1);
  });

  it("getPopularContent by recency at its default limit", async () => {
    const spy = serve(fewViews());

    const result = parse(await tools.getPopularContent(30, "recent"));

    expect(keysOf(result.popularContent)).toHaveLength(30);
    expect(result.scanCapped).toBeUndefined();
    expect(libraryRequests(spy)).toBe(1);
  });
});

describe("getFullyWatched fallback ranks by plays, as its merge does", () => {
  it("keeps a much-played item that was last viewed long ago", async () => {
    // More than LIMIT items viewed more recently, each played less.
    const rows = { "1": [...viewed("1", 30, 2_000_000, 50), { ...viewed("c", 1, 10, 99)[0], ratingKey: "classic" }] };
    serve(rows);

    const result = parse(await tools.getFullyWatched(undefined, "all", LIMIT));

    expect(result.note).toBe(FULLY_NOTE);
    expect(result.fullyWatched[0].ratingKey).toBe("classic");
  });

  it("does not list unwatched items (negative control)", async () => {
    serve({ "1": [...viewed("1", 3, 100, 9), ...inProgress("1", 10, 50)] });

    const result = parse(await tools.getFullyWatched(undefined, "all", 10));

    expect(result.note).toBe(FULLY_NOTE);
    expect(keysOf(result.fullyWatched)).toEqual(["1-0", "1-1", "1-2"]);
  });
});

describe("getPopularContent above one Plex page", () => {
  it("returns more than PLEX_CONTAINER_SIZE items from a single library", async () => {
    const want = PLEX_CONTAINER_SIZE + 5;
    serve({ "1": viewed("1", want + 10, 5_000_000, 5_000) });

    const result = parse(await tools.getPopularContent(30, "plays", "all", want));

    expect(keysOf(result.popularContent)).toEqual(topOf("1", want));
  });
});
