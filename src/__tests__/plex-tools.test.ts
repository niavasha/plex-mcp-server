import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { SUMMARY_PREVIEW_LENGTH, DEFAULT_LIMITS } from "../plex/constants.js";

/** Create a mock PlexClient without hitting any real server */
function createMockClient() {
  return {
    makeRequest: vi.fn(),
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
    it("truncates summaries", async () => {
      (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
        MediaContainer: {
          Metadata: [
            { ratingKey: "1", title: "Watchlist Item", type: "movie", year: 2024, summary: LONG_SUMMARY, addedAt: 1000 },
          ],
        },
      });

      const result = parseResponse(await tools.getWatchlist());
      expect(result.watchlist[0].summary.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
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
});
