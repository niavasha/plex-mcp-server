/**
 * Plex API Client
 * Shared HTTP client for communicating with Plex Media Server.
 * Implements PlexAPIClient interface for Trakt sync compatibility.
 */

import axios, { AxiosRequestConfig } from "axios";
import { PlexConfig } from "./types.js";
import { PLEX_TYPE_IDS, PLEX_CONTAINER_SIZE } from "./constants.js";
import { PlexAPIClient } from "../trakt/sync.js";
import { PlexMovie, PlexEpisode, PlexWatchSession } from "../trakt/mapper.js";
import { validatePlexId } from "../shared/utils.js";

export class PlexClient implements PlexAPIClient {
  constructor(private config: PlexConfig) {}

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

  getPlexTypeId(type: string): number {
    return PLEX_TYPE_IDS[type] || 1;
  }

  // PlexAPIClient implementation for Trakt sync

  async getWatchedMovies(userId?: number): Promise<PlexMovie[]> {
    const data = await this.makeRequest("/library/all", {
      type: 1,
      "X-Plex-Container-Size": PLEX_CONTAINER_SIZE,
    });

    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const movies = container.MediaContainer?.Metadata || [];
    return movies
      .filter((item) => (item.viewCount as number) > 0)
      .map((item) => ({
        ratingKey: item.ratingKey as string,
        title: item.title as string,
        year: item.year as number | undefined,
        guid: item.guid as string | undefined,
        duration: item.duration as number | undefined,
        viewCount: item.viewCount as number | undefined,
        lastViewedAt: item.lastViewedAt as number | undefined,
        addedAt: item.addedAt as number | undefined,
        updatedAt: item.updatedAt as number | undefined,
        genres: (item.Genre as Array<{ tag: string }> | undefined)?.map((g) => g.tag) || [],
        summary: item.summary as string | undefined,
      }));
  }

  async getWatchedEpisodes(userId?: number): Promise<PlexEpisode[]> {
    const episodes: PlexEpisode[] = [];

    const librariesData = await this.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];
    const showLibraries = libraries.filter((lib) => lib.type === "show");

    for (const library of showLibraries) {
      const data = await this.makeRequest(`/library/sections/${library.key}/all`, {
        type: 4,
        "X-Plex-Container-Size": PLEX_CONTAINER_SIZE,
      });

      const epContainer = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
      const libraryEpisodes = epContainer.MediaContainer?.Metadata || [];
      episodes.push(
        ...libraryEpisodes
          .filter((item) => (item.viewCount as number) > 0)
          .map((item) => ({
            ratingKey: item.ratingKey as string,
            title: item.title as string,
            seasonNumber: (item.parentIndex as number) || 1,
            episodeNumber: (item.index as number) || 1,
            duration: item.duration as number | undefined,
            viewCount: item.viewCount as number | undefined,
            lastViewedAt: item.lastViewedAt as number | undefined,
            guid: item.guid as string | undefined,
            show: {
              ratingKey: item.grandparentRatingKey as string,
              title: item.grandparentTitle as string,
              year: item.grandparentYear as number | undefined,
              guid: item.grandparentGuid as string | undefined,
            },
          }))
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

  async updateProgress(ratingKey: string, progress: number, userId?: number): Promise<void> {
    validatePlexId(ratingKey, "ratingKey");
    await this.makeRequest("/:/progress", {
      key: ratingKey,
      time: progress,
      identifier: "com.plexapp.plugins.library",
    });
  }
}
