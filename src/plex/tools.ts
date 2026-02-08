/**
 * Plex tool implementations.
 * All 12 Plex MCP tools with typed args and no `as any` casts.
 */

import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { PlexClient } from "./client.js";
import { MCPResponse } from "./types.js";
import { DEFAULT_LIMITS, COMPLETION_THRESHOLD } from "./constants.js";

/** Helper: wrap a JSON value as an MCP text response */
function jsonResponse(data: unknown): MCPResponse {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export class PlexTools {
  constructor(private client: PlexClient) {}

  // ── Core tools ──────────────────────────────────────────────

  async getLibraries(): Promise<MCPResponse> {
    const data = await this.client.makeRequest("/library/sections");
    const container = data as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = container.MediaContainer?.Directory || [];

    return jsonResponse({
      libraries: libraries.map((lib) => ({
        key: lib.key,
        title: lib.title,
        type: lib.type,
        scannedAt: lib.scannedAt,
        count: lib.count,
      })),
    });
  }

  async searchMedia(query: string, type?: string): Promise<MCPResponse> {
    const params: Record<string, string | number> = { query };
    if (type) {
      params.type = this.client.getPlexTypeId(type);
    }

    const data = await this.client.makeRequest("/search", params);
    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const results = container.MediaContainer?.Metadata || [];

    return jsonResponse({
      results: results.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        summary: item.summary,
        rating: item.rating,
        thumb: item.thumb,
      })),
    });
  }

  async getRecentlyAdded(limit: number = DEFAULT_LIMITS.recentlyAdded): Promise<MCPResponse> {
    const data = await this.client.makeRequest("/library/recentlyAdded", {
      "X-Plex-Container-Start": 0,
      "X-Plex-Container-Size": limit,
    });
    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const items = container.MediaContainer?.Metadata || [];

    return jsonResponse({
      recentlyAdded: items.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        addedAt: item.addedAt,
        summary: item.summary,
      })),
    });
  }

  async getOnDeck(): Promise<MCPResponse> {
    const data = await this.client.makeRequest("/library/onDeck");
    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const items = container.MediaContainer?.Metadata || [];

    return jsonResponse({
      onDeck: items.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        viewOffset: item.viewOffset,
        duration: item.duration,
        lastViewedAt: item.lastViewedAt,
      })),
    });
  }

  async getMediaDetails(ratingKey: string): Promise<MCPResponse> {
    const data = await this.client.makeRequest(`/library/metadata/${ratingKey}`);
    const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
    const item = container.MediaContainer?.Metadata?.[0];

    if (!item) {
      throw new McpError(ErrorCode.InvalidRequest, `Media item not found: ${ratingKey}`);
    }

    return jsonResponse({
      details: {
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        summary: item.summary,
        rating: item.rating,
        duration: item.duration,
        genres: (item.Genre as Array<{ tag: string }> | undefined)?.map((g) => g.tag) || [],
        actors: (item.Role as Array<{ tag: string }> | undefined)?.map((r) => r.tag) || [],
        directors: (item.Director as Array<{ tag: string }> | undefined)?.map((d) => d.tag) || [],
        writers: (item.Writer as Array<{ tag: string }> | undefined)?.map((w) => w.tag) || [],
        studios: (item.Studio as Array<{ tag: string }> | undefined)?.map((s) => s.tag) || [],
        addedAt: item.addedAt,
        updatedAt: item.updatedAt,
        viewCount: item.viewCount,
        lastViewedAt: item.lastViewedAt,
      },
    });
  }

  async getRecentlyWatched(limit: number = DEFAULT_LIMITS.recentlyWatched, mediaType: string = "all"): Promise<MCPResponse> {
    // Primary: use watch history endpoint
    try {
      const historyResult = await this.getWatchHistory(limit, undefined, mediaType);
      const historyData = JSON.parse(historyResult.content[0].text);

      return jsonResponse({
        recentlyWatched: historyData.watchHistory || [],
        totalCount: historyData.totalSessions || 0,
        note: "Retrieved from watch history data",
      });
    } catch {
      // Fallback: library metadata approach
      try {
        return await this.getRecentlyWatchedFromLibraries(limit, mediaType);
      } catch {
        return jsonResponse({
          recentlyWatched: [],
          totalCount: 0,
          error: "Recently watched data not available",
          message: "Unable to retrieve recently watched content from this Plex server",
        });
      }
    }
  }

  async getWatchHistory(
    limit: number = DEFAULT_LIMITS.watchHistory,
    userId?: string,
    mediaType: string = "all"
  ): Promise<MCPResponse> {
    try {
      // Primary: session history endpoint
      const params: Record<string, string | number> = {
        "X-Plex-Container-Size": limit,
        sort: "date:desc",
      };
      if (userId) {
        params.accountID = userId;
      }

      const data = await this.client.makeRequest("/status/sessions/history/all", params);
      const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
      let sessions = container.MediaContainer?.Metadata || [];

      if (mediaType !== "all") {
        const typeMap: Record<string, string> = { movie: "movie", show: "show", episode: "episode" };
        sessions = sessions.filter((session) => session.type === typeMap[mediaType]);
      }

      return jsonResponse({
        watchHistory: sessions.map((session) => ({
          sessionKey: session.sessionKey,
          ratingKey: session.ratingKey,
          title: session.title,
          type: session.type,
          year: session.year,
          viewedAt: session.viewedAt,
          duration: session.duration,
          viewOffset: session.viewOffset,
          user: (session.User as { title?: string } | undefined)?.title,
          player: (session.Player as { title?: string } | undefined)?.title,
          platform: (session.Player as { platform?: string } | undefined)?.platform,
          progress:
            (session.viewOffset as number) && (session.duration as number)
              ? Math.round(((session.viewOffset as number) / (session.duration as number)) * 100)
              : 0,
          completed:
            (session.viewOffset as number) && (session.duration as number)
              ? (session.viewOffset as number) >= (session.duration as number) * COMPLETION_THRESHOLD
              : false,
        })),
        totalSessions: sessions.length,
      });
    } catch {
      // Fallback: build pseudo-history from library metadata
      try {
        return await this.getWatchHistoryFromLibraries(limit, userId, mediaType);
      } catch {
        return jsonResponse({
          error: "Watch history not available",
          message: "Unable to retrieve watch history from this Plex server",
          suggestion: "This feature may require Plex Pass or detailed logging to be enabled",
          watchHistory: [],
        });
      }
    }
  }

  // ── Extended / analytics tools ──────────────────────────────

  async getFullyWatched(
    libraryKey?: string,
    mediaType: string = "all",
    limit: number = DEFAULT_LIMITS.fullyWatched
  ): Promise<MCPResponse> {
    try {
      let endpoint = "/library/all";
      const params: Record<string, string | number> = {
        "X-Plex-Container-Size": limit * 2,
        sort: "lastViewedAt:desc",
      };

      if (libraryKey) {
        endpoint = `/library/sections/${libraryKey}/all`;
      }
      if (mediaType !== "all") {
        params.type = this.client.getPlexTypeId(mediaType);
      }

      const data = await this.client.makeRequest(endpoint, params);
      const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
      let items = container.MediaContainer?.Metadata || [];

      items = items.filter((item) => {
        if (!(item.viewCount as number) || (item.viewCount as number) === 0) return false;
        if ((item.duration as number) && item.viewOffset !== undefined) {
          const completionPercent = (item.viewOffset as number) / (item.duration as number);
          return completionPercent >= COMPLETION_THRESHOLD;
        }
        return (item.viewCount as number) > 0 && item.lastViewedAt;
      });

      items = items.slice(0, limit);

      return jsonResponse({
        fullyWatched: items.map((item) => ({
          ratingKey: item.ratingKey,
          title: item.title,
          type: item.type,
          year: item.year,
          viewCount: item.viewCount,
          lastViewedAt: item.lastViewedAt,
          duration: item.duration,
          viewOffset: item.viewOffset,
          completionPercent:
            (item.duration as number) && (item.viewOffset as number)
              ? Math.round(((item.viewOffset as number) / (item.duration as number)) * 100)
              : 100,
          rating: item.rating,
          summary:
            ((item.summary as string) || "").substring(0, 200) +
            (((item.summary as string) || "").length > 200 ? "..." : ""),
        })),
        totalCount: items.length,
        libraryKey: libraryKey || "all",
        mediaType,
      });
    } catch {
      // Fallback: iterate libraries
      try {
        return await this.getFullyWatchedFromLibraries(libraryKey, mediaType, limit);
      } catch {
        return jsonResponse({
          error: "Fully watched data not available",
          message: "Unable to retrieve watched content from this Plex server",
          suggestion: "Check server permissions and ensure libraries are accessible",
          fullyWatched: [],
        });
      }
    }
  }

  async getWatchStats(timeRange: number = 30, statType: string = "plays"): Promise<MCPResponse> {
    const fromDate = Math.floor((Date.now() - timeRange * 24 * 60 * 60 * 1000) / 1000);

    try {
      const data = await this.client.makeRequest("/status/sessions/history/all", {
        "X-Plex-Container-Size": 1000,
      });
      const container = data as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
      const sessions = container.MediaContainer?.Metadata || [];

      const filteredSessions = sessions.filter(
        (session) => (session.viewedAt as number) && (session.viewedAt as number) >= fromDate
      );

      let stats: Record<string, unknown>;
      switch (statType) {
        case "plays":
          stats = this.calculatePlayStats(filteredSessions);
          break;
        case "duration":
          stats = this.calculateDurationStats(filteredSessions);
          break;
        case "users":
          stats = this.calculateUserStats(filteredSessions);
          break;
        case "libraries":
          stats = this.calculateLibraryStats(filteredSessions);
          break;
        case "platforms":
          stats = this.calculatePlatformStats(filteredSessions);
          break;
        default:
          stats = this.calculatePlayStats(filteredSessions);
      }

      return jsonResponse({
        timeRange: `${timeRange} days`,
        statType,
        totalSessions: filteredSessions.length,
        stats,
      });
    } catch {
      return await this.getBasicStats(timeRange, statType);
    }
  }

  async getUserStats(timeRange: number = 30): Promise<MCPResponse> {
    try {
      const data = await this.client.makeRequest("/accounts");
      const container = data as { MediaContainer?: { Account?: Record<string, unknown>[] } };
      const users = container.MediaContainer?.Account || [];

      return jsonResponse({
        users: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          thumb: user.thumb,
        })),
        totalUsers: users.length,
      });
    } catch {
      return jsonResponse({
        message: "User statistics not available",
        error: "Unable to access user data",
      });
    }
  }

  async getLibraryStats(libraryKey?: string): Promise<MCPResponse> {
    if (libraryKey) {
      const data = await this.client.makeRequest(`/library/sections/${libraryKey}`);
      const container = data as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
      const library = container.MediaContainer?.Directory?.[0];

      if (!library) {
        throw new McpError(ErrorCode.InvalidRequest, `Library not found: ${libraryKey}`);
      }

      return jsonResponse({
        library: {
          key: library.key,
          title: library.title,
          type: library.type,
          count: library.count,
          scannedAt: library.scannedAt,
          updatedAt: library.updatedAt,
          language: library.language,
          locations: (library.Location as Array<{ path: string }> | undefined)?.map((loc) => loc.path) || [],
        },
      });
    } else {
      const data = await this.client.makeRequest("/library/sections");
      const container = data as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
      const libraries = container.MediaContainer?.Directory || [];

      return jsonResponse({
        libraries: libraries.map((lib) => ({
          key: lib.key,
          title: lib.title,
          type: lib.type,
          count: lib.count,
          scannedAt: lib.scannedAt,
        })),
        totalLibraries: libraries.length,
      });
    }
  }

  async getPopularContent(
    timeRange: number = 30,
    metric: string = "plays",
    mediaType: string = "all",
    limit: number = DEFAULT_LIMITS.popularContent
  ): Promise<MCPResponse> {
    try {
      const librariesData = await this.client.makeRequest("/library/sections");
      const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
      const libraries = libContainer.MediaContainer?.Directory || [];

      let allContent: Record<string, unknown>[] = [];

      for (const library of libraries) {
        try {
          const params: Record<string, string | number> = {
            "X-Plex-Container-Size": 500,
            sort: metric === "plays" ? "viewCount:desc" : "lastViewedAt:desc",
          };
          if (mediaType !== "all") {
            params.type = this.client.getPlexTypeId(mediaType);
          }

          const contentData = await this.client.makeRequest(`/library/sections/${library.key}/all`, params);
          const container = contentData as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
          allContent.push(...(container.MediaContainer?.Metadata || []));
        } catch {
          continue;
        }
      }

      let filteredContent = allContent.filter((item) => (item.viewCount as number) > 0);

      if (metric === "plays") {
        filteredContent.sort((a, b) => ((b.viewCount as number) || 0) - ((a.viewCount as number) || 0));
      } else {
        filteredContent.sort((a, b) => ((b.lastViewedAt as number) || 0) - ((a.lastViewedAt as number) || 0));
      }

      filteredContent = filteredContent.slice(0, limit);

      return jsonResponse({
        metric,
        mediaType,
        timeRange: `${timeRange} days`,
        popularContent: filteredContent.map((item) => ({
          ratingKey: item.ratingKey,
          title: item.title,
          type: item.type,
          year: item.year,
          viewCount: item.viewCount,
          lastViewedAt: item.lastViewedAt,
          rating: item.rating,
          duration: item.duration,
        })),
      });
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, `Error getting popular content: ${error}`);
    }
  }

  // ── Private helpers ─────────────────────────────────────────

  private async getRecentlyWatchedFromLibraries(limit: number, mediaType: string): Promise<MCPResponse> {
    const librariesData = await this.client.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];

    let allRecentItems: Record<string, unknown>[] = [];

    for (const library of libraries) {
      try {
        const params: Record<string, string | number> = {
          sort: "lastViewedAt:desc",
          "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 5,
        };
        if (mediaType !== "all") {
          params.type = this.client.getPlexTypeId(mediaType);
        }

        const contentData = await this.client.makeRequest(`/library/sections/${library.key}/all`, params);
        const container = contentData as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
        const content = container.MediaContainer?.Metadata || [];

        const viewedContent = content.filter(
          (item) => item.lastViewedAt && (item.viewCount as number) > 0
        );
        allRecentItems.push(...viewedContent);
      } catch {
        continue;
      }
    }

    allRecentItems.sort((a, b) => ((b.lastViewedAt as number) || 0) - ((a.lastViewedAt as number) || 0));
    allRecentItems = allRecentItems.slice(0, limit);

    return jsonResponse({
      recentlyWatched: allRecentItems.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        lastViewedAt: item.lastViewedAt,
        viewCount: item.viewCount,
        duration: item.duration,
        viewOffset: item.viewOffset || 0,
        progress:
          (item.viewOffset as number) && (item.duration as number)
            ? Math.round(((item.viewOffset as number) / (item.duration as number)) * 100)
            : 100,
      })),
      totalCount: allRecentItems.length,
      note: "Retrieved from library metadata",
    });
  }

  private async getWatchHistoryFromLibraries(
    limit: number,
    userId?: string,
    mediaType: string = "all"
  ): Promise<MCPResponse> {
    const librariesData = await this.client.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];

    let allViewedItems: Record<string, unknown>[] = [];

    for (const library of libraries) {
      try {
        const params: Record<string, string | number> = {
          "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 5,
          sort: "lastViewedAt:desc",
        };
        if (mediaType !== "all") {
          params.type = this.client.getPlexTypeId(mediaType);
        }

        const contentData = await this.client.makeRequest(`/library/sections/${library.key}/all`, params);
        const container = contentData as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
        const content = container.MediaContainer?.Metadata || [];

        const viewedContent = content.filter(
          (item) => item.lastViewedAt && (item.viewCount as number) > 0
        );

        const historyItems = viewedContent.map((item) => ({
          ratingKey: item.ratingKey,
          title: item.title,
          type: item.type,
          year: item.year,
          lastViewedAt: item.lastViewedAt,
          viewCount: item.viewCount,
          duration: item.duration,
          viewOffset: item.viewOffset || 0,
          library: library.title,
        }));

        allViewedItems.push(...historyItems);
      } catch {
        continue;
      }
    }

    allViewedItems.sort((a, b) => ((b.lastViewedAt as number) || 0) - ((a.lastViewedAt as number) || 0));
    allViewedItems = allViewedItems.slice(0, limit);

    return jsonResponse({
      watchHistory: allViewedItems.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        lastViewedAt: item.lastViewedAt,
        viewCount: item.viewCount,
        duration: item.duration,
        viewOffset: item.viewOffset,
        library: item.library,
        progress:
          (item.viewOffset as number) && (item.duration as number)
            ? Math.round(((item.viewOffset as number) / (item.duration as number)) * 100)
            : 0,
        completed:
          (item.viewOffset as number) && (item.duration as number)
            ? (item.viewOffset as number) >= (item.duration as number) * COMPLETION_THRESHOLD
            : (item.viewCount as number) > 0,
      })),
      totalSessions: allViewedItems.length,
      note: "Generated from library metadata (fallback method)",
    });
  }

  private async getFullyWatchedFromLibraries(
    libraryKey: string | undefined,
    mediaType: string,
    limit: number
  ): Promise<MCPResponse> {
    const librariesData = await this.client.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];

    let allWatchedItems: Record<string, unknown>[] = [];

    for (const library of libraries) {
      try {
        if (libraryKey && library.key !== libraryKey) continue;

        const params: Record<string, string | number> = {
          "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 10,
          sort: "addedAt:desc",
        };
        if (mediaType !== "all") {
          params.type = this.client.getPlexTypeId(mediaType);
        }

        const contentData = await this.client.makeRequest(`/library/sections/${library.key}/all`, params);
        const container = contentData as { MediaContainer?: { Metadata?: Record<string, unknown>[] } };
        const content = container.MediaContainer?.Metadata || [];

        const watchedContent = content.filter(
          (item) => (item.viewCount as number) > 0
        );
        allWatchedItems.push(...watchedContent);
      } catch {
        continue;
      }
    }

    allWatchedItems.sort((a, b) => ((b.viewCount as number) || 0) - ((a.viewCount as number) || 0));
    allWatchedItems = allWatchedItems.slice(0, limit);

    return jsonResponse({
      fullyWatched: allWatchedItems.map((item) => ({
        ratingKey: item.ratingKey,
        title: item.title,
        type: item.type,
        year: item.year,
        viewCount: item.viewCount,
        lastViewedAt: item.lastViewedAt,
        duration: item.duration,
        rating: item.rating,
        summary:
          ((item.summary as string) || "").substring(0, 200) +
          (((item.summary as string) || "").length > 200 ? "..." : ""),
      })),
      totalCount: allWatchedItems.length,
      note: "Retrieved using fallback method - showing items with any view count",
    });
  }

  private async getBasicStats(timeRange: number, statType: string): Promise<MCPResponse> {
    const librariesData = await this.client.makeRequest("/library/sections");
    const libContainer = librariesData as { MediaContainer?: { Directory?: Record<string, unknown>[] } };
    const libraries = libContainer.MediaContainer?.Directory || [];

    return jsonResponse({
      message: "Detailed statistics not available, showing library overview",
      libraries: libraries.map((lib) => ({
        title: lib.title,
        type: lib.type,
        count: lib.count,
        scannedAt: lib.scannedAt,
      })),
    });
  }

  private calculatePlayStats(sessions: Record<string, unknown>[]) {
    const playsByDay: Record<string, number> = {};
    const playsByType: Record<string, number> = {};

    sessions.forEach((session) => {
      const date = new Date((session.viewedAt as number) * 1000).toISOString().split("T")[0];
      playsByDay[date] = (playsByDay[date] || 0) + 1;
      playsByType[session.type as string] = (playsByType[session.type as string] || 0) + 1;
    });

    return {
      totalPlays: sessions.length,
      playsByDay,
      playsByType,
      averagePlaysPerDay: sessions.length / Object.keys(playsByDay).length || 0,
    };
  }

  private calculateDurationStats(sessions: Record<string, unknown>[]) {
    let totalDuration = 0;
    const durationByType: Record<string, number> = {};

    sessions.forEach((session) => {
      const duration = (session.duration as number) || 0;
      totalDuration += duration;
      durationByType[session.type as string] = (durationByType[session.type as string] || 0) + duration;
    });

    return {
      totalDuration,
      totalDurationHours: Math.round(totalDuration / 3600000),
      durationByType,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  }

  private calculateUserStats(sessions: Record<string, unknown>[]) {
    const userCounts: Record<string, number> = {};
    const userDuration: Record<string, number> = {};

    sessions.forEach((session) => {
      const user = (session.User as { title?: string } | undefined)?.title || "Unknown";
      userCounts[user] = (userCounts[user] || 0) + 1;
      userDuration[user] = (userDuration[user] || 0) + ((session.duration as number) || 0);
    });

    return {
      uniqueUsers: Object.keys(userCounts).length,
      userPlayCounts: userCounts,
      userWatchTime: userDuration,
      topUsers: Object.entries(userCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
    };
  }

  private calculateLibraryStats(sessions: Record<string, unknown>[]) {
    const libraryCounts: Record<string, number> = {};

    sessions.forEach((session) => {
      const library = (session.librarySectionTitle as string) || "Unknown";
      libraryCounts[library] = (libraryCounts[library] || 0) + 1;
    });

    return {
      libraryPlayCounts: libraryCounts,
      topLibraries: Object.entries(libraryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
    };
  }

  private calculatePlatformStats(sessions: Record<string, unknown>[]) {
    const platformCounts: Record<string, number> = {};

    sessions.forEach((session) => {
      const platform = (session.Player as { platform?: string } | undefined)?.platform || "Unknown";
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    return {
      platformPlayCounts: platformCounts,
      topPlatforms: Object.entries(platformCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
    };
  }
}
