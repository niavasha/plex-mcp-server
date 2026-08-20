import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    getPlexTypeId: vi.fn((type: string) => {
      const ids: Record<string, number> = { movie: 1, show: 2, episode: 4 };
      return ids[type] || 1;
    }),
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
