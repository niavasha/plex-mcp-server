/**
 * Arr MCP Functions
 * MCP tool implementations for Sonarr and Radarr integration.
 * Follows lazy initialization pattern from trakt/mcp-functions.ts.
 */

import { SonarrClient, RadarrClient } from "./client.js";
import {
  ArrConfig,
  ArrTag,
  SonarrAddSeriesRequest,
  RadarrAddMovieRequest,
} from "./types.js";
import {
  DEFAULT_SONARR_URL,
  DEFAULT_RADARR_URL,
  ARR_PREVIEW_LIMIT,
  ARR_DEFAULT_PAGE_SIZE,
  DEFAULT_MINIMUM_AVAILABILITY,
  DEFAULT_MONITOR_TYPE,
} from "./constants.js";
import { SUMMARY_PREVIEW_LENGTH } from "../plex/constants.js";
import { truncate } from "../shared/utils.js";

type ArrServiceClient = SonarrClient | RadarrClient;

/** Tag endpoints are identical in Sonarr and Radarr, so one set of helpers serves both. */
async function runTagOp(op: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try {
    return await op();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function requireTagLabel(label: unknown): string {
  if (typeof label !== "string" || label.trim() === "") {
    throw new Error("label is required and must be a non-empty string");
  }
  return label.trim();
}

function requireTagId(id: unknown): number {
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new Error("id is required and must be a positive integer (see the get_tags tool)");
  }
  return id;
}

/**
 * Resolve tag labels for an add request to tag IDs. Labels match existing tags
 * case-insensitively (the services lowercase labels); missing ones are created.
 */
async function resolveTagLabels(
  client: ArrServiceClient,
  tags: unknown
): Promise<{ ids: number[]; labels: string[]; created: string[] } | undefined> {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags)) {
    throw new Error("tags must be an array of tag labels");
  }
  const labels = [...new Map(tags.map(requireTagLabel).map((l) => [l.toLowerCase(), l])).values()];
  if (labels.length === 0) return undefined;

  const existing = new Map((await client.getTags()).map((t) => [t.label.toLowerCase(), t]));
  const resolved: ArrTag[] = [];
  const created: string[] = [];
  for (const label of labels) {
    let tag = existing.get(label.toLowerCase());
    if (!tag) {
      tag = await client.createTag(label);
      created.push(tag.label);
    }
    resolved.push(tag);
  }
  return { ids: resolved.map((t) => t.id), labels: resolved.map((t) => t.label), created };
}

/** Series and movies store tag IDs; callers only know labels. */
function tagLabels(ids: number[], tags: ArrTag[]): string[] {
  const labelById = new Map(tags.map((t) => [t.id, t.label]));
  return ids.map((id) => labelById.get(id)!);
}

const listTags = (client: ArrServiceClient) =>
  runTagOp(async () => {
    const tags = await client.getTags();
    return { success: true, totalTags: tags.length, tags };
  });

const createTag = (client: ArrServiceClient, label: unknown) =>
  runTagOp(async () => ({ success: true, tag: await client.createTag(requireTagLabel(label)) }));

const updateTag = (client: ArrServiceClient, id: unknown, label: unknown) =>
  runTagOp(async () => ({
    success: true,
    tag: await client.updateTag(requireTagId(id), requireTagLabel(label)),
  }));

const deleteTag = (client: ArrServiceClient, id: unknown) =>
  runTagOp(async () => {
    const tagId = requireTagId(id);
    await client.deleteTag(tagId);
    return { success: true, deletedId: tagId };
  });

export class ArrMCPFunctions {
  private sonarrClient: SonarrClient | null = null;
  private radarrClient: RadarrClient | null = null;
  private sonarrInitialized = false;
  private radarrInitialized = false;

