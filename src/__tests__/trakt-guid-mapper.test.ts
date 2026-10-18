import { describe, expect, it } from "vitest";
import { PlexEpisode, PlexToTraktMapper } from "../trakt/mapper.js";

const MISSING_IDS = "No external IDs found (IMDB, TMDB, or TVDB required)";

describe("PlexToTraktMapper external ids", () => {
  const mapper = new PlexToTraktMapper();

  describe("legacy guid parser", () => {
    it("keeps reading legacy agent guids", () => {
      const movie = mapper.mapPlexMovieToTrakt({
        ratingKey: "1",
        title: "The Shawshank Redemption",
        year: 1994,
        guid: "com.plexapp.agents.imdb://tt0111161?lang=en",
      });
      const tmdbMovie = mapper.mapPlexMovieToTrakt({
        ratingKey: "2",
        title: "The Matrix",
        year: 1999,
        guid: "com.plexapp.agents.themoviedb://603?lang=en",
      });
      const show = mapper.mapPlexShowToTrakt({
        ratingKey: "3",
        title: "Breaking Bad",
        year: 2008,
        guid: "com.plexapp.agents.thetvdb://81189?lang=en",
      });

      expect(movie.ids).toMatchObject({ imdb: "tt0111161" });
      expect(tmdbMovie.ids).toMatchObject({ tmdb: 603 });
      expect(show.ids).toMatchObject({ tvdb: 81189 });
    });

    it("reads tmdb:// and tvdb:// as well as the legacy agent forms", () => {
      const movie = mapper.mapPlexMovieToTrakt({
        ratingKey: "1",
        title: "The Matrix",
        year: 1999,
        guid: "tmdb://603",
      });
      const show = mapper.mapPlexShowToTrakt({
        ratingKey: "2",
        title: "Breaking Bad",
        year: 2008,
        guid: "tvdb://81189",
      });

      expect(movie.ids).toMatchObject({ tmdb: 603 });
      expect(movie.ids.imdb).toBeUndefined();
      expect(show.ids).toMatchObject({ tvdb: 81189 });
    });
  });

  describe("Guid array from includeGuids=1", () => {
    it("maps a plex:// movie from its Guid array", () => {
      const guid = "plex://movie/5d7768ba96b655001fdc0408";
      const Guid = [{ id: "imdb://tt0133093" }, { id: "tmdb://603" }, { id: "tvdb://169" }];
      const movie = mapper.mapPlexMovieToTrakt({
        ratingKey: "15234",
        title: "The Matrix",
        year: 1999,
        guid,
        Guid,
      });

      expect(movie.ids).toMatchObject({ imdb: "tt0133093", tmdb: 603, tvdb: 169 });
      expect(mapper.mapPlexMoviesForSync([
        { ratingKey: "15234", title: "The Matrix", year: 1999, guid, Guid },
      ])).toEqual([
        {
          watched_at: undefined,
          ids: { imdb: "tt0133093", tmdb: 603, tvdb: 169 },
          title: "The Matrix",
          year: 1999,
        },
      ]);
      expect(mapper.validatePlexItemForSync({
        ratingKey: "15234",
        title: "The Matrix",
        year: 1999,
        guid,
        Guid,
      }).valid).toBe(true);
    });

    it("merges a legacy guid with ids that only appear in the Guid array", () => {
      const movie = mapper.mapPlexMovieToTrakt({
        ratingKey: "1",
        title: "The Matrix",
        year: 1999,
        guid: "com.plexapp.agents.imdb://tt0133093?lang=en",
        Guid: [{ id: "tmdb://603" }],
      });

      expect(movie.ids).toMatchObject({ imdb: "tt0133093", tmdb: 603 });
    });

    it("lets explicit id fields override Guid entries", () => {
      const movie = mapper.mapPlexMovieToTrakt({
        ratingKey: "1",
        title: "The Matrix",
        year: 1999,
        guid: "plex://movie/5d7768ba96b655001fdc0408",
        Guid: [{ id: "imdb://tt0133093" }, { id: "tmdb://603" }],
        imdbId: "tt9999999",
        tmdbId: "1396",
      });

      expect(movie.ids).toMatchObject({ imdb: "tt9999999", tmdb: 1396 });
    });

    it("uses show Guid ids in the episode sync payload", () => {
      const shows = mapper.mapPlexEpisodesForSync([
        {
          ratingKey: "5678",
          title: "Pilot",
          seasonNumber: 1,
          episodeNumber: 1,
          lastViewedAt: 1728000000,
          guid: "plex://episode/5d9c09e3e98e47001ebcc6e5",
          Guid: [{ id: "imdb://tt0959621" }, { id: "tmdb://62085" }, { id: "tvdb://349232" }],
          show: {
            ratingKey: "100",
            title: "Breaking Bad",
            year: 2008,
            guid: "plex://show/5d9c086fe9d5a1001f4d14a6",
            Guid: [{ id: "imdb://tt0903747" }, { id: "tmdb://1396" }, { id: "tvdb://81189" }],
          },
        },
      ]);

      expect(shows).toEqual([
        {
          watched_at: undefined,
          ids: { imdb: "tt0903747", tmdb: 1396, tvdb: 81189 },
          title: "Breaking Bad",
          year: 2008,
          seasons: [
            {
              number: 1,
              episodes: [
                { number: 1, watched_at: new Date(1728000000 * 1000).toISOString() },
              ],
            },
          ],
        },
      ]);
    });
  });

  describe("items with no external ids", () => {
    it("rejects a plex:// movie that has no Guid array", () => {
      const result = mapper.validatePlexItemForSync({
        ratingKey: "15234",
        title: "The Matrix",
        year: 1999,
        guid: "plex://movie/5d7768ba96b655001fdc0408",
      });

      expect(result).toEqual({ valid: false, errors: [MISSING_IDS] });
    });

    it("rejects a local:// episode with no Guid without throwing", () => {
      const episode: PlexEpisode = {
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
      };

      expect(() => mapper.validatePlexItemForSync(episode)).not.toThrow();
      expect(mapper.validatePlexItemForSync(episode)).toEqual({
        valid: false,
        errors: [MISSING_IDS],
      });

      const withNullGuid = {
        ...episode,
        Guid: null,
        show: { ...episode.show, Guid: null },
      } as unknown as PlexEpisode;
      expect(() => mapper.validatePlexItemForSync(withNullGuid)).not.toThrow();
      expect(mapper.validatePlexItemForSync(withNullGuid)).toEqual({
        valid: false,
        errors: [MISSING_IDS],
      });
    });

    it("ignores malformed Guid entries instead of throwing", () => {
      const episode = {
        ratingKey: "3001",
        title: "Family Vacation",
        seasonNumber: 1,
        episodeNumber: 2,
        guid: "local://3001",
        Guid: [null, { id: 349232 }, { id: "" }, { no: "id" }],
      } as unknown as PlexEpisode;

      expect(() => mapper.validatePlexItemForSync(episode)).not.toThrow();
      expect(mapper.validatePlexItemForSync(episode).valid).toBe(false);
    });
  });
});
