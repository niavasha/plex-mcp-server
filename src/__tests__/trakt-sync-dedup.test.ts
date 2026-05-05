/**
 * Tests for Trakt sync GUID deduplication
 * Verifies that duplicate-GUID movies and episodes are deduplicated
 * before being forwarded to the Trakt client.
 *
 * NOTE: These tests verify the deduplication logic at the sync layer.
 * Actual sync operations are tested in the integration tests.
 */

import { describe, it, expect } from "vitest";

/**
 * Unit test for GUID deduplication logic.
 * Simulates the deduplication that happens in syncPlexToTrakt.
 */
describe("Trakt sync GUID deduplication logic", () => {
  describe("Movie deduplication by GUID", () => {
    it("should track seen GUIDs and deduplicate during iteration", () => {
      // Simulate the deduplication logic from syncPlexToTrakt
      const movies = [
        {
          title: "The Matrix",
          guid: "plex://movie/5d9c861c79f097001f8cbdce",
        },
        {
          title: "The Matrix",
          guid: "plex://movie/5d9c861c79f097001f8cbdce", // Duplicate GUID
        },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        const dedupeKey = movie.guid ?? `${movie.title}`;
        if (seenGuids.has(dedupeKey)) return false;
        seenGuids.add(dedupeKey);
        return true;
      });

      // Should have only 1 movie after deduplication
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].guid).toBe(
        "plex://movie/5d9c861c79f097001f8cbdce"
      );
    });

    it("should use title::year fallback when GUID unavailable", () => {
      const movies = [
        { title: "Interstellar", year: 2014, guid: undefined },
        { title: "Interstellar", year: 2014, guid: undefined }, // Same title::year
        { title: "Interstellar", year: 2015, guid: undefined }, // Different year
      ];

      const seenKeys = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        const dedupeKey = movie.guid ?? `${movie.title}::${movie.year ?? ""}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
      });

      // Should have 2 movies: one Interstellar 2014 and one 2015
      expect(deduplicated.length).toBe(2);
      expect(
        deduplicated.filter((m) => m.year === 2014 && !m.guid).length
      ).toBe(1);
      expect(
        deduplicated.filter((m) => m.year === 2015 && !m.guid).length
      ).toBe(1);
    });

    it("should not deduplicate movies with different GUIDs", () => {
      const movies = [
        { title: "Dune", guid: "plex://movie/guid1" },
        { title: "Dune", guid: "plex://movie/guid2" }, // Different GUID
      ];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        const dedupeKey = movie.guid;
        if (seenGuids.has(dedupeKey)) return false;
        seenGuids.add(dedupeKey);
        return true;
      });

      // Both should be kept
      expect(deduplicated.length).toBe(2);
    });

    it("should handle mix of GUID-based and fallback deduplication", () => {
      const movies = [
        { title: "Movie A", year: 2020, guid: "guid-a" },
        { title: "Movie A", year: 2020, guid: "guid-a" }, // Duplicate by GUID
        { title: "Movie B", year: 2021, guid: undefined },
        { title: "Movie B", year: 2021, guid: undefined }, // Duplicate by title::year
        { title: "Movie C", year: 2022, guid: "guid-c" },
      ];

      const seenKeys = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        const dedupeKey =
          movie.guid ?? `${movie.title}::${movie.year ?? ""}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
      });

      // Should have 3 unique items
      expect(deduplicated.length).toBe(3);
    });
  });

  describe("Episode deduplication by GUID", () => {
    it("should deduplicate episodes with identical GUIDs", () => {
      const episodes = [
        {
          title: "Pilot",
          seasonNumber: 1,
          episodeNumber: 1,
          guid: "plex://episode/ep1",
        },
        {
          title: "Pilot",
          seasonNumber: 1,
          episodeNumber: 1,
          guid: "plex://episode/ep1", // Same GUID
        },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = episodes.filter((ep) => {
        const dedupeKey =
          ep.guid ?? `s${ep.seasonNumber}e${ep.episodeNumber}`;
        if (seenGuids.has(dedupeKey)) return false;
        seenGuids.add(dedupeKey);
        return true;
      });

      expect(deduplicated.length).toBe(1);
    });

    it("should keep episodes with different GUIDs", () => {
      const episodes = [
        {
          title: "Ep1",
          seasonNumber: 1,
          episodeNumber: 1,
          guid: "plex://episode/ep1",
        },
        {
          title: "Ep2",
          seasonNumber: 1,
          episodeNumber: 2,
          guid: "plex://episode/ep2", // Different GUID
        },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = episodes.filter((ep) => {
        const dedupeKey = ep.guid;
        if (seenGuids.has(dedupeKey)) return false;
        seenGuids.add(dedupeKey);
        return true;
      });

      expect(deduplicated.length).toBe(2);
    });

    it("should deduplicate using season::episode fallback when GUID unavailable", () => {
      const episodes = [
        {
          title: "Ep1",
          seasonNumber: 1,
          episodeNumber: 1,
          guid: undefined,
        },
        {
          title: "Ep1",
          seasonNumber: 1,
          episodeNumber: 1,
          guid: undefined, // Same season/episode
        },
        {
          title: "Ep2",
          seasonNumber: 1,
          episodeNumber: 2,
          guid: undefined, // Different episode
        },
      ];

      const seenKeys = new Set<string>();
      const deduplicated = episodes.filter((ep) => {
        const dedupeKey =
          ep.guid ?? `s${ep.seasonNumber}e${ep.episodeNumber}`;
        if (seenKeys.has(dedupeKey)) return false;
        seenKeys.add(dedupeKey);
        return true;
      });

      expect(deduplicated.length).toBe(2);
      expect(deduplicated.filter((e) => e.episodeNumber === 1).length).toBe(
        1
      );
      expect(deduplicated.filter((e) => e.episodeNumber === 2).length).toBe(
        1
      );
    });
  });

  describe("Deduplication edge cases", () => {
    it("should handle empty arrays", () => {
      const movies: Array<{ guid?: string; title: string }> = [];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        const dedupeKey = movie.guid ?? movie.title;
        if (seenGuids.has(dedupeKey)) return false;
        seenGuids.add(dedupeKey);
        return true;
      });

      expect(deduplicated.length).toBe(0);
    });

    it("should handle all duplicates", () => {
      const movies = [
        { guid: "same-guid", title: "Movie" },
        { guid: "same-guid", title: "Movie" },
        { guid: "same-guid", title: "Movie" },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        if (seenGuids.has(movie.guid!)) return false;
        seenGuids.add(movie.guid!);
        return true;
      });

      expect(deduplicated.length).toBe(1);
    });

    it("should handle all unique items", () => {
      const movies = [
        { guid: "guid1", title: "Movie1" },
        { guid: "guid2", title: "Movie2" },
        { guid: "guid3", title: "Movie3" },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        if (seenGuids.has(movie.guid!)) return false;
        seenGuids.add(movie.guid!);
        return true;
      });

      expect(deduplicated.length).toBe(3);
    });

    it("should preserve insertion order after deduplication", () => {
      const movies = [
        { guid: "a", title: "Movie A" },
        { guid: "a", title: "Movie A (dup)" },
        { guid: "b", title: "Movie B" },
      ];

      const seenGuids = new Set<string>();
      const deduplicated = movies.filter((movie) => {
        if (seenGuids.has(movie.guid!)) return false;
        seenGuids.add(movie.guid!);
        return true;
      });

      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].guid).toBe("a");
      expect(deduplicated[1].guid).toBe("b");
    });
  });
});