  private ensureSonarr(): SonarrClient {
    if (!this.sonarrInitialized) {
      const apiKey = process.env.SONARR_API_KEY;
      if (!apiKey) {
        throw new Error(
          "SONARR_API_KEY environment variable is required. " +
          "Find it in Sonarr → Settings → General → API Key."
        );
      }
      const config: ArrConfig = {
        baseUrl: process.env.SONARR_URL || DEFAULT_SONARR_URL,
        apiKey,
      };
      this.sonarrClient = new SonarrClient(config);
      this.sonarrInitialized = true;
    }
    return this.sonarrClient!;
  }

  private ensureRadarr(): RadarrClient {
    if (!this.radarrInitialized) {
      const apiKey = process.env.RADARR_API_KEY;
      if (!apiKey) {
        throw new Error(
          "RADARR_API_KEY environment variable is required. " +
          "Find it in Radarr → Settings → General → API Key."
        );
      }
      const config: ArrConfig = {
        baseUrl: process.env.RADARR_URL || DEFAULT_RADARR_URL,
        apiKey,
      };
      this.radarrClient = new RadarrClient(config);
      this.radarrInitialized = true;
    }
    return this.radarrClient!;
  }

  // ──── Sonarr tools ────

  async sonarrGetTags(): Promise<Record<string, unknown>> {
    return listTags(this.ensureSonarr());
  }

  async sonarrCreateTag(args: { label: string }): Promise<Record<string, unknown>> {
    return createTag(this.ensureSonarr(), args.label);
  }

  async sonarrUpdateTag(args: { id: number; label: string }): Promise<Record<string, unknown>> {
    return updateTag(this.ensureSonarr(), args.id, args.label);
  }

  async sonarrDeleteTag(args: { id: number }): Promise<Record<string, unknown>> {
    return deleteTag(this.ensureSonarr(), args.id);
  }

