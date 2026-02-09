/**
 * Sonarr/Radarr API Clients
 * Base class with shared auth/error handling, subclasses for service-specific endpoints.
 */

import axios, { AxiosInstance, AxiosError } from "axios";
import {
  ArrConfig,
  ArrSystemStatus,
  ArrQualityProfile,
  ArrRootFolder,
  ArrQueueResponse,
  SonarrSeries,
  SonarrSearchResult,
  SonarrCalendarEntry,
  SonarrMissingResponse,
  SonarrAddSeriesRequest,
  RadarrMovie,
  RadarrSearchResult,
  RadarrCalendarEntry,
  RadarrMissingResponse,
  RadarrAddMovieRequest,
} from "./types.js";
import {
  ARR_API_TIMEOUT,
  ARR_LARGE_REQUEST_TIMEOUT,
  ARR_DEFAULT_PAGE_SIZE,
  ARR_CALENDAR_DAYS_PAST,
  ARR_CALENDAR_DAYS_FUTURE,
} from "./constants.js";

class ArrClient {
  protected http: AxiosInstance;

  constructor(protected config: ArrConfig, protected serviceName: string) {
    this.http = axios.create({
      baseURL: `${config.baseUrl}/api/v3`,
      timeout: ARR_API_TIMEOUT,
      headers: { "X-Api-Key": config.apiKey },
    });

    this.http.interceptors.response.use(undefined, (error: AxiosError) => {
      if (error.response?.status === 401) {
        throw new Error(`${this.serviceName}: Invalid API key`);
      }
      if (error.code === "ECONNREFUSED") {
        throw new Error(
          `${this.serviceName}: Connection refused at ${config.baseUrl} — is the service running?`
        );
      }
      if (error.response?.status === 404) {
        throw new Error(
          `${this.serviceName}: Endpoint not found — check URL and API version`
        );
      }
      throw error;
    });
  }

  async getSystemStatus(): Promise<ArrSystemStatus> {
    const { data } = await this.http.get<ArrSystemStatus>("/system/status");
    return data;
  }

  async getQualityProfiles(): Promise<ArrQualityProfile[]> {
    const { data } = await this.http.get<ArrQualityProfile[]>("/qualityprofile");
    return data;
  }

  async getRootFolders(): Promise<ArrRootFolder[]> {
    const { data } = await this.http.get<ArrRootFolder[]>("/rootfolder");
    return data;
  }

  async getQueue(page = 1, pageSize = ARR_DEFAULT_PAGE_SIZE): Promise<ArrQueueResponse> {
    const { data } = await this.http.get<ArrQueueResponse>("/queue", {
      params: { page, pageSize, includeUnknownSeriesItems: true },
    });
    return data;
  }

  async testConnection(): Promise<{ success: boolean; status?: ArrSystemStatus; error?: string }> {
    try {
      const status = await this.getSystemStatus();
      return { success: true, status };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export class SonarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super(config, "Sonarr");
  }

  async getSeries(): Promise<SonarrSeries[]> {
    const { data } = await this.http.get<SonarrSeries[]>("/series");
    return data;
  }

  async getSeriesById(id: number): Promise<SonarrSeries> {
    const { data } = await this.http.get<SonarrSeries>(`/series/${id}`);
    return data;
  }

  async searchSeries(query: string): Promise<SonarrSearchResult[]> {
    const { data } = await this.http.get<SonarrSearchResult[]>("/series/lookup", {
      params: { term: query },
    });
    return data;
  }

  async addSeries(request: SonarrAddSeriesRequest): Promise<SonarrSeries> {
    const { data } = await this.http.post<SonarrSeries>("/series", request);
    return data;
  }

  async getMissing(page = 1, pageSize = ARR_DEFAULT_PAGE_SIZE): Promise<SonarrMissingResponse> {
    const { data } = await this.http.get<SonarrMissingResponse>("/wanted/missing", {
      params: { page, pageSize, sortKey: "airDateUtc", sortDirection: "descending" },
    });
    return data;
  }

  async getCalendar(startDate?: string, endDate?: string): Promise<SonarrCalendarEntry[]> {
    const start = startDate || new Date(Date.now() - ARR_CALENDAR_DAYS_PAST * 86400000).toISOString().split("T")[0];
    const end = endDate || new Date(Date.now() + ARR_CALENDAR_DAYS_FUTURE * 86400000).toISOString().split("T")[0];
    const { data } = await this.http.get<SonarrCalendarEntry[]>("/calendar", {
      params: { start, end, unmonitored: false, includeSeries: true },
    });
    return data;
  }

  async triggerSeriesSearch(seriesId: number): Promise<{ id: number }> {
    const { data } = await this.http.post<{ id: number }>("/command", {
      name: "SeriesSearch",
      seriesId,
    });
    return data;
  }

  async triggerMissingSearch(): Promise<{ id: number }> {
    const { data } = await this.http.post<{ id: number }>("/command", {
      name: "MissingEpisodeSearch",
    });
    return data;
  }
}

export class RadarrClient extends ArrClient {
  constructor(config: ArrConfig) {
    super(config, "Radarr");
  }

  async getMovies(): Promise<RadarrMovie[]> {
    const { data } = await this.http.get<RadarrMovie[]>("/movie", {
      timeout: ARR_LARGE_REQUEST_TIMEOUT,
    });
    return data;
  }

  async getMovieById(id: number): Promise<RadarrMovie> {
    const { data } = await this.http.get<RadarrMovie>(`/movie/${id}`);
    return data;
  }

  async searchMovies(query: string): Promise<RadarrSearchResult[]> {
    const { data } = await this.http.get<RadarrSearchResult[]>("/movie/lookup", {
      params: { term: query },
    });
    return data;
  }

  async addMovie(request: RadarrAddMovieRequest): Promise<RadarrMovie> {
    const { data } = await this.http.post<RadarrMovie>("/movie", request);
    return data;
  }

  async getMissing(page = 1, pageSize = ARR_DEFAULT_PAGE_SIZE): Promise<RadarrMissingResponse> {
    const { data } = await this.http.get<RadarrMissingResponse>("/wanted/missing", {
      params: { page, pageSize, sortKey: "digitalRelease", sortDirection: "descending" },
    });
    return data;
  }

  async getCalendar(startDate?: string, endDate?: string): Promise<RadarrCalendarEntry[]> {
    const start = startDate || new Date(Date.now() - ARR_CALENDAR_DAYS_PAST * 86400000).toISOString().split("T")[0];
    const end = endDate || new Date(Date.now() + ARR_CALENDAR_DAYS_FUTURE * 86400000).toISOString().split("T")[0];
    const { data } = await this.http.get<RadarrCalendarEntry[]>("/calendar", {
      params: { start, end, unmonitored: false },
    });
    return data;
  }

  async triggerMovieSearch(movieId: number): Promise<{ id: number }> {
    const { data } = await this.http.post<{ id: number }>("/command", {
      name: "MoviesSearch",
      movieIds: [movieId],
    });
    return data;
  }

  async triggerMissingSearch(): Promise<{ id: number }> {
    const { data } = await this.http.post<{ id: number }>("/command", {
      name: "MissingMoviesSearch",
    });
    return data;
  }
}
