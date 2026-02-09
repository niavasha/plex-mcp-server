/**
 * Arr MCP Functions
 * MCP tool implementations for Sonarr and Radarr integration.
 * Follows lazy initialization pattern from trakt/mcp-functions.ts.
 */

import { SonarrClient, RadarrClient } from "./client.js";
import {
  ArrConfig,
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

  async sonarrGetSeries(args: {
    filter?: string;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      let series = await client.getSeries();
      if (args.filter) {
        const f = args.filter.toLowerCase();
        series = series.filter((s) => s.title.toLowerCase().includes(f));
      }
      return {
        success: true,
        totalSeries: series.length,
        series: series.slice(0, ARR_PREVIEW_LIMIT).map((s) => ({
          id: s.id,
          title: s.title,
          year: s.year,
          status: s.status,
          network: s.network,
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
        showing: Math.min(ARR_PREVIEW_LIMIT, series.length),
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
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      const results = await client.searchSeries(args.query);
      return {
        success: true,
        query: args.query,
        totalResults: results.length,
        results: results.slice(0, ARR_PREVIEW_LIMIT).map((r) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, results.length),
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
    searchForMissingEpisodes?: boolean;
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

      const request: SonarrAddSeriesRequest = {
        tvdbId: args.tvdbId,
        title: args.title,
        qualityProfileId,
        rootFolderPath,
        monitored: args.monitored ?? true,
        seasonFolder: args.seasonFolder ?? true,
        addOptions: {
          monitor: args.monitorType || DEFAULT_MONITOR_TYPE,
          searchForMissingEpisodes: args.searchForMissingEpisodes ?? true,
          searchForCutoffUnmetEpisodes: false,
        },
      };

      const series = await client.addSeries(request);
      return {
        success: true,
        message: `Added "${series.title}" (${series.year}) to Sonarr`,
        series: {
          id: series.id,
          title: series.title,
          year: series.year,
          tvdbId: series.tvdbId,
          path: series.path,
          monitored: series.monitored,
          qualityProfileId: series.qualityProfileId,
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
        episodes: result.records.slice(0, ARR_PREVIEW_LIMIT).map((ep) => ({
          id: ep.id,
          seriesId: ep.seriesId,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          airDate: ep.airDate,
          monitored: ep.monitored,
          overview: ep.overview ? truncate(ep.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(ARR_PREVIEW_LIMIT, result.records.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sonarrGetQueue(): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      const queue = await client.getQueue();
      return {
        success: true,
        totalRecords: queue.totalRecords,
        items: queue.records.slice(0, ARR_PREVIEW_LIMIT).map((item) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, queue.records.length),
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
  }): Promise<Record<string, unknown>> {
    const client = this.ensureSonarr();
    try {
      const entries = await client.getCalendar(args.startDate, args.endDate);
      return {
        success: true,
        totalEntries: entries.length,
        entries: entries.slice(0, ARR_PREVIEW_LIMIT).map((ep) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, entries.length),
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

  async radarrGetMovies(args: {
    filter?: string;
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      let movies = await client.getMovies();
      if (args.filter) {
        const f = args.filter.toLowerCase();
        movies = movies.filter((m) => m.title.toLowerCase().includes(f));
      }
      return {
        success: true,
        totalMovies: movies.length,
        movies: movies.slice(0, ARR_PREVIEW_LIMIT).map((m) => ({
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
          overview: m.overview ? truncate(m.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(ARR_PREVIEW_LIMIT, movies.length),
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
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      const results = await client.searchMovies(args.query);
      return {
        success: true,
        query: args.query,
        totalResults: results.length,
        results: results.slice(0, ARR_PREVIEW_LIMIT).map((r) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, results.length),
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
    searchForMovie?: boolean;
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

      const request: RadarrAddMovieRequest = {
        tmdbId: args.tmdbId,
        title: args.title,
        qualityProfileId,
        rootFolderPath,
        monitored: args.monitored ?? true,
        minimumAvailability: args.minimumAvailability || DEFAULT_MINIMUM_AVAILABILITY,
        addOptions: {
          searchForMovie: args.searchForMovie ?? true,
        },
      };

      const movie = await client.addMovie(request);
      return {
        success: true,
        message: `Added "${movie.title}" (${movie.year}) to Radarr`,
        movie: {
          id: movie.id,
          title: movie.title,
          year: movie.year,
          tmdbId: movie.tmdbId,
          path: movie.path,
          monitored: movie.monitored,
          qualityProfileId: movie.qualityProfileId,
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
        movies: result.records.slice(0, ARR_PREVIEW_LIMIT).map((m) => ({
          id: m.id,
          title: m.title,
          year: m.year,
          status: m.status,
          monitored: m.monitored,
          tmdbId: m.tmdbId,
          imdbId: m.imdbId,
          overview: m.overview ? truncate(m.overview, SUMMARY_PREVIEW_LENGTH) : undefined,
        })),
        showing: Math.min(ARR_PREVIEW_LIMIT, result.records.length),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async radarrGetQueue(): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      const queue = await client.getQueue();
      return {
        success: true,
        totalRecords: queue.totalRecords,
        items: queue.records.slice(0, ARR_PREVIEW_LIMIT).map((item) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, queue.records.length),
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
  }): Promise<Record<string, unknown>> {
    const client = this.ensureRadarr();
    try {
      const entries = await client.getCalendar(args.startDate, args.endDate);
      return {
        success: true,
        totalEntries: entries.length,
        entries: entries.slice(0, ARR_PREVIEW_LIMIT).map((m) => ({
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
        showing: Math.min(ARR_PREVIEW_LIMIT, entries.length),
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

    results.sonarr = sonarr.status === "fulfilled" ? sonarr.value : { available: false, error: "Check failed" };
    results.radarr = radarr.status === "fulfilled" ? radarr.value : { available: false, error: "Check failed" };

    return {
      success: true,
      services: results,
    };
  }
}