  async sonarrGetSeries(args: {
    filter?: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const [allSeries, tagList] = await Promise.all([client.getSeries(), client.getTags()]);
      let series = allSeries;
      if (args.filter) {
        const f = args.filter.toLowerCase();
        series = series.filter((s) => s.title.toLowerCase().includes(f));
      }
      return {
        success: true,
        totalSeries: series.length,
        series: series.slice(0, limit).map((s) => ({
          id: s.id,
          title: s.title,
          year: s.year,
          status: s.status,
          network: s.network,
          seriesType: s.seriesType,
          tags: tagLabels(s.tags, tagList),
          monitored: s.monitored,
          seasons: s.statistics.seasonCount,
          episodeFileCount: s.statistics.episodeFileCount,
          episodeCount: s.statistics.episodeCount,
          percentOfEpisodes: s.statistics.percentOfEpisodes,
          sizeOnDisk: s.statistics.sizeOnDisk,
          tvdbId: s.tvdbId,
          imdbId: s.imdbId,
          overview: s.overview ? truncate(s.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, series.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrSearch(args: {
    query: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const results = await client.searchSeries(args.query);
      return {
        success: true,
        query: args.query,
        totalResults: results.length,
        results: results.slice(0, limit).map((r) => ({
          tvdbId: r.tvdbId,
          title: r.title,
          year: r.year,
          status: r.status,
          network: r.network,
          runtime: r.runtime,
          genres: r.genres,
          certification: r.certification,
          seasonCount: r.seasons?.length || 0,
          overview: r.overview ? truncate(r.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, results.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrAddSeries(args: {
    tvdbId: number;
    title: string;
    qualityProfileId?: number;
    rootFolderPath?: string;
    monitored?: boolean;
    seasonFolder?: boolean;
    monitorType?: string;
    seriesType?: string;
    searchForMissingEpisodes?: boolean;
    searchForCutoffUnmetEpisodes?: boolean;
    tags?: string[];
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      let qualityProfileId = args.qualityProfileId;
      let rootFolderPath = args.rootFolderPath;

      if (!qualityProfileId || !rootFolderPath) {
        const [profiles, roots] = await Promise.all([
          client.getQualityProfiles(),
          client.getRootFolders(),
        ]);
        if (!qualityProfileId && profiles.length > 0) {
          qualityProfileId = profiles[0].id;
        }
        if (!rootFolderPath && roots.length > 0) {
          rootFolderPath = roots[0].path;
        }
      }

      if (!qualityProfileId || !rootFolderPath) {
        return {
          success: false,
          error: "Could not determine quality profile or root folder. Please specify them explicitly.",
        };
      }

      // After the profile check, so a request that cannot proceed creates no tags.
      const tags = await resolveTagLabels(client, args.tags);

      const request: SonarrAddSeriesRequest = {
        tvdbId: args.tvdbId,
        title: args.title,
        qualityProfileId,
        rootFolderPath,
        monitored: args.monitored ?? true,
        seasonFolder: args.seasonFolder ?? true,
        ...(args.seriesType && { seriesType: args.seriesType }),
        ...(tags && { tags: tags.ids }),
        addOptions: {
          monitor: args.monitorType || DEFAULT_MONITOR_TYPE,
          searchForMissingEpisodes: args.searchForMissingEpisodes ?? true,
          searchForCutoffUnmetEpisodes: args.searchForCutoffUnmetEpisodes ?? false,
        },
      };

      const series = await client.addSeries(request);
      return {
        success: true,
        message: `Added "${series.title}" (${series.year}) to Sonarr`,
        ...(tags?.created.length && { createdTags: tags.created }),
        series: {
          id: series.id,
          title: series.title,
          year: series.year,
          tvdbId: series.tvdbId,
          path: series.path,
          monitored: series.monitored,
          qualityProfileId: series.qualityProfileId,
          tags: tags?.labels ?? [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrGetMissing(args: {
    page?: number;
    pageSize?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      const result = await client.getMissing(
        args.page || 1,
        args.pageSize || ARR_DEFAULT_PAGE_SIZE
      );
      return {
        success: true,
        totalRecords: result.totalRecords,
        page: result.page,
        pageSize: result.pageSize,
        episodes: result.records.map((ep) => ({
          id: ep.id,
          seriesId: ep.seriesId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          airDate: ep.airDate,
          monitored: ep.monitored,
          overview: ep.overview ? truncate(ep.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: result.records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrGetQueue(args: {
    limit?: number;
  } = {}): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const queue = await client.getQueue();
      return {
        success: true,
        totalRecords: queue.totalRecords,
        items: queue.records.slice(0, limit).map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          trackedDownloadStatus: item.trackedDownloadStatus,
          trackedDownloadState: item.trackedDownloadState,
          protocol: item.protocol,
          downloadClient: item.downloadClient,
          size: item.size,
          sizeleft: item.sizeleft,
          timeleft: item.timeleft,
        })),
        showing: Math.min(limit, queue.records.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrGetCalendar(args: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const entries = await client.getCalendar(args.startDate, args.endDate);
      return {
        success: true,
        totalEntries: entries.length,
        entries: entries.slice(0, limit).map((ep) => ({
          id: ep.id,
          seriesId: ep.seriesId,
          seriesTitle: ep.series?.title,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          airDate: ep.airDate,
          airDateUtc: ep.airDateUtc,
          hasFile: ep.hasFile,
          monitored: ep.monitored,
          overview: ep.overview ? truncate(ep.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, entries.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrGetProfiles(): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      const [profiles, rootFolders] = await Promise.all([
        client.getQualityProfiles(),
        client.getRootFolders(),
      ]);
      return {
        success: true,
        qualityProfiles: profiles.map((p) => ({
          id: p.id,
          name: p.name,
          upgradeAllowed: p.upgradeAllowed,
        })),
        rootFolders: rootFolders.map((r) => ({
          id: r.id,
          path: r.path,
          accessible: r.accessible,
          freeSpace: r.freeSpace,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrTriggerSearch(args: {
    seriesId?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      if (args.seriesId) {
        const result = await client.triggerSeriesSearch(args.seriesId);
        return {
          success: true,
          commandId: result.id,
          message: `Triggered search for series ${args.seriesId}`,
        };
      }
      const result = await client.triggerMissingSearch();
      return {
        success: true,
        commandId: result.id,
        message: "Triggered search for all missing episodes",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ──── Radarr tools ────

  async radarrGetTags(): Promise<Record<string, unknown>> {
    return listTags(this.ensureRadarr());
  }

  async radarrCreateTag(args: { label: string }): Promise<Record<string, unknown>> {
    return createTag(this.ensureRadarr(), args.label);
  }

  async radarrUpdateTag(args: { id: number; label: string }): Promise<Record<string, unknown>> {
    return updateTag(this.ensureRadarr(), args.id, args.label);
  }

  async radarrDeleteTag(args: { id: number }): Promise<Record<string, unknown>> {
    return deleteTag(this.ensureRadarr(), args.id);
  }

  async radarrGetMovies(args: {
    filter?: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const [allMovies, tagList] = await Promise.all([client.getMovies(), client.getTags()]);
      let movies = allMovies;
      if (args.filter) {
        const f = args.filter.toLowerCase();
        movies = movies.filter((m) => m.title.toLowerCase().includes(f));
      }
      return {
        success: true,
        totalMovies: movies.length,
        movies: movies.slice(0, limit).map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          status: m.status,
          hasFile: m.hasFile,
          monitored: m.monitored,
          runtime: m.runtime,
          tmdbId: m.tmdbId,
          imdbId: m.imdbId,
          sizeOnDisk: m.sizeOnDisk,
          minimumAvailability: m.minimumAvailability,
          tags: tagLabels(m.tags, tagList),
          overview: m.overview ? truncate(m.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, movies.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrSearch(args: {
    query: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const results = await client.searchMovies(args.query);
      return {
        success: true,
        query: args.query,
        totalResults: results.length,
        results: results.slice(0, limit).map((r) => ({
          tmdbId: r.tmdbId,
          imdbId: r.imdbId,
          title: r.title,
          year: r.year,
          status: r.status,
          runtime: r.runtime,
          genres: r.genres,
          certification: r.certification,
          overview: r.overview ? truncate(r.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, results.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrAddMovie(args: {
    tmdbId: number;
    title: string;
    qualityProfileId?: number;
    rootFolderPath?: string;
    monitored?: boolean;
    minimumAvailability?: string;
    monitorType?: string;
    searchForMovie?: boolean;
    tags?: string[];
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      let qualityProfileId = args.qualityProfileId;
      let rootFolderPath = args.rootFolderPath;

      if (!qualityProfileId || !rootFolderPath) {
        const [profiles, roots] = await Promise.all([
          client.getQualityProfiles(),
          client.getRootFolders(),
        ]);
        if (!qualityProfileId && profiles.length > 0) {
          qualityProfileId = profiles[0].id;
        }
        if (!rootFolderPath && roots.length > 0) {
          rootFolderPath = roots[0].path;
        }
      }

      if (!qualityProfileId || !rootFolderPath) {
        return {
          success: false,
          error: "Could not determine quality profile or root folder. Please specify them explicitly.",
        };
      }

      // After the profile check, so a request that cannot proceed creates no tags.
      const tags = await resolveTagLabels(client, args.tags);

      const request: RadarrAddMovieRequest = {
        tmdbId: args.tmdbId,
        title: args.title,
        qualityProfileId,
        rootFolderPath,
        monitored: args.monitored ?? true,
        minimumAvailability: args.minimumAvailability || DEFAULT_MINIMUM_AVAILABILITY,
        ...(tags && { tags: tags.ids }),
        addOptions: {
          ...(args.monitorType && { monitor: args.monitorType }),
          searchForMovie: args.searchForMovie ?? true,
        },
      };

      const movie = await client.addMovie(request);
      return {
        success: true,
        message: `Added "${movie.title}" (${movie.year}) to Radarr`,
        ...(tags?.created.length && { createdTags: tags.created }),
        movie: {
          id: movie.id,
          title: movie.title,
          year: movie.year,
          tmdbId: movie.tmdbId,
          path: movie.path,
          monitored: movie.monitored,
          qualityProfileId: movie.qualityProfileId,
          tags: tags?.labels ?? [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrGetMissing(args: {
    page?: number;
    pageSize?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      const result = await client.getMissing(
        args.page || 1,
        args.pageSize || ARR_DEFAULT_PAGE_SIZE
      );
      return {
        success: true,
        totalRecords: result.totalRecords,
        page: result.page,
        pageSize: result.pageSize,
        movies: result.records.map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          status: m.status,
          monitored: m.monitored,
          tmdbId: m.tmdbId,
          imdbId: m.imdbId,
          overview: m.overview ? truncate(m.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: result.records.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrGetQueue(args: {
    limit?: number;
  } = {}): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const queue = await client.getQueue();
      return {
        success: true,
        totalRecords: queue.totalRecords,
        items: queue.records.slice(0, limit).map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          trackedDownloadStatus: item.trackedDownloadStatus,
          trackedDownloadState: item.trackedDownloadState,
          protocol: item.protocol,
          downloadClient: item.downloadClient,
          size: item.size,
          sizeleft: item.sizeleft,
          timeleft: item.timeleft,
        })),
        showing: Math.min(limit, queue.records.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrGetCalendar(args: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    const limit = args.limit || ARR_PREVIEW_LIMIT;
    try {
      const entries = await client.getCalendar(args.startDate, args.endDate);
      return {
        success: true,
        totalEntries: entries.length,
        entries: entries.slice(0, limit).map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          status: m.status,
          inCinemas: m.inCinemas,
          physicalRelease: m.physicalRelease,
          digitalRelease: m.digitalRelease,
          hasFile: m.hasFile,
          monitored: m.monitored,
          tmdbId: m.tmdbId,
          overview: m.overview ? truncate(m.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(limit, entries.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrGetProfiles(): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      const [profiles, rootFolders] = await Promise.all([
        client.getQualityProfiles(),
        client.getRootFolders(),
      ]);
      return {
        success: true,
        qualityProfiles: profiles.map((p) => ({
          id: p.id,
          name: p.name,
          upgradeAllowed: p.upgradeAllowed,
        })),
        rootFolders: rootFolders.map((r) => ({
          id: r.id,
          path: r.path,
          accessible: r.accessible,
          freeSpace: r.freeSpace,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrTriggerSearch(args: {
    movieId?: number;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      if (args.movieId) {
        const result = await client.triggerMovieSearch(args.movieId);
        return {
          success: true,
          commandId: result.id,
          message: `Triggered search for movie ${args.movieId}`,
        };
      }
      const result = await client.triggerMissingSearch();
      return {
        success: true,
        commandId: result.id,
        message: "Triggered search for all missing movies",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ──── Cross-service tools ────

  async arrGetStatus(): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    const sonarrResult = await (async () => {
      try {
        const client = this.ensureSonarr();
        const status = await client.getSystemStatus();
        return { available: true, version: status.version, appName: status.appName };
      } catch (error) {
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })();

    const radarrResult = await (async () => {
      try {
        const client = this.ensureRadarr();
        const status = await client.getSystemStatus();
        return { available: true, version: status.version, appName: status.appName };
      } catch (error) {
        return {
          available: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })();

    const [sonarr, radarr] = await Promise.allSettled([sonarrResult, radarrResult]);

    // Surface per-service error messages from Promise.allSettled rejections
    results.sonarr =
      sonarr.status === "fulfilled"
        ? sonarr.value
        : {
            available: false,
            error:
              sonarr.reason instanceof Error
                ? sonarr.reason.message
                : String(sonarr.reason),
          };

    results.radarr =
      radarr.status === "fulfilled"
        ? radarr.value
        : {
            available: false,
            error:
              radarr.reason instanceof Error
                ? radarr.reason.message
                : String(radarr.reason),
          };

    return {
      success: true,
      services: results,
    };
  }
}
