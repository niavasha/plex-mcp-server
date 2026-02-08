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

// Trakt integration
import { TraktMCPFunctions } from './trakt/mcp-functions.js';
import { PlexAPIClient } from './trakt/sync.js';
import { PlexMovie, PlexEpisode, PlexWatchSession } from './trakt/mapper.js';

// Plex API configuration
interface PlexConfig {
  baseUrl: string;
  token: string;
}

class PlexTraktMCPServer implements PlexAPIClient {
  private server: Server;
  private plexConfig: PlexConfig;
  private traktFunctions: TraktMCPFunctions;

  constructor() {
    this.server = new Server(
      {
        name: "plex-trakt-server",
        version: "1.0.0",
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

    // Initialize Trakt integration
    this.traktFunctions = new TraktMCPFunctions(this);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Existing Plex tools
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

          // NEW: Trakt.tv integration tools
          {
            name: "trakt_authenticate",
            description: "Start Trakt.tv OAuth authentication process",
            inputSchema: {
              type: "object",
              properties: {
                state: {
                  type: "string",
                  description: "Optional state parameter for OAuth flow",
                },
              },
            },
          },
          {
            name: "trakt_complete_auth",
            description: "Complete Trakt.tv authentication with authorization code",
            inputSchema: {
              type: "object",
              properties: {
                code: {
                  type: "string",
                  description: "Authorization code from Trakt OAuth callback",
                },
              },
              required: ["code"],
            },
          },
          {
            name: "trakt_get_auth_status",
            description: "Check Trakt.tv authentication status",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "trakt_sync_to_trakt",
            description: "Sync Plex watch history to Trakt.tv",
            inputSchema: {
              type: "object",
              properties: {
                dryRun: {
                  type: "boolean",
                  description: "Preview sync without making changes",
                  default: false,
                },
                batchSize: {
                  type: "number",
                  description: "Number of items to sync per batch",
                  default: 50,
                },
                includeProgress: {
                  type: "boolean",
                  description: "Include watch progress information",
                  default: false,
                },
              },
            },
          },
          {
            name: "trakt_sync_from_trakt",
            description: "Get watch history from Trakt.tv for comparison",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "trakt_get_user_stats",
            description: "Get enhanced viewing statistics from Trakt.tv",
            inputSchema: {
              type: "object",
              properties: {
                userId: {
                  type: "number",
                  description: "Optional Plex user ID for correlation",
                },
              },
            },
          },
          {
            name: "trakt_start_scrobbling",
            description: "Enable real-time scrobbling to Trakt.tv",
            inputSchema: {
              type: "object",
              properties: {
                ratingKey: {
                  type: "string",
                  description: "Plex media rating key",
                },
                title: {
                  type: "string",
                  description: "Media title",
                },
                type: {
                  type: "string",
                  enum: ["movie", "episode"],
                  description: "Media type",
                },
                progress: {
                  type: "number",
                  description: "Current progress percentage (0-100)",
                },
                duration: {
                  type: "number",
                  description: "Total duration in milliseconds",
                },
              },
              required: ["ratingKey", "title", "type", "progress"],
            },
          },
          {
            name: "trakt_get_sync_status",
            description: "Check status of ongoing sync operations",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
          {
            name: "trakt_search",
            description: "Search for movies and shows on Trakt.tv",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query",
                },
                type: {
                  type: "string",
                  enum: ["movie", "show"],
                  description: "Optional media type filter",
                },
                year: {
                  type: "number",
                  description: "Optional year filter",
                },
              },
              required: ["query"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Existing Plex functions
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
          case "get_watch_history":
            return await this.getWatchHistory(
              ((args as any)?.limit as number) || 50,
              (args as any)?.userId as string,
              (args as any)?.mediaType as string || "all"
            );

          // NEW: Trakt functions
          case "trakt_authenticate":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktAuthenticate((args as any)?.state))
              }]
            };
          case "trakt_complete_auth":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktCompleteAuth((args as any)?.code))
              }]
            };
          case "trakt_get_auth_status":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktGetAuthStatus())
              }]
            };
          case "trakt_sync_to_trakt":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktSyncToTrakt({
                  dryRun: (args as any)?.dryRun,
                  batchSize: (args as any)?.batchSize,
                  includeProgress: (args as any)?.includeProgress
                }))
              }]
            };
          case "trakt_sync_from_trakt":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktSyncFromTrakt())
              }]
            };
          case "trakt_get_user_stats":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktGetUserStats((args as any)?.userId))
              }]
            };
          case "trakt_start_scrobbling":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktStartScrobbling({
                  ratingKey: (args as any)?.ratingKey,
                  title: (args as any)?.title,
                  type: (args as any)?.type,
                  progress: (args as any)?.progress,
                  duration: (args as any)?.duration
                }))
              }]
            };
          case "trakt_get_sync_status":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktGetSyncStatus())
              }]
            };
          case "trakt_search":
            return {
              content: [{
                type: "text",
                text: JSON.stringify(await this.traktFunctions.traktSearch(
                  (args as any)?.query,
                  (args as any)?.type,
                  (args as any)?.year
                ))
              }]
            };

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

  // PlexAPIClient implementation (required for Trakt sync)
  async getWatchedMovies(userId?: number): Promise<PlexMovie[]> {
    try {
      const data = await this.makeRequest("/library/all", {
        type: 1, // Movies
        "X-Plex-Container-Size": 1000
      });
      
      const movies = data.MediaContainer?.Metadata || [];
      return movies
        .filter((item: any) => item.viewCount && item.viewCount > 0)
        .map((item: any) => ({
          ratingKey: item.ratingKey,
          title: item.title,
          year: item.year,
          guid: item.guid,
          duration: item.duration,
          viewCount: item.viewCount,
          lastViewedAt: item.lastViewedAt,
          addedAt: item.addedAt,
          updatedAt: item.updatedAt,
          genres: item.Genre?.map((g: any) => g.tag) || [],
          summary: item.summary
        }));
    } catch (error) {
      console.error('Failed to get watched movies:', error);
      return [];
    }
  }

  async getWatchedEpisodes(userId?: number): Promise<PlexEpisode[]> {
    try {
      // This is a simplified implementation - would need to iterate through show libraries
      const episodes: PlexEpisode[] = [];
      
      // Get TV libraries
      const librariesData = await this.makeRequest("/library/sections");
      const libraries = librariesData.MediaContainer?.Directory || [];
      const showLibraries = libraries.filter((lib: any) => lib.type === 'show');

      for (const library of showLibraries) {
        const data = await this.makeRequest(`/library/sections/${library.key}/all`, {
          type: 4, // Episodes
          "X-Plex-Container-Size": 1000
        });

        const libraryEpisodes = data.MediaContainer?.Metadata || [];
        episodes.push(...libraryEpisodes
          .filter((item: any) => item.viewCount && item.viewCount > 0)
          .map((item: any) => ({
            ratingKey: item.ratingKey,
            title: item.title,
            seasonNumber: item.parentIndex || 1,
            episodeNumber: item.index || 1,
            duration: item.duration,
            viewCount: item.viewCount,
            lastViewedAt: item.lastViewedAt,
            guid: item.guid,
            show: {
              ratingKey: item.grandparentRatingKey,
              title: item.grandparentTitle,
              year: item.grandparentYear,
              guid: item.grandparentGuid
            }
          }))
        );
      }

      return episodes;
    } catch (error) {
      console.error('Failed to get watched episodes:', error);
      return [];
    }
  }

  async getCurrentSessions(): Promise<PlexWatchSession[]> {
    try {
      const data = await this.makeRequest("/status/sessions");
      const sessions = data.MediaContainer?.Metadata || [];
      
      return sessions.map((session: any) => ({
        ratingKey: session.ratingKey,
        title: session.title,
        type: session.type === 'movie' ? 'movie' : 'episode',
        viewOffset: session.viewOffset,
        duration: session.duration,
        progress: session.viewOffset && session.duration ? 
          Math.round((session.viewOffset / session.duration) * 100) : 0,
        sessionKey: session.sessionKey,
        userId: session.User?.id,
        userName: session.User?.title,
        state: 'playing', // Plex sessions API shows active sessions
        seasonNumber: session.parentIndex,
        episodeNumber: session.index
      }));
    } catch (error) {
      console.error('Failed to get current sessions:', error);
      return [];
    }
  }

  async markAsWatched(ratingKey: string, userId?: number): Promise<void> {
    try {
      await this.makeRequest(`/:/scrobble?key=${ratingKey}&identifier=com.plexapp.plugins.library`, {}, 'GET');
    } catch (error) {
      console.error(`Failed to mark ${ratingKey} as watched:`, error);
      throw error;
    }
  }

  async updateProgress(ratingKey: string, progress: number, userId?: number): Promise<void> {
    try {
      await this.makeRequest(`/:/progress?key=${ratingKey}&time=${progress}&identifier=com.plexapp.plugins.library`, {}, 'GET');
    } catch (error) {
      console.error(`Failed to update progress for ${ratingKey}:`, error);
      throw error;
    }
  }

  // Existing Plex MCP methods (simplified versions)
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
    // Simplified implementation
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
          
          const viewedContent = content.filter((item: any) => 
            item.lastViewedAt && item.viewCount > 0
          );
          
          allRecentItems.push(...viewedContent);
        } catch (libError) {
          continue;
        }
      }
      
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
              recentlyWatched: [],
              totalCount: 0,
              error: "Recently watched data not available",
            }, null, 2),
          },
        ],
      };
    }
  }

  private async getWatchHistory(limit: number, userId?: string, mediaType: string = "all") {
    // Simplified implementation using library metadata
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
          
          const viewedContent = content.filter((item: any) => 
            item.lastViewedAt && item.viewCount > 0
          );
          
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
              error: "Watch history not available",
              watchHistory: [],
            }, null, 2),
          },
        ],
      };
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
    console.error("Plex-Trakt MCP server running on stdio");
  }
}

// Main execution
async function main() {
  const server = new PlexTraktMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});