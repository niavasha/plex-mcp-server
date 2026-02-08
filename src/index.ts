#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";

// Plex API configuration
interface PlexConfig {
  baseUrl: string;
  token: string;
}

class PlexMCPServer {
  private server: Server;
  private plexConfig: PlexConfig;

  constructor() {
    this.server = new Server(
      {
        name: "plex-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Load configuration from environment variables
    this.plexConfig = {
      baseUrl: process.env.PLEX_URL || "http://localhost:32400",
      token: process.env.PLEX_TOKEN || "",
    };

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "get_libraries",
            description: "Get all Plex libraries",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "search_media",
            description: "Search for media in Plex libraries",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                type: {
                  type: "string",
                  description: "Media type (movie, show, episode, artist, album, track)",
                  enum: ["movie", "show", "episode", "artist", "album", "track"],
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_recently_added",
            description: "Get recently added media",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Number of items to return (default: 10)",
                  default: 10,
                },
              },
            },
          },
          {
            name: "get_on_deck",
            description: "Get on deck (continue watching) items",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "get_media_details",
            description: "Get detailed information about a specific media item",
            inputSchema: {
              type: "object",
              properties: {
                ratingKey: {
                  type: "string",
                  description: "The rating key of the media item",
                },
              },
              required: ["ratingKey"],
            },
          },
          {
            name: "get_recently_watched",
            description: "Get recently watched movies and shows",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Number of items to return (default: 25)",
                  default: 25,
                },
                mediaType: {
                  type: "string",
                  description: "Filter by media type (movie, show, episode, all)",
                  enum: ["movie", "show", "episode", "all"],
                  default: "all",
                },
              },
            },
          },
          {
            name: "get_fully_watched",
            description: "Get all fully watched movies and shows from a library",
            inputSchema: {
              type: "object",
              properties: {
                libraryKey: {
                  type: "string",
                  description: "Library section key (optional, searches all if not provided)",
                },
                mediaType: {
                  type: "string",
                  description: "Filter by media type (movie, show, all)",
                  enum: ["movie", "show", "all"],
                  default: "all",
                },
                limit: {
                  type: "number",
                  description: "Number of items to return (default: 100)",
                  default: 100,
                },
              },
            },
          },
          {
            name: "get_watch_stats",
            description: "Get comprehensive watch statistics (Tautulli-style analytics)",
            inputSchema: {
              type: "object",
              properties: {
                timeRange: {
                  type: "number",
                  description: "Time range in days (default: 30)",
                  default: 30,
                },
                statType: {
                  type: "string",
                  description: "Type of statistics to retrieve",
                  enum: ["plays", "duration", "users", "libraries", "platforms"],
                  default: "plays",
                },
              },
            },
          },
          {
            name: "get_user_stats",
            description: "Get user-specific watch statistics",
            inputSchema: {
              type: "object",
              properties: {
                timeRange: {
                  type: "number",
                  description: "Time range in days (default: 30)",
                  default: 30,
                },
              },
            },
          },
          {
            name: "get_library_stats",
            description: "Get library-specific statistics",
            inputSchema: {
              type: "object",
              properties: {
                libraryKey: {
                  type: "string",
                  description: "Library section key (optional)",
                },
              },
            },
          },
          {
            name: "get_popular_content",
            description: "Get most popular content by plays or duration",
            inputSchema: {
              type: "object",
              properties: {
                timeRange: {
                  type: "number",
                  description: "Time range in days (default: 30)",
                  default: 30,
                },
                metric: {
                  type: "string",
                  description: "Sort by plays or total duration",
                  enum: ["plays", "duration"],
                  default: "plays",
                },
                mediaType: {
                  type: "string",
                  description: "Filter by media type",
                  enum: ["movie", "show", "episode", "all"],
                  default: "all",
                },
                limit: {
                  type: "number",
                  description: "Number of items to return (default: 10)",
                  default: 10,
                },
              },
            },
          },
          {
            name: "get_watch_history",
            description: "Get detailed watch history with session information",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Number of sessions to return (default: 50)",
                  default: 50,
                },
                userId: {
                  type: "string",
                  description: "Filter by specific user ID (optional)",
                },
                mediaType: {
                  type: "string",
                  description: "Filter by media type",
                  enum: ["movie", "show", "episode", "all"],
                  default: "all",
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_libraries":
            return await this.getLibraries();
          case "search_media":
            return await this.searchMedia(
              (args as any)?.query as string, 
              (args as any)?.type as string
            );
          case "get_recently_added":
            return await this.getRecentlyAdded(((args as any)?.limit as number) || 10);
          case "get_on_deck":
            return await this.getOnDeck();
          case "get_media_details":
            return await this.getMediaDetails((args as any)?.ratingKey as string);
          case "get_recently_watched":
            return await this.getRecentlyWatched(
              ((args as any)?.limit as number) || 25,
              (args as any)?.mediaType as string || "all"
            );
          case "get_fully_watched":
            return await this.getFullyWatched(
              (args as any)?.libraryKey as string,
              (args as any)?.mediaType as string || "all",
              ((args as any)?.limit as number) || 100
            );
          case "get_watch_stats":
            return await this.getWatchStats(
              ((args as any)?.timeRange as number) || 30,
              (args as any)?.statType as string || "plays"
            );
          case "get_user_stats":
            return await this.getUserStats(((args as any)?.timeRange as number) || 30);
          case "get_library_stats":
            return await this.getLibraryStats((args as any)?.libraryKey as string);
          case "get_popular_content":
            return await this.getPopularContent(
              ((args as any)?.timeRange as number) || 30,
              (args as any)?.metric as string || "plays",
              (args as any)?.mediaType as string || "all",
              ((args as any)?.limit as number) || 10
            );
          case "get_watch_history":
            return await this.getWatchHistory(
              ((args as any)?.limit as number) || 50,
              (args as any)?.userId as string,
              (args as any)?.mediaType as string || "all"
            );
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${errorMessage}`
        );
      }
    });
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}, method: string = 'GET') {
    const url = `${this.plexConfig.baseUrl}${endpoint}`;
    const config: any = {
      method,
      headers: {
        "X-Plex-Token": this.plexConfig.token,
        Accept: "application/json",
      },
      params,
    };

    const response = await axios(url, config);
    return response.data;
  }

  private async getLibraries() {
    const data = await this.makeRequest("/library/sections");
    const libraries = data.MediaContainer?.Directory || [];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            libraries: libraries.map((lib: any) => ({
              key: lib.key,
              title: lib.title,
              type: lib.type,
              scannedAt: lib.scannedAt,
              count: lib.count,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async searchMedia(query: string, type?: string) {
    const params: Record<string, any> = { query };
    if (type) {
      params.type = this.getPlexTypeId(type);
    }

    const data = await this.makeRequest("/search", params);
    const results = data.MediaContainer?.Metadata || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            results: results.map((item: any) => ({
              ratingKey: item.ratingKey,
              title: item.title,
              type: item.type,
              year: item.year,
              summary: item.summary,
              rating: item.rating,
              thumb: item.thumb,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getWatchlist() {
    try {
      // Try the primary watchlist endpoint
      const data = await this.makeRequest("/library/sections/watchlist/all");
      const watchlist = data.MediaContainer?.Metadata || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              watchlist: watchlist.map((item: any) => ({
                ratingKey: item.ratingKey,
                title: item.title,
                type: item.type,
                year: item.year,
                summary: item.summary,
                addedAt: item.addedAt,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback: Try alternative watchlist endpoint
      try {
        const data = await this.makeRequest("/library/metadata/watchlist");
        const watchlist = data.MediaContainer?.Metadata || [];
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                watchlist: watchlist.map((item: any) => ({
                  ratingKey: item.ratingKey,
                  title: item.title,
                  type: item.type,
                  year: item.year,
                  summary: item.summary,
                  addedAt: item.addedAt,
                })),
                note: "Retrieved using alternative endpoint",
              }, null, 2),
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Watchlist not available",
                message: "Your Plex server may not have the watchlist feature enabled or accessible through the API",
                suggestion: "Try enabling the watchlist feature in your Plex settings or check if your Plex Pass subscription is active",
                watchlist: [],
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private async addToWatchlist(ratingKey: string) {
    try {
      // Try the primary watchlist add endpoint
      await this.makeRequest(`/actions/addToWatchlist`, { ratingKey });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully added item ${ratingKey} to watchlist`,
          },
        ],
      };
    } catch (error) {
      // Try alternative endpoint
      try {
        await this.makeRequest(`/library/metadata/${ratingKey}/watchlist`, {}, 'PUT');
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully added item ${ratingKey} to watchlist (using alternative method)`,
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Cannot add to watchlist",
                message: "Watchlist functionality is not available on this Plex server",
                suggestion: "Ensure Plex Pass is active and watchlist feature is enabled",
                ratingKey,
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private async removeFromWatchlist(ratingKey: string) {
    try {
      await this.makeRequest(`/actions/removeFromWatchlist`, { ratingKey });
      
      return {
        content: [
          {
            type: "text",
            text: `Successfully removed item ${ratingKey} from watchlist`,
          },
        ],
      };
    } catch (error) {
      // Try alternative endpoint
      try {
        await this.makeRequest(`/library/metadata/${ratingKey}/watchlist`, {}, 'DELETE');
        
        return {
          content: [
            {
              type: "text",
              text: `Successfully removed item ${ratingKey} from watchlist (using alternative method)`,
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Cannot remove from watchlist",
                message: "Watchlist functionality is not available on this Plex server",
                suggestion: "Ensure Plex Pass is active and watchlist feature is enabled",
                ratingKey,
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private async getRecentlyAdded(limit: number) {
    const data = await this.makeRequest("/library/recentlyAdded", { 
      "X-Plex-Container-Start": 0,
      "X-Plex-Container-Size": limit,
    });
    const items = data.MediaContainer?.Metadata || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recentlyAdded: items.map((item: any) => ({
              ratingKey: item.ratingKey,
              title: item.title,
              type: item.type,
              year: item.year,
              addedAt: item.addedAt,
              summary: item.summary,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getOnDeck() {
    const data = await this.makeRequest("/library/onDeck");
    const items = data.MediaContainer?.Metadata || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            onDeck: items.map((item: any) => ({
              ratingKey: item.ratingKey,
              title: item.title,
              type: item.type,
              viewOffset: item.viewOffset,
              duration: item.duration,
              lastViewedAt: item.lastViewedAt,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getMediaDetails(ratingKey: string) {
    const data = await this.makeRequest(`/library/metadata/${ratingKey}`);
    const item = data.MediaContainer?.Metadata?.[0];

    if (!item) {
      throw new McpError(ErrorCode.InvalidRequest, `Media item not found: ${ratingKey}`);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            details: {
              ratingKey: item.ratingKey,
              title: item.title,
              type: item.type,
              year: item.year,
              summary: item.summary,
              rating: item.rating,
              duration: item.duration,
              genres: item.Genre?.map((g: any) => g.tag) || [],
              actors: item.Role?.map((r: any) => r.tag) || [],
              directors: item.Director?.map((d: any) => d.tag) || [],
              writers: item.Writer?.map((w: any) => w.tag) || [],
              studios: item.Studio?.map((s: any) => s.tag) || [],
              addedAt: item.addedAt,
              updatedAt: item.updatedAt,
              viewCount: item.viewCount,
              lastViewedAt: item.lastViewedAt,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async getRecentlyWatched(limit: number, mediaType: string) {
    // Use the working watch history function as the foundation
    try {
      const historyResult = await this.getWatchHistory(limit, undefined, mediaType);
      const historyData = JSON.parse(historyResult.content[0].text);
      
      // Transform watch history into recently watched format
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              recentlyWatched: historyData.watchHistory || [],
              totalCount: historyData.totalSessions || 0,
              note: "Retrieved from watch history data",
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback to library metadata approach
      try {
        const librariesData = await this.makeRequest("/library/sections");
        const libraries = librariesData.MediaContainer?.Directory || [];
        
        let allRecentItems: any[] = [];
        
        for (const library of libraries) {
          try {
            const params: Record<string, any> = {
              sort: "lastViewedAt:desc",
              "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 5,
            };
            
            if (mediaType !== "all") {
              params.type = this.getPlexTypeId(mediaType);
            }
            
            const contentData = await this.makeRequest(`/library/sections/${library.key}/all`, params);
            const content = contentData.MediaContainer?.Metadata || [];
            
            // Filter items that have been viewed recently
            const viewedContent = content.filter((item: any) => 
              item.lastViewedAt && item.viewCount > 0
            );
            
            allRecentItems.push(...viewedContent);
          } catch (libError) {
            continue;
          }
        }
        
        // Sort by last viewed date and take requested number
        allRecentItems.sort((a: any, b: any) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
        allRecentItems = allRecentItems.slice(0, limit);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                recentlyWatched: allRecentItems.map((item: any) => ({
                  ratingKey: item.ratingKey,
                  title: item.title,
                  type: item.type,
                  year: item.year,
                  lastViewedAt: item.lastViewedAt,
                  viewCount: item.viewCount,
                  duration: item.duration,
                  viewOffset: item.viewOffset || 0,
                  progress: item.viewOffset && item.duration ? 
                    Math.round((item.viewOffset / item.duration) * 100) : 100,
                })),
                totalCount: allRecentItems.length,
                note: "Retrieved from library metadata",
              }, null, 2),
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                recentlyWatched: [],
                totalCount: 0,
                error: "Recently watched data not available",
                message: "Unable to retrieve recently watched content from this Plex server",
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private async getFullyWatched(libraryKey?: string, mediaType: string = "all", limit: number = 100) {
    try {
      let endpoint = "/library/all";
      const params: Record<string, any> = {
        "X-Plex-Container-Size": limit * 2, // Get more to filter properly
        sort: "lastViewedAt:desc",
      };

      // If library key is specified, search that library
      if (libraryKey) {
        endpoint = `/library/sections/${libraryKey}/all`;
      }

      // Add media type filter
      if (mediaType !== "all") {
        params.type = this.getPlexTypeId(mediaType);
      }

      const data = await this.makeRequest(endpoint, params);
      let items = data.MediaContainer?.Metadata || [];

      // Filter for fully watched items
      items = items.filter((item: any) => {
        // Must have been viewed at least once
        if (!item.viewCount || item.viewCount === 0) return false;
        
        // For items with duration, check completion percentage
        if (item.duration && item.viewOffset !== undefined) {
          const completionPercent = (item.viewOffset / item.duration) * 100;
          return completionPercent >= 85; // 85% completion threshold
        }
        
        // For items without viewOffset data, check if viewCount > 0 and lastViewedAt exists
        return item.viewCount > 0 && item.lastViewedAt;
      });

      // Take only the requested number
      items = items.slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              fullyWatched: items.map((item: any) => ({
                ratingKey: item.ratingKey,
                title: item.title,
                type: item.type,
                year: item.year,
                viewCount: item.viewCount,
                lastViewedAt: item.lastViewedAt,
                duration: item.duration,
                viewOffset: item.viewOffset,
                completionPercent: item.duration && item.viewOffset ? 
                  Math.round((item.viewOffset / item.duration) * 100) : 100,
                rating: item.rating,
                summary: item.summary?.substring(0, 200) + (item.summary?.length > 200 ? "..." : ""),
              })),
              totalCount: items.length,
              libraryKey: libraryKey || "all",
              mediaType,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback: Try to get any watched content from libraries
      try {
        const librariesData = await this.makeRequest("/library/sections");
        const libraries = librariesData.MediaContainer?.Directory || [];
        
        let allWatchedItems: any[] = [];
        
        for (const library of libraries) {
          try {
            // Skip if we want a specific library and this isn't it
            if (libraryKey && library.key !== libraryKey) continue;
            
            const params: Record<string, any> = {
              "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 10,
              sort: "addedAt:desc", // Fallback to addedAt if lastViewedAt doesn't work
            };
            
            if (mediaType !== "all") {
              params.type = this.getPlexTypeId(mediaType);
            }
            
            const contentData = await this.makeRequest(`/library/sections/${library.key}/all`, params);
            const content = contentData.MediaContainer?.Metadata || [];
            
            // Simple filter - items that have any view count
            const watchedContent = content.filter((item: any) => 
              item.viewCount && item.viewCount > 0
            );
            
            allWatchedItems.push(...watchedContent);
          } catch (libError) {
            continue;
          }
        }
        
        // Sort by view count (most watched first) and take requested number
        allWatchedItems.sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));
        allWatchedItems = allWatchedItems.slice(0, limit);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                fullyWatched: allWatchedItems.map((item: any) => ({
                  ratingKey: item.ratingKey,
                  title: item.title,
                  type: item.type,
                  year: item.year,
                  viewCount: item.viewCount,
                  lastViewedAt: item.lastViewedAt,
                  duration: item.duration,
                  rating: item.rating,
                  summary: item.summary?.substring(0, 200) + (item.summary?.length > 200 ? "..." : ""),
                })),
                totalCount: allWatchedItems.length,
                note: "Retrieved using fallback method - showing items with any view count",
              }, null, 2),
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Fully watched data not available",
                message: "Unable to retrieve watched content from this Plex server",
                suggestion: "Check server permissions and ensure libraries are accessible",
                fullyWatched: [],
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private async getWatchStats(timeRange: number, statType: string) {
    const fromDate = Math.floor((Date.now() - (timeRange * 24 * 60 * 60 * 1000)) / 1000);
    
    try {
      // Get watch history for the time range
      const historyData = await this.makeRequest("/status/sessions/history/all", {
        "X-Plex-Container-Size": 1000,
      });

      const sessions = historyData.MediaContainer?.Metadata || [];
      
      // Filter sessions by time range
      const filteredSessions = sessions.filter((session: any) => 
        session.viewedAt && session.viewedAt >= fromDate
      );

      let stats: any = {};

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

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              timeRange: `${timeRange} days`,
              statType,
              totalSessions: filteredSessions.length,
              stats,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback to basic library stats if detailed history isn't available
      return await this.getBasicStats(timeRange, statType);
    }
  }

  private calculatePlayStats(sessions: any[]) {
    const playsByDay: Record<string, number> = {};
    const playsByType: Record<string, number> = {};
    
    sessions.forEach((session: any) => {
      const date = new Date(session.viewedAt * 1000).toISOString().split('T')[0];
      playsByDay[date] = (playsByDay[date] || 0) + 1;
      playsByType[session.type] = (playsByType[session.type] || 0) + 1;
    });

    return {
      totalPlays: sessions.length,
      playsByDay,
      playsByType,
      averagePlaysPerDay: sessions.length / Object.keys(playsByDay).length || 0,
    };
  }

  private calculateDurationStats(sessions: any[]) {
    let totalDuration = 0;
    const durationByType: Record<string, number> = {};
    
    sessions.forEach((session: any) => {
      const duration = session.duration || 0;
      totalDuration += duration;
      durationByType[session.type] = (durationByType[session.type] || 0) + duration;
    });

    return {
      totalDuration: totalDuration,
      totalDurationHours: Math.round(totalDuration / 3600000), // Convert to hours
      durationByType,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  }

  private calculateUserStats(sessions: any[]) {
    const userCounts: Record<string, number> = {};
    const userDuration: Record<string, number> = {};
    
    sessions.forEach((session: any) => {
      const user = session.User?.title || "Unknown";
      userCounts[user] = (userCounts[user] || 0) + 1;
      userDuration[user] = (userDuration[user] || 0) + (session.duration || 0);
    });

    return {
      uniqueUsers: Object.keys(userCounts).length,
      userPlayCounts: userCounts,
      userWatchTime: userDuration,
      topUsers: Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
    };
  }

  private calculateLibraryStats(sessions: any[]) {
    const libraryCounts: Record<string, number> = {};
    
    sessions.forEach((session: any) => {
      const library = session.librarySectionTitle || "Unknown";
      libraryCounts[library] = (libraryCounts[library] || 0) + 1;
    });

    return {
      libraryPlayCounts: libraryCounts,
      topLibraries: Object.entries(libraryCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
    };
  }

  private calculatePlatformStats(sessions: any[]) {
    const platformCounts: Record<string, number> = {};
    
    sessions.forEach((session: any) => {
      const platform = session.Player?.platform || "Unknown";
      platformCounts[platform] = (platformCounts[platform] || 0) + 1;
    });

    return {
      platformPlayCounts: platformCounts,
      topPlatforms: Object.entries(platformCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10),
    };
  }

  private async getBasicStats(timeRange: number, statType: string) {
    // Fallback implementation using library data
    const librariesData = await this.makeRequest("/library/sections");
    const libraries = librariesData.MediaContainer?.Directory || [];
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: "Detailed statistics not available, showing library overview",
            libraries: libraries.map((lib: any) => ({
              title: lib.title,
              type: lib.type,
              count: lib.count,
              scannedAt: lib.scannedAt,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async getUserStats(timeRange: number) {
    try {
      const data = await this.makeRequest("/accounts");
      const users = data.MediaContainer?.Account || [];
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              users: users.map((user: any) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                thumb: user.thumb,
              })),
              totalUsers: users.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "User statistics not available",
              error: "Unable to access user data",
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getLibraryStats(libraryKey?: string) {
    if (libraryKey) {
      const data = await this.makeRequest(`/library/sections/${libraryKey}`);
      const library = data.MediaContainer?.Directory?.[0];
      
      if (!library) {
        throw new McpError(ErrorCode.InvalidRequest, `Library not found: ${libraryKey}`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              library: {
                key: library.key,
                title: library.title,
                type: library.type,
                count: library.count,
                scannedAt: library.scannedAt,
                updatedAt: library.updatedAt,
                language: library.language,
                locations: library.Location?.map((loc: any) => loc.path) || [],
              },
            }, null, 2),
          },
        ],
      };
    } else {
      const data = await this.makeRequest("/library/sections");
      const libraries = data.MediaContainer?.Directory || [];
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              libraries: libraries.map((lib: any) => ({
                key: lib.key,
                title: lib.title,
                type: lib.type,
                count: lib.count,
                scannedAt: lib.scannedAt,
              })),
              totalLibraries: libraries.length,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getPopularContent(timeRange: number, metric: string, mediaType: string, limit: number) {
    try {
      // Get all library content
      const librariesData = await this.makeRequest("/library/sections");
      const libraries = librariesData.MediaContainer?.Directory || [];
      
      let allContent: any[] = [];
      
      for (const library of libraries) {
        try {
          const params: Record<string, any> = {
            "X-Plex-Container-Size": 500,
            sort: metric === "plays" ? "viewCount:desc" : "lastViewedAt:desc",
          };
          
          if (mediaType !== "all") {
            params.type = this.getPlexTypeId(mediaType);
          }
          
          const contentData = await this.makeRequest(`/library/sections/${library.key}/all`, params);
          const content = contentData.MediaContainer?.Metadata || [];
          allContent.push(...content);
        } catch (error) {
          // Skip libraries that can't be accessed
          continue;
        }
      }
      
      // Filter and sort content
      let filteredContent = allContent.filter((item: any) => 
        item.viewCount && item.viewCount > 0
      );
      
      if (metric === "plays") {
        filteredContent.sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));
      } else {
        filteredContent.sort((a: any, b: any) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
      }
      
      filteredContent = filteredContent.slice(0, limit);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              metric,
              mediaType,
              timeRange: `${timeRange} days`,
              popularContent: filteredContent.map((item: any) => ({
                ratingKey: item.ratingKey,
                title: item.title,
                type: item.type,
                year: item.year,
                viewCount: item.viewCount,
                lastViewedAt: item.lastViewedAt,
                rating: item.rating,
                duration: item.duration,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(ErrorCode.InternalError, `Error getting popular content: ${error}`);
    }
  }

  private async getWatchHistory(limit: number, userId?: string, mediaType: string = "all") {
    try {
      // Try primary watch history endpoint
      const params: Record<string, any> = {
        "X-Plex-Container-Size": limit,
        sort: "date:desc",
      };
      
      if (userId) {
        params.accountID = userId;
      }
      
      const data = await this.makeRequest("/status/sessions/history/all", params);
      let sessions = data.MediaContainer?.Metadata || [];
      
      // Filter by media type if specified
      if (mediaType !== "all") {
        const typeMap: Record<string, string> = {
          movie: "movie",
          show: "show", 
          episode: "episode"
        };
        sessions = sessions.filter((session: any) => session.type === typeMap[mediaType]);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              watchHistory: sessions.map((session: any) => ({
                sessionKey: session.sessionKey,
                ratingKey: session.ratingKey,
                title: session.title,
                type: session.type,
                year: session.year,
                viewedAt: session.viewedAt,
                duration: session.duration,
                viewOffset: session.viewOffset,
                user: session.User?.title,
                player: session.Player?.title,
                platform: session.Player?.platform,
                progress: session.viewOffset && session.duration ? 
                  Math.round((session.viewOffset / session.duration) * 100) : 0,
                completed: session.viewOffset && session.duration ? 
                  session.viewOffset >= (session.duration * 0.9) : false,
              })),
              totalSessions: sessions.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      // Fallback: Create pseudo-history from library metadata
      try {
        const librariesData = await this.makeRequest("/library/sections");
        const libraries = librariesData.MediaContainer?.Directory || [];
        
        let allViewedItems: any[] = [];
        
        for (const library of libraries) {
          try {
            const params: Record<string, any> = {
              "X-Plex-Container-Size": Math.ceil(limit / libraries.length) + 5,
              sort: "lastViewedAt:desc",
            };
            
            if (mediaType !== "all") {
              params.type = this.getPlexTypeId(mediaType);
            }
            
            const contentData = await this.makeRequest(`/library/sections/${library.key}/all`, params);
            const content = contentData.MediaContainer?.Metadata || [];
            
            // Filter for items that have been viewed
            const viewedContent = content.filter((item: any) => 
              item.lastViewedAt && item.viewCount > 0
            );
            
            // Convert to history-like format
            const historyItems = viewedContent.map((item: any) => ({
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
          } catch (libError) {
            continue;
          }
        }
        
        // Sort by last viewed date and take requested number
        allViewedItems.sort((a: any, b: any) => (b.lastViewedAt || 0) - (a.lastViewedAt || 0));
        allViewedItems = allViewedItems.slice(0, limit);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                watchHistory: allViewedItems.map((item: any) => ({
                  ratingKey: item.ratingKey,
                  title: item.title,
                  type: item.type,
                  year: item.year,
                  lastViewedAt: item.lastViewedAt,
                  viewCount: item.viewCount,
                  duration: item.duration,
                  viewOffset: item.viewOffset,
                  library: item.library,
                  progress: item.viewOffset && item.duration ? 
                    Math.round((item.viewOffset / item.duration) * 100) : 0,
                  completed: item.viewOffset && item.duration ? 
                    item.viewOffset >= (item.duration * 0.85) : item.viewCount > 0,
                })),
                totalSessions: allViewedItems.length,
                note: "Generated from library metadata (fallback method)",
              }, null, 2),
            },
          ],
        };
      } catch (fallbackError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                error: "Watch history not available",
                message: "Unable to retrieve watch history from this Plex server",
                suggestion: "This feature may require Plex Pass or detailed logging to be enabled",
                watchHistory: [],
              }, null, 2),
            },
          ],
        };
      }
    }
  }

  private getPlexTypeId(type: string): number {
    const typeMap: Record<string, number> = {
      movie: 1,
      show: 2,
      episode: 4,
      artist: 8,
      album: 9,
      track: 10,
    };
    return typeMap[type] || 1;
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Plex MCP server running on stdio");
  }
}

// Main execution
async function main() {
  const server = new PlexMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});