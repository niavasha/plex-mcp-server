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

  it("falls back to the library overview when the history endpoint is down", async () => {
    request.mockImplementation(async (path: string) => {
      if (path === "/library/sections") return { MediaContainer: { Directory: [{ key: "1", title: "Movies", type: "movie" }] } };
      throw new Error("unavailable");
    });

    const result = parse(await tools.getWatchStats(30, "plays"));

    expect(result.message).toMatch(/showing library overview/);
    expect(result.libraries).toHaveLength(1);
  });

  it("reports an error, not the library overview, when a later page fails", async () => {
    const server = historyServer(PLEX_CONTAINER_SIZE + 500);
    request.mockImplementation(async (path: string, params: Params = {}) => {
      if (params["X-Plex-Container-Start"] === PLEX_CONTAINER_SIZE) throw new Error("timeout");
      return server(path, params);
    });

    const result = parse(await tools.getWatchStats(30, "plays"));

    expect(result.error).toMatch(/could not be read completely/);
    expect(result.message).toMatch(/page 2 after 1000 items: timeout/);
    expect(result.stats).toBeUndefined();
    expect(result.libraries).toBeUndefined();
    expect(paramsOf((path) => path === "/library/sections")).toHaveLength(0);
  });

  it("reports an error when the server keeps sending the same page", async () => {
    const page: Row[] = Array.from({ length: PLEX_CONTAINER_SIZE }, (_, n) => ({ historyKey: `h${n}`, type: "episode", viewedAt: now - 60 }));
    request.mockResolvedValue({ MediaContainer: { Metadata: page } });

    const result = parse(await tools.getWatchStats(30, "plays"));

    expect(result.error).toMatch(/could not be read completely/);
    expect(result.message).toMatch(/same page twice/);
    // The repeat is caught on the second request, not after PLEX_MAX_PAGES of them.
    expect(paramsOf((path) => path === HISTORY)).toHaveLength(2);
  });
});

describe("fetchAllPages", () => {
  const fullPage = (prefix: string): Row[] => Array.from({ length: PLEX_CONTAINER_SIZE }, (_, n) => ({ ratingKey: `${prefix}${n}` }));

  it("throws the first page's failure as it came", async () => {
    const failure = new Error("unavailable");
    request.mockRejectedValue(failure);

    await expect(client.fetchAllPages("/library/all", {})).rejects.toBe(failure);
  });

  it("does not take rows without keys for a repeated page", async () => {
    const unkeyed: Row[] = Array.from({ length: PLEX_CONTAINER_SIZE }, () => ({ title: "x" }));
    request
      .mockResolvedValueOnce({ MediaContainer: { Metadata: unkeyed } })
      .mockResolvedValueOnce({ MediaContainer: { Metadata: unkeyed } })
      .mockResolvedValueOnce({ MediaContainer: { Metadata: [] } });

    const rows = await client.fetchAllPages("/library/all", {});

    expect(rows).toHaveLength(PLEX_CONTAINER_SIZE * 2);
  });

  it("keeps walking when consecutive pages differ", async () => {
    request
      .mockResolvedValueOnce({ MediaContainer: { Metadata: fullPage("a") } })
      .mockResolvedValueOnce({ MediaContainer: { Metadata: fullPage("b") } })
      .mockResolvedValueOnce({ MediaContainer: { Metadata: [{ ratingKey: "c0" }] } });

    const rows = await client.fetchAllPages("/library/all", {});

    expect(rows).toHaveLength(PLEX_CONTAINER_SIZE * 2 + 1);
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
  // recency fallbacks ask each one for twice the limit: the limit plus in-progress headroom.
  it("getRecentlyWatched falls back to a capped first page per library", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getRecentlyWatched(10);

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 20, sort: "lastViewedAt:desc" });
    }
  });

  it("getWatchHistory falls back to a capped first page per library", async () => {
    request.mockImplementation(fallbackServer());

    await tools.getWatchHistory(10);

    expect(libraryCalls()).toHaveLength(2);
    for (const params of libraryCalls()) {
      expect(params).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 20, sort: "lastViewedAt:desc" });
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
