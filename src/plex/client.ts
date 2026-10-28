/**
 * Plex API Client
 * Shared HTTP client for communicating with Plex Media Server.
 * Implements PlexAPIClient interface for Trakt sync compatibility.
 */

import axios, { AxiosRequestConfig } from "axios";
import { PlexConfig, LibraryMovieRecord } from "./types.js";
import { PLEX_TYPE_IDS, PLEX_CONTAINER_SIZE, PLEX_MAX_PAGES } from "./constants.js";
import { PlexAPIClient } from "../trakt/sync.js";
import { PlexMovie, PlexShow, PlexEpisode, PlexWatchSession } from "../trakt/mapper.js";
import { validatePlexId } from "../shared/utils.js";

const PLEX_DISCOVER_BASE_URL = "https://discover.provider.plex.tv";

export class PlexClient implements PlexAPIClient {
  constructor(private config: PlexConfig) {
    // Strip trailing slashes to prevent double-slash in URLs
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
      clientIdentifier: config.clientIdentifier || "plex-mcp-server",
    };
  }

  async makeRequest(endpoint: string, params: Record<string, string | number> = {}, method: string = "GET"): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const axiosConfig: AxiosRequestConfig = {
      method,
      headers: {
        "X-Plex-Token": this.config.token,
        Accept: "application/json",
      },
      params,
    };

    const response = await axios(url, axiosConfig);
    return response.data;
  }

  async makeDiscoverRequest(
    endpoint: string,
    params: Record<string, string | number> = {},
    method: string = "GET"
  ): Promise<Record<string, unknown>> {
    const response = await axios(`${PLEX_DISCOVER_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "X-Plex-Token": this.config.token,
        "X-Plex-Client-Identifier": this.config.clientIdentifier,
        "X-Plex-Product": "plex-mcp-server",
        Accept: "application/json",
      },
      params,
    });
    return response.data;
  }

  getPlexTypeId(type: string): number {
    if (!Object.hasOwn(PLEX_TYPE_IDS, type)) {
      throw new Error(`Unknown media type "${type}". Expected one of: ${Object.keys(PLEX_TYPE_IDS).join(", ")}`);
    }
    return PLEX_TYPE_IDS[type];
  }

  // PlexAPIClient implementation for Trakt sync

  async getWatchedMovies(userId?: number): Promise<PlexMovie[]> {
    const movies = await this.fetchAllPages("/library/all", { type: 1, includeGuids: 1 });
    return movies
      .filter((item) => (item.viewCount as number) > 0)
      .map((item) => ({
        ratingKey: item.ratingKey as string,
        title: item.title as string,
        year: item.year as number | undefined,
        guid: item.guid as string | undefined,
        Guid: this.externalGuids(item.Guid),
        duration: item.duration as number | undefined,
        viewCount: item.viewCount as number | undefined,
        lastViewedAt: item.lastViewedAt as number | undefined,
        addedAt: item.addedAt as number | undefined,
        updatedAt: item.updatedAt as number | undefined,
        genres: (item.Genre as Array<{ tag: string }> | undefined)?.map((g) => g.tag) || [],
        summary: item.summary as string | undefined,
      }));
  }

  async getLibraryMoviesWithMeta(libraryKey: string, userId?: string): Promise<LibraryMovieRecord[]> {
    const allMovies: LibraryMovieRecord[] = [];
    let offset = 0;
    const pageSize = PLEX_CONTAINER_SIZE;

    while (true) {
      const params: Record<string, string | number> = {
        type: 1,
        "X-Plex-Container-Start": offset,
        "X-Plex-Container-Size": pageSize,
      };
      if (userId) params.accountID = userId;

      const data = await this.makeRequest(`/library/sections/${libraryKey}/all`, params);
      const container = data as { MediaContainer?: { totalSize?: number; Metadata?: Record<string, unknown>[] } };
      const totalSize = container.MediaContainer?.totalSize || 0;
      const items = container.MediaContainer?.Metadata || [];

      for (const item of items) {
        allMovies.push({
          ratingKey: item.ratingKey as string,
          title: item.title as string,
          year: item.year as number | undefined,
          viewCount: (item.viewCount as number) || 0,
          lastViewedAt: item.lastViewedAt as number | undefined,
          rating: item.audienceRating as number | undefined ?? item.rating as number | undefined,
          genres: (item.Genre as Array<{ tag: string }> | undefined)?.map((g) => g.tag) || [],
          directors: (item.Director as Array<{ tag: string }> | undefined)?.map((d) => d.tag) || [],
          actors: (item.Role as Array<{ tag: string }> | undefined)?.map((r) => r.tag) || [],
        });
      }

      offset += items.length;
      if (offset >= totalSize || items.length === 0) break;
    }

    return allMovies;
  }

  async getWatchedEpisodes(userId?: number): Promise<PlexEpisode[]> {
    const episodes: PlexEpisode[] = [];

    const librariesData = await this.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];
    const showLibraries = libraries.filter((lib) => lib.type === "show");

    for (const library of showLibraries) {
      const libraryKey = String(library.key);
      const showsByRatingKey = await this.getShowsByRatingKey(libraryKey);
      const libraryEpisodes = await this.fetchAllPages(`/library/sections/${libraryKey}/all`, {
        type: 4,
        includeGuids: 1,
      });
      episodes.push(
        ...libraryEpisodes
          .filter((item) => (item.viewCount as number) > 0)
          .map((item) => this.toWatchedEpisode(item, showsByRatingKey))
      );
    }

    return episodes;
  }

  async getCurrentSessions(): Promise<PlexWatchSession[]> {
    const data = await this.makeRequest("/status/sessions");
    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const sessions = container.MediaContainer?.Metadata || [];

    return sessions.map((session) => ({
      ratingKey: session.ratingKey as string,
      title: session.title as string,
      type: (session.type === "movie" ? "movie" : "episode") as "movie" | "episode",
      viewOffset: session.viewOffset as number | undefined,
      duration: session.duration as number | undefined,
      progress:
        (session.viewOffset as number) && (session.duration as number)
          ? Math.round(((session.viewOffset as number) / (session.duration as number)) * 100)
          : 0,
      sessionKey: session.sessionKey as string | undefined,
      userId: (session.User as { id?: number } | undefined)?.id,
      userName: (session.User as { title?: string } | undefined)?.title,
      state: "playing" as const,
      seasonNumber: session.parentIndex as number | undefined,
      episodeNumber: session.index as number | undefined,
    }));
  }

  async markAsWatched(ratingKey: string, userId?: number): Promise<void> {
    validatePlexId(ratingKey, "ratingKey");
    await this.makeRequest("/:/scrobble", {
      key: ratingKey,
      identifier: "com.plexapp.plugins.library",
    });
  }

  async rateMedia(ratingKey: string, rating: number): Promise<void> {
    validatePlexId(ratingKey, "ratingKey");
    await this.makeRequest(
      "/:/rate",
      {
        key: ratingKey,
        identifier: "com.plexapp.plugins.library",
        rating,
      },
      "PUT"
    );
  }

  async markAsUnwatched(ratingKey: string): Promise<void> {
    validatePlexId(ratingKey, "ratingKey");
    await this.makeRequest("/:/unscrobble", {
      key: ratingKey,
      identifier: "com.plexapp.plugins.library",
    });
  }

  async updateProgress(ratingKey: string, progress: number, userId?: number): Promise<void> {
    validatePlexId(ratingKey, "ratingKey");
    await this.makeRequest("/:/progress", {
      key: ratingKey,
      time: progress,
      identifier: "com.plexapp.plugins.library",
    });
  }

  /**
   * Fetch every item of a listing, one PLEX_CONTAINER_SIZE page at a time.
   * Some endpoints omit totalSize, so a missing total means "unknown" and only
   * a short or empty page ends the walk.
   */
  private async fetchAllPages(
    endpoint: string,
    params: Record<string, string | number>
  ): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];

    for (let page = 0; page < PLEX_MAX_PAGES; page++) {
      const data = await this.makeRequest(endpoint, {
        ...params,
        "X-Plex-Container-Start": all.length,
        "X-Plex-Container-Size": PLEX_CONTAINER_SIZE,
      });
      const container = data as { MediaContainer?: { totalSize?: number; Metadata?: Record<string, unknown>[] } };
      const items = container.MediaContainer?.Metadata || [];
      const totalSize = container.MediaContainer?.totalSize;
      all.push(...items);

      if (items.length < PLEX_CONTAINER_SIZE) return all;
      if (typeof totalSize === "number" && all.length >= totalSize) return all;
    }

    throw new Error(
      `Plex listing ${endpoint} did not finish within ${PLEX_MAX_PAGES} pages of ${PLEX_CONTAINER_SIZE} items`
    );
  }

  private async getShowsByRatingKey(libraryKey: string): Promise<Map<string, PlexShow>> {
    const items = await this.fetchAllPages(`/library/sections/${libraryKey}/all`, {
      type: 2,
      includeGuids: 1,
    });
    const shows = new Map<string, PlexShow>();

    for (const item of items) {
      if (item.ratingKey === undefined || item.ratingKey === null) continue;
      const ratingKey = String(item.ratingKey);
      shows.set(ratingKey, {
        ratingKey,
        title: (item.title as string) || "",
        year: item.year as number | undefined,
        guid: item.guid as string | undefined,
        Guid: this.externalGuids(item.Guid),
      });
    }

    return shows;
  }

  private toWatchedEpisode(
    item: Record<string, unknown>,
    showsByRatingKey: Map<string, PlexShow>
  ): PlexEpisode {
    const grandparentKey = this.ratingKeyString(item.grandparentRatingKey);
    const matched = grandparentKey ? showsByRatingKey.get(grandparentKey) : undefined;

    return {
      ratingKey: item.ratingKey as string,
      title: item.title as string,
      seasonNumber: (item.parentIndex as number) || 1,
      episodeNumber: (item.index as number) || 1,
      duration: item.duration as number | undefined,
      viewCount: item.viewCount as number | undefined,
      lastViewedAt: item.lastViewedAt as number | undefined,
      guid: item.guid as string | undefined,
      Guid: this.externalGuids(item.Guid),
      show: {
        ratingKey: matched?.ratingKey ?? grandparentKey ?? "",
        title: matched?.title || (item.grandparentTitle as string),
        year: matched?.year ?? (item.grandparentYear as number | undefined),
        guid: matched?.guid ?? (item.grandparentGuid as string | undefined),
        Guid: matched?.Guid,
      },
    };
  }

  private ratingKeyString(value: unknown): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    return String(value);
  }

  private externalGuids(value: unknown): { id: string }[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const guids: { id: string }[] = [];
    for (const entry of value) {
      if (!entry || typeof entry !== "object" || !("id" in entry)) continue;
      const id = (entry as { id: unknown }).id;
      if (typeof id !== "string" || id.length === 0) continue;
      guids.push({ id });
    }
    return guids;
  }
}
