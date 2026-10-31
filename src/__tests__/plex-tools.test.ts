import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decode } from "@toon-format/toon";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { SUMMARY_PREVIEW_LENGTH, DEFAULT_LIMITS } from "../plex/constants.js";

/** Create a mock PlexClient without hitting any real server */
function createMockClient() {
  return {
    makeRequest: vi.fn(),
    makeDiscoverRequest: vi.fn(),
    rateMedia: vi.fn(),
    markAsWatched: vi.fn(),
    markAsUnwatched: vi.fn(),
    // The real resolver (it doesn't use `this`), so unknown types fail here as they do live.
    getPlexTypeId: vi.fn((type: string) => PlexClient.prototype.getPlexTypeId.call(null, type)),
  } as unknown as PlexClient;
}

/** Parse the JSON text from an MCP response */
function parseResponse(response: { content: Array<{ text: string }> }) {
  return JSON.parse(response.content[0].text);
}

const LONG_SUMMARY = "A".repeat(1000);

describe("PlexTools", () => {
  let client: ReturnType<typeof createMockClient>;
  let tools: PlexTools;

  beforeEach(() => {
    client = createMockClient();
    tools = new PlexTools(client as unknown as PlexClient);
  });

  describe("searchMedia", () => {
    it("returns results with correct fields", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Test Movie", type: "movie", year: 2024, summary: "Short", rating: 8.5, thumb: "/thumb/1" },
          ],
        },
      });

      const result = parseResponse(await tools.searchMedia("test"));
      const item = result.results[0];

      expect(item).toHaveProperty("ratingKey", "1");
      expect(item).toHaveProperty("title", "Test Movie");
      expect(item).toHaveProperty("type", "movie");
      expect(item).toHaveProperty("year", 2024);
      expect(item).toHaveProperty("rating", 8.5);
    });

    it("does NOT include thumb field (regression)", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Test", type: "movie", thumb: "/thumb/1" },
          ],
        },
      });

      const result = parseResponse(await tools.searchMedia("test"));
      expect(result.results[0]).not.toHaveProperty("thumb");
    });

    it("truncates long summaries", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Test", type: "movie", summary: LONG_SUMMARY },
          ],
        },
      });

      const result = parseResponse(await tools.searchMedia("test"));
      expect(result.results[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3); // +3 for "..."
    });

    it("uses default limit of 500", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [] },
      });

      await tools.searchMedia("test");
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1]["X-Plex-Container-Size"]).toBe(DEFAULT_LIMITS.searchMedia);
    });

    it("respects custom limit", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [] },
      });

      await tools.searchMedia("test", undefined, undefined, 100);
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1]["X-Plex-Container-Size"]).toBe(100);
    });
  });

  describe("getRecentlyAdded", () => {
    it("truncates summaries", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [{ ratingKey: "1", title: "New Movie", type: "movie", year: 2024, addedAt: 1000, summary: LONG_SUMMARY }],
        },
      });

      const result = parseResponse(await tools.getRecentlyAdded());
      expect(result.recentlyAdded[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });

    it("uses default limit of 50", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [] },
      });

      await tools.getRecentlyAdded();
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1]["X-Plex-Container-Size"]).toBe(DEFAULT_LIMITS.recentlyAdded);
    });

    it("lists one type of a library newest first, so new episodes of existing seasons appear", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [{ ratingKey: "9", title: "Pilot", type: "episode", addedAt: 2000 }] },
      });

      const result = parseResponse(await tools.getRecentlyAdded(10, "episode", "2"));
      const [endpoint, params] = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(endpoint).toBe("/library/sections/2/all");
      expect(params).toMatchObject({ type: 4, sort: "addedAt:desc", "X-Plex-Container-Size": 10 });
      expect(result.recentlyAdded[0].ratingKey).toBe("9");
    });

    it("rejects type without libraryKey and libraryKey without type", async () => {
      await expect(tools.getRecentlyAdded(10, "episode")).rejects.toThrow("type and libraryKey must be given together");
      await expect(tools.getRecentlyAdded(10, undefined, "2")).rejects.toThrow("type and libraryKey must be given together");
      expect(client.makeRequest).not.toHaveBeenCalled();
    });
  });

  describe("getPlaylists", () => {
    it("truncates summaries", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", key: "/playlists/1", title: "My Playlist", type: "playlist", playlistType: "video", smart: false, leafCount: 5, duration: 3600, summary: LONG_SUMMARY, updatedAt: 1000, addedAt: 900 },
          ],
        },
      });

      const result = parseResponse(await tools.getPlaylists());
      expect(result.playlists[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });
  });

  describe("getPlaylistItems", () => {
    it("truncates summaries", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { playlistItemID: "1", ratingKey: "10", title: "Item", type: "movie", year: 2024, duration: 7200, summary: LONG_SUMMARY },
          ],
        },
      });

      const result = parseResponse(await tools.getPlaylistItems("1"));
      expect(result.items[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });
  });

  describe("getWatchlist", () => {
    it("reads the account watchlist from Discover and exposes its global GUID", async () => {
      (client.makeDiscoverRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            {
              ratingKey: "global-1",
              guid: "plex://movie/global-1",
              title: "Watchlist Item",
              type: "movie",
              year: 2024,
              summary: LONG_SUMMARY,
              watchlistedAt: 1000,
            },
          ],
        },
      });

      const result = parseResponse(await tools.getWatchlist());
      expect(result.watchlist[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
      expect(result.watchlist[0]).toMatchObject({
        ratingKey: "global-1",
        guid: "plex://movie/global-1",
        addedAt: 1000,
      });
      expect(client.makeDiscoverRequest).toHaveBeenCalledWith(
        "/library/sections/watchlist/all",
        { includeCollections: 1, includeExternalMedia: 1 },
        "GET"
      );
      expect(client.makeRequest).not.toHaveBeenCalled();
    });
  });

  describe("watchlist mutations", () => {
    const ORIGINAL_MUTATIVE_ENV = process.env.PLEX_ENABLE_MUTATIVE_OPS;

    beforeEach(() => {
      process.env.PLEX_ENABLE_MUTATIVE_OPS = "true";
    });

    afterEach(() => {
      if (ORIGINAL_MUTATIVE_ENV === undefined) {
        delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
      } else {
        process.env.PLEX_ENABLE_MUTATIVE_OPS = ORIGINAL_MUTATIVE_ENV;
      }
    });

    it("adds a local item through Discover using its Plex GUID suffix", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [{ guid: "plex://movie/abc123" }] },
      });
      (client.makeDiscoverRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = parseResponse(await tools.addToWatchlist("42"));

      expect(client.makeDiscoverRequest).toHaveBeenCalledWith(
        "/actions/addToWatchlist",
        { ratingKey: "abc123" },
        "PUT"
      );
      expect(result).toMatchObject({ updated: true, ratingKey: "42", plexGuid: "plex://movie/abc123" });
    });

    it("removes an account watchlist item directly by global Plex GUID", async () => {
      (client.makeDiscoverRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = parseResponse(
        await tools.removeFromWatchlist({ plexGuid: "plex://show/show123" })
      );

      expect(client.makeDiscoverRequest).toHaveBeenCalledWith(
        "/actions/removeFromWatchlist",
        { ratingKey: "show123" },
        "PUT"
      );
      expect(client.makeRequest).not.toHaveBeenCalled();
      expect(result).toMatchObject({ updated: true, plexGuid: "plex://show/show123" });
    });

    it("keeps local rating keys as a compatibility path for removal", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [{ guid: "plex://movie/abc123" }] },
      });
      (client.makeDiscoverRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await tools.removeFromWatchlist({ ratingKey: "42" });

      expect(client.makeRequest).toHaveBeenCalledWith("/library/metadata/42");
      expect(client.makeDiscoverRequest).toHaveBeenCalledWith(
        "/actions/removeFromWatchlist",
        { ratingKey: "abc123" },
        "PUT"
      );
    });

    it("keeps the legacy direct string argument for library consumers", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [{ guid: "plex://movie/legacy123" }] },
      });
      (client.makeDiscoverRequest as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await tools.removeFromWatchlist("42");

      expect(client.makeDiscoverRequest).toHaveBeenCalledWith(
        "/actions/removeFromWatchlist",
        { ratingKey: "legacy123" },
        "PUT"
      );
    });

    it("rejects legacy or malformed global GUIDs before calling Discover", async () => {
      await expect(
        tools.removeFromWatchlist({ plexGuid: "imdb://tt1234567" })
      ).rejects.toThrow(/Plex Movie or Plex TV Series agent/i);
      expect(client.makeDiscoverRequest).not.toHaveBeenCalled();
    });
  });

  describe("watch-state actions", () => {
    const originalMutativeEnv = process.env.PLEX_ENABLE_MUTATIVE_OPS;

    beforeEach(() => {
      process.env.PLEX_ENABLE_MUTATIVE_OPS = "true";
    });

    afterEach(() => {
      if (originalMutativeEnv === undefined) {
        delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
      } else {
        process.env.PLEX_ENABLE_MUTATIVE_OPS = originalMutativeEnv;
      }
    });

    it("marks an item watched through the dedicated client operation", async () => {
      const result = parseResponse(await tools.markWatched("42"));

      expect(client.markAsWatched).toHaveBeenCalledWith("42");
      expect(result).toEqual({ updated: true, watched: true, ratingKey: "42" });
    });

    it("marks an item unwatched through the dedicated client operation", async () => {
      const result = parseResponse(await tools.markUnwatched("42"));

      expect(client.markAsUnwatched).toHaveBeenCalledWith("42");
      expect(result).toEqual({ updated: true, watched: false, ratingKey: "42" });
    });

    it("keeps both actions behind the mutative-operations opt-in", async () => {
      delete process.env.PLEX_ENABLE_MUTATIVE_OPS;

      await expect(tools.markWatched("42")).rejects.toThrow(/PLEX_ENABLE_MUTATIVE_OPS/);
      await expect(tools.markUnwatched("42")).rejects.toThrow(/PLEX_ENABLE_MUTATIVE_OPS/);
      expect(client.markAsWatched).not.toHaveBeenCalled();
      expect(client.markAsUnwatched).not.toHaveBeenCalled();
    });

    it("rejects invalid local rating keys before calling Plex", async () => {
      await expect(tools.markWatched("not-a-key")).rejects.toThrow(/numeric Plex ID/);
      await expect(tools.markUnwatched("not-a-key")).rejects.toThrow(/numeric Plex ID/);
      expect(client.markAsWatched).not.toHaveBeenCalled();
      expect(client.markAsUnwatched).not.toHaveBeenCalled();
    });
  });

  describe("media rating action", () => {
    const originalMutativeEnv = process.env.PLEX_ENABLE_MUTATIVE_OPS;

    beforeEach(() => {
      process.env.PLEX_ENABLE_MUTATIVE_OPS = "true";
    });

    afterEach(() => {
      if (originalMutativeEnv === undefined) {
        delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
      } else {
        process.env.PLEX_ENABLE_MUTATIVE_OPS = originalMutativeEnv;
      }
    });

    it.each([0, 8.5, 10])("sets a valid Plex user rating of %s", async (rating) => {
      const result = parseResponse(await tools.rateMedia("42", rating));

      expect(client.rateMedia).toHaveBeenCalledWith("42", rating);
      expect(result).toEqual({ updated: true, ratingKey: "42", rating });
    });

    it.each([-0.1, 10.1, Number.NaN, Number.POSITIVE_INFINITY])(
      "rejects an invalid Plex user rating of %s",
      async (rating) => {
        await expect(tools.rateMedia("42", rating)).rejects.toThrow(/between 0 and 10/i);
        expect(client.rateMedia).not.toHaveBeenCalled();
      }
    );

    it("keeps rating behind the mutative-operations opt-in", async () => {
      delete process.env.PLEX_ENABLE_MUTATIVE_OPS;

      await expect(tools.rateMedia("42", 8)).rejects.toThrow(/PLEX_ENABLE_MUTATIVE_OPS/);
      expect(client.rateMedia).not.toHaveBeenCalled();
    });

    it("rejects invalid local rating keys before calling Plex", async () => {
      await expect(tools.rateMedia("not-a-key", 8)).rejects.toThrow(/numeric Plex ID/);
      expect(client.rateMedia).not.toHaveBeenCalled();
    });
  });

  describe("getMediaDetails", () => {
    it("returns full untruncated summary (regression)", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Detail Movie", type: "movie", year: 2024, summary: LONG_SUMMARY, rating: 9.0, duration: 7200 },
          ],
        },
      });

      const result = parseResponse(await tools.getMediaDetails("1"));
      expect(result.details.summary).toBe(LONG_SUMMARY);
    });
  });

  describe("getUserStats", () => {
    it("does NOT include thumb field (regression)", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Account: [
            { id: 1, name: "User1", email: "user@test.com", thumb: "https://plex.tv/avatar.png" },
          ],
        },
      });

      const result = parseResponse(await tools.getUserStats());
      expect(result.users[0]).not.toHaveProperty("thumb");
      expect(result.users[0]).toHaveProperty("name", "User1");
      expect(result.users[0]).toHaveProperty("email", "user@test.com");
    });
  });

  describe("getLibraries", () => {
    it("returns correct response shape", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Directory: [
            { key: "1", title: "Movies", type: "movie", agent: "tv.plex.agents.movie", scanner: "Plex Movie", language: "en", updatedAt: 1000 },
          ],
        },
      });

      const result = parseResponse(await tools.getLibraries());
      expect(result.libraries).toHaveLength(1);
      expect(result.libraries[0]).toHaveProperty("key", "1");
      expect(result.libraries[0]).toHaveProperty("title", "Movies");
    });
  });

  describe("getOnDeck", () => {
    it("returns correct fields", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Continue This", type: "episode", viewOffset: 5000, duration: 10000, lastViewedAt: 1000 },
          ],
        },
      });

      const result = parseResponse(await tools.getOnDeck());
      expect(result.onDeck[0]).toHaveProperty("ratingKey", "1");
      expect(result.onDeck[0]).toHaveProperty("viewOffset", 5000);
      expect(result.onDeck[0]).not.toHaveProperty("summary");
    });
  });

  /**
   * Episodes and seasons must say which show they belong to. Plex's raw
   * parent/grandparent fields mean different things per item type, so the tools
   * return normalised showTitle/showRatingKey/seasonNumber/episodeNumber instead.
   */
  describe("show context for episodes and seasons", () => {
    const episode = { ratingKey: "1", title: "Pilot", type: "episode", grandparentTitle: "Breaking Bad", grandparentRatingKey: "100", parentTitle: "Season 1", parentIndex: 1, index: 4 };
    const season = { ratingKey: "2", title: "Final Season", type: "season", parentTitle: "Beastars", parentRatingKey: "200", parentIndex: 1, index: 3 };
    const show = { ratingKey: "3", title: "Some Show", type: "show", index: 1 };
    const movie = { ratingKey: "4", title: "A Movie", type: "movie" };
    const episodeFields = { showTitle: "Breaking Bad", showRatingKey: "100", seasonNumber: 1, episodeNumber: 4 };
    const seasonFields = { showTitle: "Beastars", showRatingKey: "200", seasonNumber: 3 };
    const showFieldNames = ["showTitle", "showRatingKey", "seasonNumber", "episodeNumber"];

    function mockMetadata(items: Array<Record<string, unknown>>) {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: items } });
    }

    function expectNoShowFields(item: Record<string, unknown>) {
      for (const name of showFieldNames) expect(item).not.toHaveProperty(name);
    }

    it("getOnDeck adds show info to episodes only", async () => {
      mockMetadata([episode, movie]);
      const result = parseResponse(await tools.getOnDeck());
      expect(result.onDeck[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.onDeck[1]);
    });

    it("getRecentlyAdded adds show info to episodes and seasons", async () => {
      mockMetadata([episode, season]);
      const result = parseResponse(await tools.getRecentlyAdded());
      expect(result.recentlyAdded[0]).toMatchObject(episodeFields);
      expect(result.recentlyAdded[1]).toMatchObject(seasonFields);
      expect(result.recentlyAdded[1]).not.toHaveProperty("episodeNumber");
    });

    it("getRecentlyAdded does not leak Plex's raw index fields for seasons, shows or movies", async () => {
      mockMetadata([season, show, movie]);
      const result = parseResponse(await tools.getRecentlyAdded());
      for (const item of result.recentlyAdded) {
        expect(item).not.toHaveProperty("index");
        expect(item).not.toHaveProperty("parentIndex");
      }
      expectNoShowFields(result.recentlyAdded[1]);
      expectNoShowFields(result.recentlyAdded[2]);
    });

    it("searchMedia adds show info to episodes only", async () => {
      mockMetadata([episode, movie]);
      const result = parseResponse(await tools.searchMedia("pilot"));
      expect(result.results[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.results[1]);
    });

    it("getWatchHistory derives showRatingKey from grandparentKey, which is all Plex's history entries carry", async () => {
      const { grandparentRatingKey: _omitted, ...historyEpisode } = episode;
      mockMetadata([{ ...historyEpisode, grandparentKey: "/library/metadata/100", viewedAt: 1000 }]);
      const result = parseResponse(await tools.getWatchHistory());
      expect(result.watchHistory[0]).toMatchObject(episodeFields);
    });

    it("showRatingKey prefers grandparentRatingKey and ignores a grandparentKey of another shape", async () => {
      mockMetadata([
        { ...episode, grandparentKey: "/library/metadata/999" },
        { ...episode, grandparentRatingKey: undefined, grandparentKey: "/somewhere/else/100" },
      ]);
      const result = parseResponse(await tools.getOnDeck());
      expect(result.onDeck[0].showRatingKey).toBe("100");
      expect(result.onDeck[1]).not.toHaveProperty("showRatingKey");
    });

    it("getLibraryItems adds show info to episodes only", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { totalSize: 2, Metadata: [episode, movie] } });
      const result = parseResponse(await tools.getLibraryItems("2", "episode"));
      expect(result.items[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.items[1]);
    });

    it("getMediaDetails adds show info to an episode", async () => {
      mockMetadata([episode]);
      const result = parseResponse(await tools.getMediaDetails("1"));
      expect(result.details).toMatchObject(episodeFields);
    });

    it("getMediaDetails adds no show info to a movie", async () => {
      mockMetadata([movie]);
      const result = parseResponse(await tools.getMediaDetails("4"));
      expectNoShowFields(result.details);
    });

    it("getPlaylistItems adds show info to episodes only", async () => {
      mockMetadata([episode, movie]);
      const result = parseResponse(await tools.getPlaylistItems("1"));
      expect(result.items[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.items[1]);
    });

    it("getPopularContent adds show info to episodes only", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (requestPath: string) => {
        if (requestPath === "/library/sections") return { MediaContainer: { Directory: [{ key: "2" }] } };
        return { MediaContainer: { Metadata: [{ ...episode, viewCount: 3 }, { ...movie, viewCount: 2 }] } };
      });
      const result = parseResponse(await tools.getPopularContent());
      expect(result.popularContent[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.popularContent[1]);
    });

    it("getFullyWatched adds show info to episodes only", async () => {
      const watched = { viewCount: 1, duration: 100, viewOffset: 100 };
      mockMetadata([{ ...episode, ...watched }, { ...movie, ...watched }]);
      const result = parseResponse(await tools.getFullyWatched());
      expect(result.fullyWatched[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.fullyWatched[1]);
    });

    it("getFullyWatched keeps show info in its library fallback", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (requestPath: string) => {
        if (requestPath === "/library/all") throw new Error("library listing unavailable");
        if (requestPath === "/library/sections") return { MediaContainer: { Directory: [{ key: "2" }] } };
        return { MediaContainer: { Metadata: [{ ...episode, viewCount: 1 }] } };
      });
      const result = parseResponse(await tools.getFullyWatched(undefined, "episode"));
      expect(result.note).toContain("fallback");
      expect(result.fullyWatched[0]).toMatchObject(episodeFields);
    });

    it("exportLibrary writes show info for episodes only", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { totalSize: 2, Metadata: [episode, movie] } });
      const outputPath = `show-context-test-${process.pid}.json`;
      const exportFile = path.resolve(process.cwd(), "exports", outputPath);
      try {
        await tools.exportLibrary("2", "episode", outputPath);
        const exported = JSON.parse(await readFile(exportFile, "utf8"));
        expect(exported[0]).toMatchObject(episodeFields);
        expectNoShowFields(exported[1]);
      } finally {
        await rm(exportFile, { force: true });
      }
    });

    it("getWatchHistory adds show info to episodes only", async () => {
      mockMetadata([{ ...episode, viewedAt: 1000 }, { ...movie, viewedAt: 900 }]);
      const result = parseResponse(await tools.getWatchHistory());
      expect(result.watchHistory[0]).toMatchObject(episodeFields);
      expectNoShowFields(result.watchHistory[1]);
    });

    it("getRecentlyWatched adds show info from the history endpoint", async () => {
      mockMetadata([{ ...episode, viewedAt: 1000 }]);
      const result = parseResponse(await tools.getRecentlyWatched());
      expect(result.recentlyWatched[0]).toMatchObject(episodeFields);
    });

    it("getWatchHistory keeps show info when it falls back to library metadata", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
        if (path === "/status/sessions/history/all") throw new Error("history unavailable");
        if (path === "/library/sections") return { MediaContainer: { Directory: [{ key: "2", title: "TV" }] } };
        return { MediaContainer: { Metadata: [{ ...episode, lastViewedAt: 1000, viewCount: 1 }] } };
      });
      const result = parseResponse(await tools.getWatchHistory());
      expect(result.note).toBe("Generated from library metadata (fallback method)");
      expect(result.watchHistory[0]).toMatchObject(episodeFields);
    });
  });

  describe("getWatchHistory", () => {
    it("sorts the history request by a field Plex accepts", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: [] } });

      await tools.getWatchHistory(25, "7");
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("/status/sessions/history/all");
      // Plex answers HTTP 400 to sort=date:desc; its documented example is viewedAt:desc.
      expect(call[1]).toMatchObject({ sort: "viewedAt:desc", "X-Plex-Container-Size": 25, accountID: "7" });
    });

    it("sends the paging pair Plex needs to honour the limit", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: [] } });

      await tools.getWatchHistory(25);
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      // Plex returns the whole history (12k entries on a real server) when only Size is sent.
      expect(call[1]).toMatchObject({ "X-Plex-Container-Start": 0, "X-Plex-Container-Size": 25 });
    });

    describe("library fallback", () => {
      const item = (ratingKey: string, viewOffset?: number) => ({
        ratingKey, title: `Movie ${ratingKey}`, type: "movie", year: 2020, lastViewedAt: 1000, viewCount: 1, duration: 7200000, ...(viewOffset === undefined ? {} : { viewOffset }),
      });

      it("marks a show completed only when every episode is watched", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          const show = (ratingKey: string, viewedLeafCount: number) => ({ ratingKey, title: ratingKey, type: "show", lastViewedAt: 1000, viewCount: 9, duration: 1440000, leafCount: 10, viewedLeafCount });
          (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (requestPath: string) => {
            if (requestPath === "/status/sessions/history/all") throw new Error("history unavailable");
            if (requestPath === "/library/sections") return { MediaContainer: { Directory: [{ key: "2", title: "TV" }] } };
            return { MediaContainer: { Metadata: [show("all", 10), show("partly", 4)] } };
          });

          const result = parseResponse(await tools.getWatchHistory());
          const byKey = Object.fromEntries(result.watchHistory.map((entry: { ratingKey: string }) => [entry.ratingKey, entry]));
          expect(byKey.all).toMatchObject({ completed: true, progress: 100 });
          // Shows have no viewOffset, so progress comes from the episodes watched.
          expect(byKey.partly).toMatchObject({ completed: false, progress: 40 });
        } finally {
          errorSpy.mockRestore();
        }
      });

      it("marks finished items completed although Plex sends no viewOffset for them", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
          (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (requestPath: string) => {
            if (requestPath === "/status/sessions/history/all") throw new Error("history unavailable");
            if (requestPath === "/library/sections") return { MediaContainer: { Directory: [{ key: "1", title: "Movies" }] } };
            return { MediaContainer: { Metadata: [item("finished"), item("almost", 7200000 * 0.95), item("halfway", 7200000 * 0.5)] } };
          });

          const result = parseResponse(await tools.getWatchHistory());
          const byKey = Object.fromEntries(result.watchHistory.map((entry: { ratingKey: string }) => [entry.ratingKey, entry]));
          expect(byKey.finished).toMatchObject({ completed: true, progress: 100 });
          expect(byKey.almost).toMatchObject({ completed: true, progress: 95 });
          expect(byKey.halfway).toMatchObject({ completed: false, progress: 50 });
        } finally {
          errorSpy.mockRestore();
        }
      });
    });

    describe("when the history endpoint fails", () => {
      let errorSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      });

      afterEach(() => {
        errorSpy.mockRestore();
      });

      it("logs the failure to stderr and falls back to library metadata", async () => {
        (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
          if (path === "/status/sessions/history/all") throw new Error("Request failed with status code 400");
          if (path === "/library/sections") return { MediaContainer: { Directory: [] } };
          throw new Error(`unexpected ${path}`);
        });

        const result = parseResponse(await tools.getWatchHistory());
        expect(result.totalSessions).toBe(0);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Request failed with status code 400"));
      });

      it("logs both failures when the library fallback fails too", async () => {
        (client.makeRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("connection refused"));

        const result = parseResponse(await tools.getWatchHistory());
        expect(result.error).toBe("Watch history not available");
        expect(errorSpy).toHaveBeenCalledTimes(2);
        expect(errorSpy).toHaveBeenLastCalledWith(expect.stringContaining("library fallback failed: connection refused"));
      });
    });
  });

  describe("getRecentlyWatched", () => {
    const ORIGINAL_OUTPUT_FORMAT = process.env.PLEX_OUTPUT_FORMAT;

    afterEach(() => {
      if (ORIGINAL_OUTPUT_FORMAT === undefined) {
        delete process.env.PLEX_OUTPUT_FORMAT;
      } else {
        process.env.PLEX_OUTPUT_FORMAT = ORIGINAL_OUTPUT_FORMAT;
      }
    });

    const history = [1, 2, 3].map((n) => ({
      ratingKey: String(n),
      title: `Movie ${n}`,
      type: "movie",
      year: 2020,
      viewedAt: 1000 - n,
      duration: 100,
      viewOffset: 100,
    }));

    it("uses the watch history whatever the output format", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: history } });

      delete process.env.PLEX_OUTPUT_FORMAT;
      const json = parseResponse(await tools.getRecentlyWatched());

      process.env.PLEX_OUTPUT_FORMAT = "toon";
      const toonText = (await tools.getRecentlyWatched()).content[0].text;
      expect(() => JSON.parse(toonText)).toThrow(); // really is TOON, not JSON
      const toon = decode(toonText) as typeof json;

      expect(json.note).toBe("Retrieved from watch history data");
      expect(json.totalCount).toBe(3);
      expect(toon).toEqual(json);
    });

    it("falls back to library metadata when the history endpoint fails", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
        if (path === "/status/sessions/history/all") throw new Error("history unavailable");
        if (path === "/library/sections") return { MediaContainer: { Directory: [{ key: "2", title: "TV" }] } };
        return { MediaContainer: { Metadata: [{ ratingKey: "1", title: "Pilot", type: "episode", grandparentTitle: "Breaking Bad", grandparentRatingKey: "100", parentIndex: 1, index: 4, lastViewedAt: 1000, viewCount: 1, duration: 100 }] } };
      });

      const result = parseResponse(await tools.getRecentlyWatched(10, "episode"));
      expect(result.note).toBe("Retrieved from library metadata");
      expect(result.totalCount).toBe(1);
      expect(result.recentlyWatched[0]).toMatchObject({ showTitle: "Breaking Bad", showRatingKey: "100", seasonNumber: 1, episodeNumber: 4 });
    });

    it("reports a partly watched show's progress from its episodes in the fallback", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
        if (path === "/status/sessions/history/all") throw new Error("history unavailable");
        if (path === "/library/sections") return { MediaContainer: { Directory: [{ key: "2", title: "TV" }] } };
        return { MediaContainer: { Metadata: [{ ratingKey: "9", title: "Show", type: "show", lastViewedAt: 1000, viewCount: 4, leafCount: 10, viewedLeafCount: 4 }] } };
      });

      const result = parseResponse(await tools.getRecentlyWatched(10, "show"));
      expect(result.recentlyWatched[0].progress).toBe(40);
    });

    it("logs the history failure to stderr when it falls back", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        (client.makeRequest as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
          if (path === "/status/sessions/history/all") throw new Error("Request failed with status code 400");
          return { MediaContainer: { Directory: [] } };
        });

        await tools.getRecentlyWatched();
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Request failed with status code 400"));
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe("getFullyWatched", () => {
    // Plex omits viewOffset from finished items, so these have none.
    const finished = (n: number) => ({ ratingKey: String(n), title: `Movie ${n}`, type: "movie", year: 2020, viewCount: 1, lastViewedAt: 2000 - n, duration: 7200000 });

    it("asks Plex for watched items that are not in progress, newest first", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: [] } });

      await tools.getFullyWatched("1", "movie", 5);
      const call = (client.makeRequest as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toBe("/library/sections/1/all");
      // The same query as Plex's own "Recently Watched" hub, plus the paging pair Plex needs to honour the size.
      expect(call[1]).toMatchObject({
        unwatched: 0,
        viewOffset: 0,
        sort: "lastViewedAt:desc",
        type: 1,
        "X-Plex-Container-Start": 0,
        "X-Plex-Container-Size": 10,
      });
    });

    it("returns finished items although Plex sends no viewOffset for them", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: [finished(1), finished(2)] } });

      const result = parseResponse(await tools.getFullyWatched("1", "movie"));
      expect(result.totalCount).toBe(2);
      expect(result.fullyWatched.map((item: { ratingKey: string }) => item.ratingKey)).toEqual(["1", "2"]);
      expect(result.fullyWatched[0].completionPercent).toBe(100);
    });

    it("keeps shows and seasons only when every episode is watched", async () => {
      const container = (ratingKey: string, leafCount: number, viewedLeafCount?: number) =>
        ({ ratingKey, title: ratingKey, type: "show", viewCount: 5, leafCount, viewedLeafCount });
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: { Metadata: [container("all", 10, 10), container("partly", 10, 4), container("none", 10), container("empty", 0, 0)] },
      });

      const result = parseResponse(await tools.getFullyWatched("2", "show"));
      expect(result.fullyWatched.map((item: { ratingKey: string }) => item.ratingKey)).toEqual(["all"]);
    });

    it("returns no more than the limit", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ MediaContainer: { Metadata: [1, 2, 3, 4, 5, 6].map(finished) } });

      const result = parseResponse(await tools.getFullyWatched("1", "movie", 3));
      expect(result.fullyWatched).toHaveLength(3);
    });
  });

  /**
   * createPlaylist — issue #48
   *
   * Previously, calling create_playlist without ratingKeys silently flipped smart=true
   * then POSTed /playlists with no `uri` param, which Plex rejects with 400.
   *
   * The python-plexapi reference implementation always sends a `uri` — regular playlists
   * use /library/metadata/{comma-joined ratingKeys}, smart playlists use a section search key.
   * Empty playlist creation is not supported by the Plex API at all.
   *
   * These tests lock in:
   *   - strict validation (no silent intent flipping)
   *   - comma-joined multi-item seeding (single POST, no follow-up addToPlaylist calls)
   *   - smart playlist support via librarySectionId / libtype / smartFilter
   */
  describe("createPlaylist", () => {
    const MACHINE_ID = "abc123machineid";
    const ORIGINAL_MUTATIVE_ENV = process.env.PLEX_ENABLE_MUTATIVE_OPS;

    /**
     * Mock dispatcher that routes /identity and /playlists requests separately.
     * Keeps a reference to the mock so tests can assert call arguments.
     */
    function wirePlaylistMocks(
      playlistResponse: Record<string, unknown> = {
        MediaContainer: {
          Metadata: [{ ratingKey: "99", title: "Created", leafCount: 0 }],
        },
      }
    ) {
      const mock = client.makeRequest as ReturnType<typeof vi.fn>;
      mock.mockImplementation(async (endpoint: string) => {
        if (endpoint === "/identity") {
          return { MediaContainer: { machineIdentifier: MACHINE_ID } };
        }
        if (endpoint === "/playlists") {
          return playlistResponse;
        }
        throw new Error(`Unexpected endpoint in test: ${endpoint}`);
      });
      return mock;
    }

    beforeEach(() => {
      process.env.PLEX_ENABLE_MUTATIVE_OPS = "true";
    });

    afterEach(() => {
      if (ORIGINAL_MUTATIVE_ENV === undefined) {
        delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
      } else {
        process.env.PLEX_ENABLE_MUTATIVE_OPS = ORIGINAL_MUTATIVE_ENV;
      }
    });

    it("rejects when mutative ops are disabled", async () => {
      delete process.env.PLEX_ENABLE_MUTATIVE_OPS;
      wirePlaylistMocks();

      await expect(
        tools.createPlaylist("My Playlist", "audio", { ratingKeys: ["1"] })
      ).rejects.toThrow(/PLEX_ENABLE_MUTATIVE_OPS/);
    });

    it("rejects non-smart creation with no ratingKeys (issue #48 regression)", async () => {
      wirePlaylistMocks();

      await expect(
        tools.createPlaylist("Test-Playlist-Debug", "audio", { smart: false })
      ).rejects.toThrow(/ratingKeys.*required|cannot create empty/i);
    });

    it("rejects non-smart creation with empty ratingKeys array", async () => {
      wirePlaylistMocks();

      await expect(
        tools.createPlaylist("Empty", "video", { smart: false, ratingKeys: [] })
      ).rejects.toThrow(/ratingKeys.*required|cannot create empty/i);
    });

    it("rejects smart playlist creation without librarySectionId", async () => {
      wirePlaylistMocks();

      await expect(
        tools.createPlaylist("Smart One", "audio", { smart: true })
      ).rejects.toThrow(/librarySectionId.*required/i);
    });

    it("POSTs single-item non-smart playlist with correct uri", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Solo", "video", { ratingKeys: ["42"] });

      const postCall = mock.mock.calls.find((call) => call[0] === "/playlists");
      expect(postCall).toBeDefined();
      const params = postCall![1] as Record<string, unknown>;
      const method = postCall![2];

      expect(method).toBe("POST");
      expect(params.title).toBe("Solo");
      expect(params.type).toBe("video");
      expect(params.smart).toBe(0);
      expect(params.uri).toBe(
        `server://${MACHINE_ID}/com.plexapp.plugins.library/library/metadata/42`
      );
    });

    it("seeds multiple ratingKeys in one POST via comma-joined uri (no follow-up calls)", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Album", "audio", {
        ratingKeys: ["10", "20", "30"],
      });

      const playlistCalls = mock.mock.calls.filter((call) => call[0] === "/playlists");
      // Exactly one POST to /playlists — no follow-up addToPlaylist calls
      expect(playlistCalls).toHaveLength(1);

      const params = playlistCalls[0]![1] as Record<string, unknown>;
      expect(params.uri).toBe(
        `server://${MACHINE_ID}/com.plexapp.plugins.library/library/metadata/10,20,30`
      );
      expect(params.smart).toBe(0);

      // Ensure no /playlists/{id}/items calls were made
      const addItemCalls = mock.mock.calls.filter((call) =>
        String(call[0]).match(/^\/playlists\/.+\/items$/)
      );
      expect(addItemCalls).toHaveLength(0);
    });

    it("maps movie/show/episode type to video playlist type", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Show Binge", "show", { ratingKeys: ["1"] });

      const params = mock.mock.calls.find((c) => c[0] === "/playlists")![1] as Record<
        string,
        unknown
      >;
      expect(params.type).toBe("video");
    });

    it("creates smart playlist with librarySectionId only", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Smart Music", "audio", {
        smart: true,
        librarySectionId: "7",
      });

      const params = mock.mock.calls.find((c) => c[0] === "/playlists")![1] as Record<
        string,
        unknown
      >;
      expect(params.smart).toBe(1);
      expect(params.type).toBe("audio");
      // URI points at the library section search endpoint
      const uri = String(params.uri);
      expect(uri).toContain(`server://${MACHINE_ID}/com.plexapp.plugins.library`);
      expect(uri).toContain("/library/sections/7/all");
      // Default libtype for audio playlist is track (type=10)
      expect(uri).toContain("type=10");
    });

    it("smart playlist respects explicit libtype", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Smart Shows", "video", {
        smart: true,
        librarySectionId: "1",
        libtype: "show",
      });

      const params = mock.mock.calls.find((c) => c[0] === "/playlists")![1] as Record<
        string,
        unknown
      >;
      const uri = String(params.uri);
      // show → type=2
      expect(uri).toContain("type=2");
    });

    it("smart playlist appends raw smartFilter query string", async () => {
      const mock = wirePlaylistMocks();

      await tools.createPlaylist("Recent Dramas", "video", {
        smart: true,
        librarySectionId: "1",
        libtype: "movie",
        smartFilter: "genre=Drama&year>=2020&sort=titleSort:asc&limit=100",
      });

      const params = mock.mock.calls.find((c) => c[0] === "/playlists")![1] as Record<
        string,
        unknown
      >;
      const uri = String(params.uri);
      expect(uri).toContain("/library/sections/1/all");
      expect(uri).toContain("type=1"); // movie
      expect(uri).toContain("genre=Drama");
      expect(uri).toContain("year>=2020");
      expect(uri).toContain("sort=titleSort:asc");
      expect(uri).toContain("limit=100");
    });

    it("rejects smart playlist with ratingKeys (mutually exclusive modes)", async () => {
      wirePlaylistMocks();

      await expect(
        tools.createPlaylist("Confused", "audio", {
          smart: true,
          librarySectionId: "1",
          ratingKeys: ["1", "2"],
        })
      ).rejects.toThrow(/mutually exclusive|cannot.*both/i);
    });
  });
});
