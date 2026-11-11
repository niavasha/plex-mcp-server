import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PlexTools } from "../plex/tools.js";
import { PLEX_CONTAINER_SIZE } from "../plex/constants.js";

// Plex ignores X-Plex-Container-Size unless X-Plex-Container-Start comes with it, so a
// size on its own is not a limit. Every request below has to carry the pair.

type Row = Record<string, unknown>;
type Params = Record<string, string | number>;

const HISTORY = "/status/sessions/history/all";
const parse = (response: { content: Array<{ text: string }> }) => JSON.parse(response.content[0].text);

let client: PlexClient;
let tools: PlexTools;
let request: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

/** The params of every request made to a path matching `match`. */
const paramsOf = (match: (path: string) => boolean): Params[] =>
  request.mock.calls.filter((call: unknown[]) => match(call[0] as string)).map((call: unknown[]) => (call[1] ?? {}) as Params);

beforeEach(() => {
  client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
  // The real client, so the real fetchAllPages runs; a request that isn't mocked fails.
  request = vi.spyOn(client, "makeRequest").mockRejectedValue(new Error("unexpected request"));
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  tools = new PlexTools(client);
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("getWatchStats", () => {
  const now = Math.floor(Date.now() / 1000);

  /** A history of `count` plays from the last hour, which honours the viewedAt filter and the paging pair. */
  function historyServer(count: number) {
    const rows: Row[] = Array.from({ length: count }, (_, n) => ({ historyKey: `h${n}`, type: "episode", viewedAt: now - 60 - n }));
    return async (_path: string, params: Params = {}) => {
      const from = Number(params["viewedAt>"] ?? 0);
      const matching = rows.filter((row) => (row.viewedAt as number) >= from);
      const start = Number(params["X-Plex-Container-Start"] ?? 0);
      const size = Number(params["X-Plex-Container-Size"] ?? matching.length);
      return { MediaContainer: { totalSize: matching.length, Metadata: matching.slice(start, start + size) } };
    };
  }

  it("sends the time range to Plex and pages through all of it", async () => {
    const total = PLEX_CONTAINER_SIZE + 500;
    request.mockImplementation(historyServer(total));

    const result = parse(await tools.getWatchStats(30, "plays"));

    expect(result.totalSessions).toBe(total);
    expect(result.stats.totalPlays).toBe(total);
    const calls = paramsOf((path) => path === HISTORY);
    expect(calls.map((params) => params["X-Plex-Container-Start"])).toEqual([0, PLEX_CONTAINER_SIZE]);
    for (const params of calls) {
      expect(params["X-Plex-Container-Size"]).toBe(PLEX_CONTAINER_SIZE);
      expect(params["viewedAt>"]).toBeCloseTo(now - 30 * 86400, -1);
    }
  });

  it("takes one request when the range fits a page", async () => {
    request.mockImplementation(historyServer(3));

    const result = parse(await tools.getWatchStats(1, "plays"));

    expect(result.totalSessions).toBe(3);
    expect(paramsOf((path) => path === HISTORY)).toHaveLength(1);
  });
});

describe("per-library requests", () => {
  const libraries = { MediaContainer: { Directory: [{ key: "1", title: "Movies" }, { key: "2", title: "TV" }] } };
  const empty = { MediaContainer: { Metadata: [] } };
  const libraryCalls = () => paramsOf((path) => /^\/library\/sections\/\d+\/all$/.test(path));

  /** Plex with history and /library/all down, so the tools fall back to the libraries. */
  function fallbackServer() {
    return async (path: string) => {
      if (path === "/library/sections") return libraries;
      if (/^\/library\/sections\/\d+\/all$/.test(path)) return empty;
      throw new Error("unavailable");
    };
  }

  it("getPopularContent asks each library for its first page", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getPopularContent();

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": PLEX_CONTAINER_SIZE });
    }
  });

  // Each library may hold the whole merged top `limit` (plex-fallback-top-n.test.ts), so the
  // recency fallbacks ask each one for at least the limit, and for at least 100 rows so that a
  // library with a few views is read in one request. They page on from there only while
  // in-progress rows leave fewer than `limit` views.
  it("getRecentlyWatched falls back to a first page per library", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getRecentlyWatched(10);

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 100, sort: "lastViewedAt:desc" });
    }
  });

  it("getWatchHistory falls back to a first page per library", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getWatchHistory(10);

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 100, sort: "lastViewedAt:desc" });
    }
  });

  it("getFullyWatched falls back to each library's most played items, as its merge ranks them", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getFullyWatched(undefined, "all", 10);

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 10, sort: "viewCount:desc" });
    }
  });
});
