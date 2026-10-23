import { describe, expect, it, vi } from "vitest";
import { PlexClient } from "../plex/client.js";
import { PLEX_CONTAINER_SIZE } from "../plex/constants.js";
import { PlexToTraktMapper } from "../trakt/mapper.js";

const page = { "X-Plex-Container-Size": PLEX_CONTAINER_SIZE };

const MOVIES = {
  MediaContainer: {
    size: 3,
    totalSize: 3,
    identifier: "com.plexapp.plugins.library",
    mediaTagPrefix: "/system/bundle/media/flags/",
    Metadata: [
      {
        ratingKey: "15234",
        key: "/library/metadata/15234",
        guid: "plex://movie/5d7768ba96b655001fdc0408",
        type: "movie",
        title: "The Matrix",
        summary: "A computer hacker learns about the true nature of reality.",
        year: 1999,
        duration: 8172000,
        viewCount: 2,
        lastViewedAt: 1728000000,
        addedAt: 1600000000,
        updatedAt: 1728000000,
        Guid: [
          { id: "imdb://tt0133093" },
          { id: "tmdb://603" },
          { id: "tvdb://169" },
        ],
        Genre: [{ tag: "Action" }, { tag: "Science Fiction" }],
      },
      {
        ratingKey: "15235",
        key: "/library/metadata/15235",
        guid: "plex://movie/5d77682496b655001fdc03a1",
        type: "movie",
        title: "Unwatched",
        year: 2001,
        viewCount: 0,
        Guid: [{ id: "imdb://tt0245429" }],
      },
      {
        ratingKey: "42",
        key: "/library/metadata/42",
        guid: "com.plexapp.agents.imdb://tt0111161?lang=en",
        type: "movie",
        title: "The Shawshank Redemption",
        year: 1994,
        duration: 8520000,
        viewCount: 1,
        lastViewedAt: 1710000000,
        addedAt: 1590000000,
        updatedAt: 1710000000,
        Guid: null,
        Genre: [{ tag: "Drama" }],
      },
    ],
  },
};

const SECTIONS = {
  MediaContainer: {
    size: 2,
    Directory: [
      { key: "1", type: "movie", title: "Movies", agent: "tv.plex.agents.movie" },
      { key: "2", type: "show", title: "TV Shows", agent: "tv.plex.agents.series" },
    ],
  },
};

const SHOWS = {
  MediaContainer: {
    size: 3,
    librarySectionID: 2,
    librarySectionTitle: "TV Shows",
    viewGroup: "show",
    Metadata: [
      {
        ratingKey: "100",
        key: "/library/metadata/100",
        guid: "plex://show/5d9c086fe9d5a1001f4d14a6",
        type: "show",
        title: "Breaking Bad",
        year: 2008,
        Guid: [
          { id: "imdb://tt0903747" },
          { id: "tmdb://1396" },
          { id: "tvdb://81189" },
        ],
      },
      {
        ratingKey: "200",
        key: "/library/metadata/200",
        guid: "plex://show/5d9c0874e98e47001ebcc3c2",
        type: "show",
        title: "The Office",
        year: 2005,
        Guid: [
          { id: "imdb://tt0386676" },
          { id: "tmdb://2316" },
          { id: "tvdb://73244" },
        ],
      },
      {
        ratingKey: "2999",
        key: "/library/metadata/2999",
        guid: "local://2999",
        type: "show",
        title: "Home Videos",
        year: 2020,
        Guid: null,
      },
    ],
  },
};

const EPISODES = {
  MediaContainer: {
    size: 4,
    librarySectionID: 2,
    librarySectionTitle: "TV Shows",
    viewGroup: "episode",
    Metadata: [
      {
        ratingKey: "5678",
        key: "/library/metadata/5678",
        guid: "plex://episode/5d9c09e3e98e47001ebcc6e5",
        type: "episode",
        title: "Pilot",
        parentRatingKey: "101",
        grandparentRatingKey: "100",
        parentIndex: 1,
        index: 1,
        grandparentTitle: "Breaking Bad",
        grandparentYear: 2008,
        grandparentGuid: "plex://show/5d9c086fe9d5a1001f4d14a6",
        duration: 3480000,
        viewCount: 1,
        lastViewedAt: 1728000000,
        Guid: [
          { id: "imdb://tt0959621" },
          { id: "tmdb://62085" },
          { id: "tvdb://349232" },
        ],
      },
      {
        ratingKey: "5679",
        key: "/library/metadata/5679",
        guid: "plex://episode/5d9c09e3e98e47001ebcc6e6",
        type: "episode",
        title: "Cat's in the Bag...",
        grandparentRatingKey: "100",
        parentIndex: 1,
        index: 2,
        grandparentTitle: "Breaking Bad",
        grandparentGuid: "plex://show/5d9c086fe9d5a1001f4d14a6",
        viewCount: 0,
        Guid: [{ id: "imdb://tt0959622" }],
      },
      {
        ratingKey: "6100",
        key: "/library/metadata/6100",
        guid: "plex://episode/5d9c14a0e98e47001ebcf0aa",
        type: "episode",
        title: "Pilot",
        grandparentRatingKey: "200",
        parentIndex: 1,
        index: 1,
        grandparentTitle: "The Office",
        grandparentYear: 2005,
        grandparentGuid: "plex://show/5d9c0874e98e47001ebcc3c2",
        duration: 1320000,
        viewCount: 4,
        lastViewedAt: 1715000000,
        Guid: [
          { id: "imdb://tt0664521" },
          { id: "tmdb://845887" },
          { id: "tvdb://314062" },
        ],
      },
      {
        ratingKey: "3001",
        key: "/library/metadata/3001",
        guid: "local://3001",
        type: "episode",
        title: "Family Vacation",
        parentRatingKey: "3000",
        grandparentRatingKey: "2999",
        parentGuid: "local://3000",
        grandparentGuid: "local://2999",
        parentIndex: 1,
        index: 2,
        parentTitle: "Season 1",
        grandparentTitle: "Home Videos",
        grandparentYear: 2020,
        duration: 120000,
        viewCount: 1,
        lastViewedAt: 1710000000,
        Guid: null,
      },
    ],
  },
};

