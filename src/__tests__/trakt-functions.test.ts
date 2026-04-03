import { describe, it, expect, vi, beforeEach } from "vitest";
import { TraktMCPFunctions } from "../trakt/mcp-functions.js";
import { TRAKT_PREVIEW_LIMIT } from "../trakt/constants.js";
import { SUMMARY_PREVIEW_LENGTH } from "../plex/constants.js";

const LONG_OVERVIEW = "C".repeat(1000);

function createMockPlexClient() {
  return {
    getWatchedMovies: vi.fn().mockResolvedValue([]),
    getWatchedEpisodes: vi.fn().mockResolvedValue([]),
    getCurrentSessions: vi.fn().mockResolvedValue([]),
    markAsWatched: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSearchResults(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    type: i % 2 === 0 ? "movie" : "show",
    score: 100 - i,
    movie: i % 2 === 0 ? { title: `Movie ${i}`, year: 2024, ids: { trakt: i }, overview: LONG_OVERVIEW } : undefined,
    show: i % 2 !== 0 ? { title: `Show ${i}`, year: 2024, ids: { trakt: i }, overview: LONG_OVERVIEW } : undefined,
  }));
}

describe("TraktMCPFunctions", () => {
  let trakt: TraktMCPFunctions;

  beforeEach(() => {
    process.env.TRAKT_CLIENT_ID = "test-client-id";
    process.env.TRAKT_CLIENT_SECRET = "test-client-secret";
    const plexClient = createMockPlexClient();
    trakt = new TraktMCPFunctions(plexClient as never);
  });

  describe("traktSearch", () => {
    it("respects custom limit", async () => {
      const results = makeSearchResults(50);
      // Mock the traktClient.search method by initializing then overriding
      // @ts-expect-error — force init for test
      trakt.isInitialized = true;
      // @ts-expect-error — mock traktClient
      trakt.traktClient = { search: vi.fn().mockResolvedValue(results) };

      const result = await trakt.traktSearch("test", undefined, undefined, 10);
      expect((result.results as unknown[]).length).toBe(10);
      expect(result.showing).toBe(10);
      expect(result.totalResults).toBe(50);
    });

    it("defaults to TRAKT_PREVIEW_LIMIT when no limit given", async () => {
      const results = makeSearchResults(200);
      // @ts-expect-error — force init for test
      trakt.isInitialized = true;
      // @ts-expect-error — mock traktClient
      trakt.traktClient = { search: vi.fn().mockResolvedValue(results) };

      const result = await trakt.traktSearch("test");
      expect((result.results as unknown[]).length).toBe(TRAKT_PREVIEW_LIMIT);
    });

    it("truncates overviews", async () => {
      const results = makeSearchResults(1);
      // @ts-expect-error — force init for test
      trakt.isInitialized = true;
      // @ts-expect-error — mock traktClient
      trakt.traktClient = { search: vi.fn().mockResolvedValue(results) };

      const result = await trakt.traktSearch("test");
      const item = (result.results as Array<{ movie?: { overview?: string }; show?: { overview?: string } }>)[0];
      const overview = item.movie?.overview || item.show?.overview || "";
      expect(overview.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });
  });

  describe("traktSyncFromTrakt", () => {
    it("respects TRAKT_PREVIEW_LIMIT for watched items", async () => {
      const movies = Array.from({ length: 200 }, (_, i) => ({
        movie: { title: `Movie ${i}`, year: 2024 },
        plays: 1,
        last_watched_at: "2026-01-01",
      }));
      const shows = Array.from({ length: 200 }, (_, i) => ({
        show: { title: `Show ${i}`, year: 2024 },
        last_watched_at: "2026-01-01",
        seasons: [{ episodes: [{ number: 1 }] }],
      }));

      // @ts-expect-error — force init for test
      trakt.isInitialized = true;
      // @ts-expect-error — mock traktClient
      trakt.traktClient = {
        getWatchedMovies: vi.fn().mockResolvedValue(movies),
        getWatchedShows: vi.fn().mockResolvedValue(shows),
      };

      const result = await trakt.traktSyncFromTrakt();
      expect(result.success).toBe(true);
      const data = result.trakt_data as {
        movies: { items: unknown[]; totalShowing: number };
        shows: { items: unknown[]; totalShowing: number };
      };
      expect(data.movies.items.length).toBe(TRAKT_PREVIEW_LIMIT);
      expect(data.movies.totalShowing).toBe(TRAKT_PREVIEW_LIMIT);
      expect(data.shows.items.length).toBe(TRAKT_PREVIEW_LIMIT);
    });
  });
});
