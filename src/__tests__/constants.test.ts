import { describe, it, expect } from "vitest";
import { DEFAULT_LIMITS, SUMMARY_PREVIEW_LENGTH, PLEX_TYPE_IDS, PLEX_CONTAINER_SIZE } from "../plex/constants.js";
import { ARR_PREVIEW_LIMIT, ARR_DEFAULT_PAGE_SIZE } from "../arr/constants.js";
import { TRAKT_PREVIEW_LIMIT } from "../trakt/constants.js";

describe("Plex DEFAULT_LIMITS", () => {
  it("searchMedia defaults to 500", () => {
    expect(DEFAULT_LIMITS.searchMedia).toBe(500);
  });

  it("watchHistory defaults to 500", () => {
    expect(DEFAULT_LIMITS.watchHistory).toBe(500);
  });

  it("recentlyWatched defaults to 100", () => {
    expect(DEFAULT_LIMITS.recentlyWatched).toBe(100);
  });

  it("recentlyAdded defaults to 50", () => {
    expect(DEFAULT_LIMITS.recentlyAdded).toBe(50);
  });

  it("fullyWatched defaults to 500", () => {
    expect(DEFAULT_LIMITS.fullyWatched).toBe(500);
  });

  it("libraryItems defaults to 1000", () => {
    expect(DEFAULT_LIMITS.libraryItems).toBe(1000);
  });

  it("popularContent defaults to 50", () => {
    expect(DEFAULT_LIMITS.popularContent).toBe(50);
  });

  it("exportPageSize defaults to 500", () => {
    expect(DEFAULT_LIMITS.exportPageSize).toBe(500);
  });

  it("all limits are positive integers", () => {
    for (const [key, value] of Object.entries(DEFAULT_LIMITS)) {
      expect(value, `${key} should be positive`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
    }
  });
});

describe("SUMMARY_PREVIEW_LENGTH", () => {
  it("is 500 characters", () => {
    expect(SUMMARY_PREVIEW_LENGTH).toBe(500);
  });
});

describe("PLEX_CONTAINER_SIZE", () => {
  it("is 1000", () => {
    expect(PLEX_CONTAINER_SIZE).toBe(1000);
  });
});

describe("PLEX_TYPE_IDS", () => {
  it("maps all expected media types", () => {
    expect(PLEX_TYPE_IDS.movie).toBe(1);
    expect(PLEX_TYPE_IDS.show).toBe(2);
    expect(PLEX_TYPE_IDS.episode).toBe(4);
    expect(PLEX_TYPE_IDS.artist).toBe(8);
    expect(PLEX_TYPE_IDS.album).toBe(9);
    expect(PLEX_TYPE_IDS.track).toBe(10);
  });

  it("has exactly 6 entries", () => {
    expect(Object.keys(PLEX_TYPE_IDS)).toHaveLength(6);
  });
});

describe("Arr constants", () => {
  it("ARR_PREVIEW_LIMIT is 200", () => {
    expect(ARR_PREVIEW_LIMIT).toBe(200);
  });

  it("ARR_DEFAULT_PAGE_SIZE is 200", () => {
    expect(ARR_DEFAULT_PAGE_SIZE).toBe(200);
  });
});

describe("Trakt constants", () => {
  it("TRAKT_PREVIEW_LIMIT is 100", () => {
    expect(TRAKT_PREVIEW_LIMIT).toBe(100);
  });
});