describe("PlexClient watched items include external GUIDs", () => {
  it("requests includeGuids=1 for watched movies and passes Guid through", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockResolvedValue(MOVIES);

    const movies = await client.getWatchedMovies();

    expect(request).toHaveBeenCalledWith("/library/all", { type: 1, includeGuids: 1, ...page });
    expect(movies.map((movie) => movie.title)).toEqual([
      "The Matrix",
      "The Shawshank Redemption",
    ]);
    expect(movies[0]).toEqual({
      ratingKey: "15234",
      title: "The Matrix",
      year: 1999,
      guid: "plex://movie/5d7768ba96b655001fdc0408",
      Guid: [
        { id: "imdb://tt0133093" },
        { id: "tmdb://603" },
        { id: "tvdb://169" },
      ],
      duration: 8172000,
      viewCount: 2,
      lastViewedAt: 1728000000,
      addedAt: 1600000000,
      updatedAt: 1728000000,
      genres: ["Action", "Science Fiction"],
      summary: "A computer hacker learns about the true nature of reality.",
    });
    expect(movies[1].guid).toBe("com.plexapp.agents.imdb://tt0111161?lang=en");
    expect(movies[1].Guid).toBeUndefined();
  });

  it("loads show Guids with type=2 and matches them by grandparentRatingKey", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    const request = vi.spyOn(client, "makeRequest").mockImplementation(async (endpoint, params) => {
      if (endpoint === "/library/sections") return SECTIONS;
      if (endpoint === "/library/sections/2/all" && params?.type === 2) return SHOWS;
      if (endpoint === "/library/sections/2/all" && params?.type === 4) return EPISODES;
      throw new Error(`unexpected ${endpoint} ${JSON.stringify(params)}`);
    });

    const episodes = await client.getWatchedEpisodes();

    expect(request).toHaveBeenNthCalledWith(1, "/library/sections");
    expect(request).toHaveBeenNthCalledWith(2, "/library/sections/2/all", {
      type: 2,
      includeGuids: 1,
      ...page,
    });
    expect(request).toHaveBeenNthCalledWith(3, "/library/sections/2/all", {
      type: 4,
      includeGuids: 1,
      ...page,
    });
    expect(request).not.toHaveBeenCalledWith(
      "/library/sections/1/all",
      expect.anything()
    );
    expect(episodes.map((episode) => episode.ratingKey)).toEqual(["5678", "6100", "3001"]);

    const breakingBad = episodes[0];
    expect(breakingBad.guid).toBe("plex://episode/5d9c09e3e98e47001ebcc6e5");
    expect(breakingBad.Guid).toEqual([
      { id: "imdb://tt0959621" },
      { id: "tmdb://62085" },
      { id: "tvdb://349232" },
    ]);
    expect(breakingBad.show).toEqual({
      ratingKey: "100",
      title: "Breaking Bad",
      year: 2008,
      guid: "plex://show/5d9c086fe9d5a1001f4d14a6",
      Guid: [
        { id: "imdb://tt0903747" },
        { id: "tmdb://1396" },
        { id: "tvdb://81189" },
      ],
    });

    expect(episodes[1].show).toMatchObject({
      ratingKey: "200",
      title: "The Office",
      Guid: [
        { id: "imdb://tt0386676" },
        { id: "tmdb://2316" },
        { id: "tvdb://73244" },
      ],
    });
    expect(episodes[1].Guid).toEqual([
      { id: "imdb://tt0664521" },
      { id: "tmdb://845887" },
      { id: "tvdb://314062" },
    ]);
  });

  it("returns a local:// episode with no Guid so validation can reject it", async () => {
    const client = new PlexClient({ baseUrl: "http://localhost:32400", token: "test-token" });
    vi.spyOn(client, "makeRequest").mockImplementation(async (endpoint, params) => {
      if (endpoint === "/library/sections") return SECTIONS;
      if (params?.type === 2) return SHOWS;
      if (params?.type === 4) return EPISODES;
      throw new Error(`unexpected ${endpoint}`);
    });

    const episodes = await client.getWatchedEpisodes();
    const local = episodes.find((episode) => episode.guid === "local://3001");
    expect(local).toMatchObject({
      ratingKey: "3001",
      title: "Family Vacation",
      seasonNumber: 1,
      episodeNumber: 2,
      guid: "local://3001",
      show: {
        ratingKey: "2999",
        title: "Home Videos",
        guid: "local://2999",
      },
    });
    expect(local?.Guid).toBeUndefined();
    expect(local?.show?.Guid).toBeUndefined();

    const mapper = new PlexToTraktMapper();
    expect(() => mapper.validatePlexItemForSync(local!)).not.toThrow();
    expect(mapper.validatePlexItemForSync(local!)).toEqual({
      valid: false,
      errors: ["No external IDs found (IMDB, TMDB, or TVDB required)"],
    });
  });
});
