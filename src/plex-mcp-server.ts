#!/usr/bin/env node

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
  DEFAULT_PLEX_URL,
} from "./plex/index.js";
import { startServer } from "./shared/transport.js";
import { SERVER_VERSION } from "./shared/version.js";
import { listedToolSchemas } from "./shared/tool-list.js";

// Trakt integration
import { TraktMCPFunctions } from "./trakt/mcp-functions.js";
import { createTraktToolRegistry } from "./trakt/tool-registry.js";

// Arr integration (Sonarr/Radarr)
import { ArrMCPFunctions } from "./arr/mcp-functions.js";
import { createArrToolRegistry } from "./arr/tool-registry.js";

class UnifiedMCPServer {
  /**
   * Build a fully wired Server instance.
   *
   * A factory rather than a constructor because HTTP transport needs one
   * Server per session — a single instance cannot back concurrent clients.
   */
  static createServer(): Server {
    const server = new Server(
      { name: "plex-mcp-server", version: SERVER_VERSION },
      { capabilities: { tools: {} } }
    );

    const plexToken = process.env.PLEX_TOKEN;
    if (!plexToken) {
      throw new Error("PLEX_TOKEN environment variable is required");
    }

    const plexClient = new PlexClient({
      baseUrl: process.env.PLEX_URL || DEFAULT_PLEX_URL,
      token: plexToken,
    });

    const plexTools = new PlexTools(plexClient);
    const traktFunctions = new TraktMCPFunctions(plexClient);
    const plexRegistry = createPlexToolRegistry(plexTools, {
      traktFunctions,
    });
    const traktRegistry = createTraktToolRegistry(traktFunctions);
    const arrFunctions = new ArrMCPFunctions();
    const arrRegistry = createArrToolRegistry(arrFunctions);

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listedToolSchemas(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const a = (args ?? {}) as Record<string, unknown>;

      try {
        if (plexRegistry.has(name)) return await plexRegistry.handle(name, a);
        if (traktRegistry.has(name)) return await traktRegistry.handle(name, a);
        return await arrRegistry.handle(name, a);
      } catch (error) {
        if (error instanceof McpError) throw error;
        const msg = error instanceof Error ? error.message : String(error);
        throw new McpError(ErrorCode.InternalError, `Error executing ${name}: ${msg}`);
      }
    });

    return server;
  }
}

export async function main() {
  await startServer(() => UnifiedMCPServer.createServer(), "Plex MCP server (unified)");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
