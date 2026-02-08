#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// Plex shared module
import {
  PlexClient,
  PlexTools,
  createPlexToolRegistry,
  PLEX_CORE_TOOL_SCHEMAS,
} from "./plex/index.js";

// Trakt integration
import { TraktMCPFunctions } from "./trakt/mcp-functions.js";

// Trakt tool schemas
const TRAKT_TOOL_SCHEMAS = [
  {
    name: "trakt_authenticate",
    description: "Start Trakt.tv OAuth authentication process",
    inputSchema: {
      type: "object" as const,
      properties: {
        state: { type: "string", description: "Optional state parameter for OAuth flow" },
      },
    },
  },
  {
    name: "trakt_complete_auth",
    description: "Complete Trakt.tv authentication with authorization code",
    inputSchema: {
      type: "object" as const,
      properties: {
        code: { type: "string", description: "Authorization code from Trakt OAuth callback" },
      },
      required: ["code"],
    },
  },
  {
    name: "trakt_get_auth_status",
    description: "Check Trakt.tv authentication status",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_sync_to_trakt",
    description: "Sync Plex watch history to Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        dryRun: { type: "boolean", description: "Preview sync without making changes", default: false },
        batchSize: { type: "number", description: "Number of items to sync per batch", default: 50 },
        includeProgress: { type: "boolean", description: "Include watch progress information", default: false },
      },
    },
  },
  {
    name: "trakt_sync_from_trakt",
    description: "Get watch history from Trakt.tv for comparison",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_get_user_stats",
    description: "Get enhanced viewing statistics from Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: { type: "number", description: "Optional Plex user ID for correlation" },
      },
    },
  },
  {
    name: "trakt_start_scrobbling",
    description: "Enable real-time scrobbling to Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        ratingKey: { type: "string", description: "Plex media rating key" },
        title: { type: "string", description: "Media title" },
        type: { type: "string", enum: ["movie", "episode"], description: "Media type" },
        progress: { type: "number", description: "Current progress percentage (0-100)" },
        duration: { type: "number", description: "Total duration in milliseconds" },
      },
      required: ["ratingKey", "title", "type", "progress"],
    },
  },
  {
    name: "trakt_get_sync_status",
    description: "Check status of ongoing sync operations",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "trakt_search",
    description: "Search for movies and shows on Trakt.tv",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        type: { type: "string", enum: ["movie", "show"], description: "Optional media type filter" },
        year: { type: "number", description: "Optional year filter" },
      },
      required: ["query"],
    },
  },
];

class PlexTraktMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "plex-trakt-server", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );

    const plexClient = new PlexClient({
      baseUrl: process.env.PLEX_URL || "http://localhost:32400",
      token: process.env.PLEX_TOKEN || "",
    });

    const plexTools = new PlexTools(plexClient);
    const plexRegistry = createPlexToolRegistry(plexTools);
    const traktFunctions = new TraktMCPFunctions(plexClient);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...PLEX_CORE_TOOL_SCHEMAS, ...TRAKT_TOOL_SCHEMAS],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const a = (args ?? {}) as Record<string, unknown>;

      try {
        // Route Plex tools through registry
        if (plexRegistry.has(name)) {
          return await plexRegistry.handle(name, a);
        }

        // Route Trakt tools
        switch (name) {
          case "trakt_authenticate":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktAuthenticate(a.state as string | undefined)) }] };
          case "trakt_complete_auth":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktCompleteAuth(a.code as string)) }] };
          case "trakt_get_auth_status":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktGetAuthStatus()) }] };
          case "trakt_sync_to_trakt":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktSyncToTrakt({
              dryRun: a.dryRun as boolean | undefined,
              batchSize: a.batchSize as number | undefined,
              includeProgress: a.includeProgress as boolean | undefined,
            })) }] };
          case "trakt_sync_from_trakt":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktSyncFromTrakt()) }] };
          case "trakt_get_user_stats":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktGetUserStats(a.userId as number | undefined)) }] };
          case "trakt_start_scrobbling":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktStartScrobbling({
              ratingKey: a.ratingKey as string,
              title: a.title as string,
              type: a.type as "movie" | "episode",
              progress: a.progress as number,
              duration: a.duration as number | undefined,
            })) }] };
          case "trakt_get_sync_status":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktGetSyncStatus()) }] };
          case "trakt_search":
            return { content: [{ type: "text", text: JSON.stringify(await traktFunctions.traktSearch(
              a.query as string,
              a.type as "movie" | "show" | undefined,
              a.year as number | undefined,
            )) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${msg}`);
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Plex-Trakt MCP server running on stdio");
  }
}

async function main() {
  const server = new PlexTraktMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
