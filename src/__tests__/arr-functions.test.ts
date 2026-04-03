import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrMCPFunctions } from "../arr/mcp-functions.js";
import { ARR_PREVIEW_LIMIT, ARR_DEFAULT_PAGE_SIZE } from "../arr/constants.js";
import { SUMMARY_PREVIEW_LENGTH } from "../plex/constants.js";

const LONG_OVERVIEW = "B".repeat(1000);

function makeSeries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Series ${i + 1}`,
    year: 2020 + (i % 5),
    status: "continuing",
    network: "HBO",
    monitored: true,
    tvdbId: 100 + i,
    imdbId: `tt${i}`,
    overview: LONG_OVERVIEW,
    statistics: { seasonCount: 3, episodeFileCount: 20, episodeCount: 30, percentOfEpisodes: 66.7, sizeOnDisk: 1000000 },
  }));
}

function makeMovies(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Movie ${i + 1}`,
    year: 2020 + (i % 5),
    status: "released",
    hasFile: true,
    monitored: true,
    runtime: 120,
    tmdbId: 200 + i,
    imdbId: `tt${1000 + i}`,
    sizeOnDisk: 5000000,
    minimumAvailability: "released",
    overview: LONG_OVERVIEW,
  }));
}

function makeQueueRecords(count: number) {
  return {
    totalRecords: count,
    records: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Download ${i + 1}`,
      status: "downloading",
      trackedDownloadStatus: "ok",
      trackedDownloadState: "downloading",
      protocol: "usenet",
      downloadClient: "SABnzbd",
      size: 1000000,
      sizeleft: 500000,
      timeleft: "00:10:00",
    })),
  };
}

function makeCalendarEntries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    seriesId: 10,
    series: { title: `Show ${i}` },
    seasonNumber: 1,
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    airDate: "2026-04-15",
    airDateUtc: "2026-04-15T20:00:00Z",
    hasFile: false,
    monitored: true,
    overview: LONG_OVERVIEW,
  }));
}

describe("ArrMCPFunctions", () => {
  let arr: ArrMCPFunctions;

  beforeEach(() => {
    // Set dummy env vars so lazy init doesn't throw
    process.env.SONARR_API_KEY = "test-sonarr-key";
    process.env.RADARR_API_KEY = "test-radarr-key";
    process.env.SONARR_URL = "http://localhost:8989";
    process.env.RADARR_URL = "http://localhost:7878";
    arr = new ArrMCPFunctions();
  });

  describe("sonarrGetSeries", () => {
    it("respects custom limit", async () => {
      const series = makeSeries(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series) });

      const result = await arr.sonarrGetSeries({ limit: 5 });
      expect(result.success).toBe(true);
      expect((result.series as unknown[]).length).toBe(5);
      expect(result.showing).toBe(5);
      expect(result.totalSeries).toBe(300);
    });

    it("defaults to ARR_PREVIEW_LIMIT when no limit given", async () => {
      const series = makeSeries(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series) });

      const result = await arr.sonarrGetSeries({});
      expect((result.series as unknown[]).length).toBe(ARR_PREVIEW_LIMIT);
    });

    it("truncates overviews", async () => {
      const series = makeSeries(1);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series) });

      const result = await arr.sonarrGetSeries({});
      const item = (result.series as Array<{ overview: string }>)[0];
      expect(item.overview.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });
  });

  describe("sonarrSearch", () => {
    it("respects custom limit", async () => {
      const results = makeSeries(50);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ searchSeries: vi.fn().mockResolvedValue(results) });

      const result = await arr.sonarrSearch({ query: "test", limit: 10 });
      expect((result.results as unknown[]).length).toBe(10);
      expect(result.showing).toBe(10);
    });
  });

  describe("sonarrGetMissing", () => {
    it("returns all records from page without secondary slice", async () => {
      const records = Array.from({ length: 150 }, (_, i) => ({
        id: i, seriesId: 1, seasonNumber: 1, episodeNumber: i + 1,
        title: `Ep ${i}`, airDate: "2026-01-01", monitored: true, overview: "Short",
      }));
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({
        getMissing: vi.fn().mockResolvedValue({ totalRecords: 150, page: 1, pageSize: 200, records }),
      });

      const result = await arr.sonarrGetMissing({});
      expect((result.episodes as unknown[]).length).toBe(150);
      expect(result.showing).toBe(150);
    });
  });

  describe("sonarrGetQueue", () => {
    it("respects custom limit", async () => {
      const queue = makeQueueRecords(50);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getQueue: vi.fn().mockResolvedValue(queue) });

      const result = await arr.sonarrGetQueue({ limit: 10 });
      expect((result.items as unknown[]).length).toBe(10);
    });
  });

  describe("sonarrGetCalendar", () => {
    it("respects custom limit", async () => {
      const entries = makeCalendarEntries(50);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getCalendar: vi.fn().mockResolvedValue(entries) });

      const result = await arr.sonarrGetCalendar({ limit: 10 });
      expect((result.entries as unknown[]).length).toBe(10);
    });

    it("truncates overviews", async () => {
      const entries = makeCalendarEntries(1);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getCalendar: vi.fn().mockResolvedValue(entries) });

      const result = await arr.sonarrGetCalendar({});
      const item = (result.entries as Array<{ overview: string }>)[0];
      expect(item.overview.length).toBeLessThanOrEqual(SUMMARY_PREVIEW_LENGTH + 3);
    });
  });

  describe("radarrGetMovies", () => {
    it("respects custom limit", async () => {
      const movies = makeMovies(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getMovies: vi.fn().mockResolvedValue(movies) });

      const result = await arr.radarrGetMovies({ limit: 5 });
      expect((result.movies as unknown[]).length).toBe(5);
      expect(result.totalMovies).toBe(300);
    });

    it("defaults to ARR_PREVIEW_LIMIT", async () => {
      const movies = makeMovies(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getMovies: vi.fn().mockResolvedValue(movies) });

      const result = await arr.radarrGetMovies({});
      expect((result.movies as unknown[]).length).toBe(ARR_PREVIEW_LIMIT);
    });
  });

  describe("radarrSearch", () => {
    it("respects custom limit", async () => {
      const results = makeMovies(50);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ searchMovies: vi.fn().mockResolvedValue(results) });

      const result = await arr.radarrSearch({ query: "test", limit: 10 });
      expect((result.results as unknown[]).length).toBe(10);
    });
  });

  describe("radarrGetMissing", () => {
    it("returns all records without secondary slice", async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        id: i, title: `Movie ${i}`, year: 2024, status: "released",
        monitored: true, tmdbId: i, imdbId: `tt${i}`, overview: "Short",
      }));
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({
        getMissing: vi.fn().mockResolvedValue({ totalRecords: 100, page: 1, pageSize: 200, records }),
      });

      const result = await arr.radarrGetMissing({});
      expect((result.movies as unknown[]).length).toBe(100);
    });
  });

  describe("radarrGetQueue", () => {
    it("respects custom limit", async () => {
      const queue = makeQueueRecords(50);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getQueue: vi.fn().mockResolvedValue(queue) });

      const result = await arr.radarrGetQueue({ limit: 10 });
      expect((result.items as unknown[]).length).toBe(10);
    });
  });

  describe("radarrGetCalendar", () => {
    it("respects custom limit", async () => {
      const entries = makeMovies(50).map((m) => ({
        ...m, inCinemas: "2026-01-01", physicalRelease: "2026-04-01",
        digitalRelease: "2026-03-15", hasFile: false,
      }));
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getCalendar: vi.fn().mockResolvedValue(entries) });

      const result = await arr.radarrGetCalendar({ limit: 10 });
      expect((result.entries as unknown[]).length).toBe(10);
    });
  });

  describe("missing API key errors", () => {
    it("throws when SONARR_API_KEY is missing", () => {
      delete process.env.SONARR_API_KEY;
      const fresh = new ArrMCPFunctions();
      expect(fresh.sonarrGetSeries({})).rejects.toThrow("SONARR_API_KEY");
    });

    it("throws when RADARR_API_KEY is missing", () => {
      delete process.env.RADARR_API_KEY;
      const fresh = new ArrMCPFunctions();
      expect(fresh.radarrGetMovies({})).rejects.toThrow("RADARR_API_KEY");
    });
  });
});
