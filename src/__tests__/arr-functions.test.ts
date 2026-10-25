import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArrMCPFunctions } from "../arr/mcp-functions.js";
import { RADARR_TOOL_SCHEMAS, SONARR_TOOL_SCHEMAS } from "../arr/tool-schemas.js";
import { ARR_PREVIEW_LIMIT, ARR_DEFAULT_PAGE_SIZE } from "../arr/constants.js";
import { SUMMARY_PREVIEW_LENGTH } from "../plex/constants.js";

const LONG_OVERVIEW = "B".repeat(1000);
const TAGS = [{ id: 1, label: "anime" }, { id: 2, label: "4k" }];

function makeSeries(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Series ${i + 1}`,
    year: 2020 + (i % 5),
    status: "continuing",
    network: "HBO",
    monitored: true,
    seriesType: "anime",
    tags: [1],
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
    tags: [2],
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
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.sonarrGetSeries({ limit: 5 });
      expect(result.success).toBe(true);
      expect((result.series as unknown[]).length).toBe(5);
      expect(result.showing).toBe(5);
      expect(result.totalSeries).toBe(300);
    });

    it("defaults to ARR_PREVIEW_LIMIT when no limit given", async () => {
      const series = makeSeries(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.sonarrGetSeries({});
      expect((result.series as unknown[]).length).toBe(ARR_PREVIEW_LIMIT);
    });

    it("returns series type and tag labels instead of tag IDs", async () => {
      const series = makeSeries(1);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.sonarrGetSeries({});
      const item = (result.series as Array<{ seriesType: string; tags: string[] }>)[0];
      expect(item.seriesType).toBe("anime");
      expect(item.tags).toEqual(["anime"]);
    });

    it("truncates overviews", async () => {
      const series = makeSeries(1);
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue({ getSeries: vi.fn().mockResolvedValue(series), getTags: vi.fn().mockResolvedValue(TAGS) });

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
      arr.ensureRadarr = vi.fn().mockReturnValue({ getMovies: vi.fn().mockResolvedValue(movies), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.radarrGetMovies({ limit: 5 });
      expect((result.movies as unknown[]).length).toBe(5);
      expect(result.totalMovies).toBe(300);
    });

    it("defaults to ARR_PREVIEW_LIMIT", async () => {
      const movies = makeMovies(300);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getMovies: vi.fn().mockResolvedValue(movies), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.radarrGetMovies({});
      expect((result.movies as unknown[]).length).toBe(ARR_PREVIEW_LIMIT);
    });
  });

  describe("radarrGetMovies tags", () => {
    it("returns tag labels instead of tag IDs", async () => {
      const movies = makeMovies(1);
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue({ getMovies: vi.fn().mockResolvedValue(movies), getTags: vi.fn().mockResolvedValue(TAGS) });

      const result = await arr.radarrGetMovies({});
      expect((result.movies as Array<{ tags: string[] }>)[0].tags).toEqual(["4k"]);
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

  describe.each([
    ["sonarr", "ensureSonarr"],
    ["radarr", "ensureRadarr"],
  ] as const)("%s tag management", (service, ensure) => {
    const method = (name: "GetTags" | "CreateTag" | "UpdateTag" | "DeleteTag") =>
      `${service}${name}` as const;
    const call = (name: "GetTags" | "CreateTag" | "UpdateTag" | "DeleteTag", args?: unknown) =>
      (arr as unknown as Record<string, (a?: unknown) => Promise<Record<string, unknown>>>)[
        method(name)
      ](args);

    function mockClient(overrides: Record<string, unknown> = {}) {
      const client = {
        getTags: vi.fn().mockResolvedValue([{ id: 1, label: "anime" }, { id: 2, label: "4k" }]),
        createTag: vi.fn().mockResolvedValue({ id: 3, label: "kids" }),
        updateTag: vi.fn().mockResolvedValue({ id: 1, label: "cartoons" }),
        deleteTag: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      (arr as unknown as Record<string, unknown>)[ensure] = vi.fn().mockReturnValue(client);
      return client;
    }

    it("lists tags", async () => {
      mockClient();
      expect(await call("GetTags")).toEqual({
        success: true,
        totalTags: 2,
        tags: [{ id: 1, label: "anime" }, { id: 2, label: "4k" }],
      });
    });

    it("creates a tag with a trimmed label", async () => {
      const client = mockClient();
      const result = await call("CreateTag", { label: "  kids " });
      expect(client.createTag).toHaveBeenCalledWith("kids");
      expect(result).toEqual({ success: true, tag: { id: 3, label: "kids" } });
    });

    it("updates a tag", async () => {
      const client = mockClient();
      const result = await call("UpdateTag", { id: 1, label: "cartoons" });
      expect(client.updateTag).toHaveBeenCalledWith(1, "cartoons");
      expect(result).toEqual({ success: true, tag: { id: 1, label: "cartoons" } });
    });

    it("deletes a tag", async () => {
      const client = mockClient();
      const result = await call("DeleteTag", { id: 2 });
      expect(client.deleteTag).toHaveBeenCalledWith(2);
      expect(result).toEqual({ success: true, deletedId: 2 });
    });

    it.each([
      ["CreateTag", { label: "" }],
      ["CreateTag", { label: "   " }],
      ["CreateTag", {}],
      ["UpdateTag", { id: 1, label: "" }],
      ["UpdateTag", { id: 0, label: "x" }],
      ["UpdateTag", { id: "1", label: "x" }],
      ["DeleteTag", { id: -1 }],
      ["DeleteTag", { id: 1.5 }],
      ["DeleteTag", {}],
    ] as const)("rejects invalid %s input %j without calling the API", async (name, args) => {
      const client = mockClient();
      const result = await call(name, args);
      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(String));
      expect(client.createTag).not.toHaveBeenCalled();
      expect(client.updateTag).not.toHaveBeenCalled();
      expect(client.deleteTag).not.toHaveBeenCalled();
    });

    it("reports API errors instead of throwing", async () => {
      mockClient({ deleteTag: vi.fn().mockRejectedValue(new Error("boom: tag in use")) });
      expect(await call("DeleteTag", { id: 1 })).toEqual({
        success: false,
        error: "boom: tag in use",
      });
    });
  });

  describe.each([
    ["sonarr", "ensureSonarr", "addSeries", "sonarrAddSeries", { tvdbId: 1, title: "Show" }],
    ["radarr", "ensureRadarr", "addMovie", "radarrAddMovie", { tmdbId: 1, title: "Movie" }],
  ] as const)("%s add with tags", (_service, ensure, addMethod, fn, base) => {
    function mockClient(overrides: Record<string, unknown> = {}) {
      const createTag = vi.fn().mockImplementation(async (label: string) => ({ id: 7, label: label.toLowerCase() }));
      const addMock = vi.fn().mockResolvedValue({ id: 9, title: "T", year: 2020, tags: [1, 7] });
      const client = {
        getQualityProfiles: vi.fn().mockResolvedValue([{ id: 1 }]),
        getRootFolders: vi.fn().mockResolvedValue([{ path: "/media" }]),
        getTags: vi.fn().mockResolvedValue([{ id: 1, label: "anime" }, { id: 2, label: "4k" }]),
        createTag,
        [addMethod]: addMock,
        ...overrides,
      };
      (arr as unknown as Record<string, unknown>)[ensure] = vi.fn().mockReturnValue(client);
      return { ...client, createTag, addMock };
    }
    const add = (args: Record<string, unknown>) =>
      (arr as unknown as Record<string, (a: unknown) => Promise<Record<string, unknown>>>)[fn]({
        ...base,
        ...args,
      });

    it("uses existing tags without creating anything, matching labels case-insensitively", async () => {
      const client = mockClient();
      const result = await add({ tags: ["Anime", "4k", "anime"] });
      expect(client.createTag).not.toHaveBeenCalled();
      expect(client.addMock).toHaveBeenCalledWith(expect.objectContaining({ tags: [1, 2] }));
      expect(result.success).toBe(true);
      expect(result).not.toHaveProperty("createdTags");
    });

    it("creates missing tags first, then adds with their IDs", async () => {
      const client = mockClient();
      const result = await add({ tags: ["anime", "Kids"] });
      expect(client.createTag).toHaveBeenCalledTimes(1);
      expect(client.createTag).toHaveBeenCalledWith("Kids");
      expect(client.createTag.mock.invocationCallOrder[0]).toBeLessThan(
        client.addMock.mock.invocationCallOrder[0]
      );
      expect(client.addMock).toHaveBeenCalledWith(expect.objectContaining({ tags: [1, 7] }));
      expect(result.success).toBe(true);
      expect(result.createdTags).toEqual(["kids"]);
      expect(((result.series ?? result.movie) as { tags: string[] }).tags).toEqual(["anime", "kids"]);
    });

    it.each([undefined, []])("omits tags and skips tag lookup when tags is %j", async (tags) => {
      const client = mockClient();
      await add({ tags });
      expect(client.getTags).not.toHaveBeenCalled();
      expect(client.createTag).not.toHaveBeenCalled();
      expect(client.addMock.mock.calls[0][0]).not.toHaveProperty("tags");
    });

    it.each([["anime"], [[""]], [["  "]], [[1]]])(
      "rejects malformed tags %j without creating or adding",
      async (tags) => {
        const client = mockClient();
        const result = await add({ tags });
        expect(result.success).toBe(false);
        expect(client.createTag).not.toHaveBeenCalled();
        expect(client.addMock).not.toHaveBeenCalled();
      }
    );

    it("creates no tags when the add cannot proceed", async () => {
      const client = mockClient({ getQualityProfiles: vi.fn().mockResolvedValue([]) });
      const result = await add({ tags: ["kids"] });
      expect(result.success).toBe(false);
      expect(client.createTag).not.toHaveBeenCalled();
      expect(client.addMock).not.toHaveBeenCalled();
    });
  });

  describe("sonarrAddSeries options", () => {
    function mockClient() {
      const addSeries = vi.fn().mockResolvedValue({ id: 9, title: "T", year: 2020 });
      const client = {
        getQualityProfiles: vi.fn().mockResolvedValue([{ id: 1 }]),
        getRootFolders: vi.fn().mockResolvedValue([{ path: "/media" }]),
        addSeries,
      };
      // @ts-expect-error — accessing private for test mock
      arr.ensureSonarr = vi.fn().mockReturnValue(client);
      return addSeries;
    }

    it("sends series type and cutoff-unmet search when given", async () => {
      const addSeries = mockClient();
      await arr.sonarrAddSeries({
        tvdbId: 1,
        title: "Show",
        seriesType: "anime",
        monitorType: "pilot",
        searchForCutoffUnmetEpisodes: true,
      });
      expect(addSeries).toHaveBeenCalledWith(
        expect.objectContaining({
          seriesType: "anime",
          addOptions: expect.objectContaining({ monitor: "pilot", searchForCutoffUnmetEpisodes: true }),
        })
      );
    });

    it("leaves series type to Sonarr's default and keeps cutoff-unmet search off", async () => {
      const addSeries = mockClient();
      await arr.sonarrAddSeries({ tvdbId: 1, title: "Show" });
      const request = addSeries.mock.calls[0][0];
      expect(request).not.toHaveProperty("seriesType");
      expect(request.addOptions.searchForCutoffUnmetEpisodes).toBe(false);
    });
  });

  describe("radarrAddMovie options", () => {
    function mockClient() {
      const addMovie = vi.fn().mockResolvedValue({ id: 9, title: "T", year: 2020 });
      const client = {
        getQualityProfiles: vi.fn().mockResolvedValue([{ id: 1 }]),
        getRootFolders: vi.fn().mockResolvedValue([{ path: "/media" }]),
        addMovie,
      };
      // @ts-expect-error — accessing private for test mock
      arr.ensureRadarr = vi.fn().mockReturnValue(client);
      return addMovie;
    }

    it("sends the monitor option when given", async () => {
      const addMovie = mockClient();
      await arr.radarrAddMovie({ tmdbId: 1, title: "Movie", monitorType: "movieAndCollection" });
      expect(addMovie).toHaveBeenCalledWith(
        expect.objectContaining({
          addOptions: expect.objectContaining({ monitor: "movieAndCollection", searchForMovie: true }),
        })
      );
    });

    it("leaves the monitor option to Radarr's default when omitted", async () => {
      const addMovie = mockClient();
      await arr.radarrAddMovie({ tmdbId: 1, title: "Movie" });
      expect(addMovie.mock.calls[0][0].addOptions).not.toHaveProperty("monitor");
    });
  });

  it("advertises lastSeason, not the obsolete latestSeason, as a Sonarr monitor type", () => {
    const sonarrAdd = SONARR_TOOL_SCHEMAS.find((s) => s.name === "sonarr_add_series")!;
    const { enum: values } = (sonarrAdd.inputSchema.properties as Record<string, { enum?: string[] }>)
      .monitorType;
    expect(values).toContain("lastSeason");
    expect(values).not.toContain("latestSeason");
  });

  it("does not advertise minimumAvailability values the Radarr API rejects", () => {
    const radarrAdd = RADARR_TOOL_SCHEMAS.find((s) => s.name === "radarr_add_movie")!;
    const { enum: values } = (radarrAdd.inputSchema.properties as Record<string, { enum?: string[] }>)
      .minimumAvailability;
    expect(values).toEqual(["announced", "inCinemas", "released"]);
  });

  describe("missing API key errors", () => {
    it("throws when SONARR_API_KEY is missing", async () => {
      delete process.env.SONARR_API_KEY;
      const fresh = new ArrMCPFunctions();
      await expect(fresh.sonarrGetSeries({})).rejects.toThrow("SONARR_API_KEY");
    });

    it("throws when RADARR_API_KEY is missing", async () => {
      delete process.env.RADARR_API_KEY;
      const fresh = new ArrMCPFunctions();
      await expect(fresh.radarrGetMovies({})).rejects.toThrow("RADARR_API_KEY");
    });
  });
});
