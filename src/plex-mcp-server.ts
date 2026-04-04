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
  PLEX_TOOL_SCHEMAS,
  PLEX_MUTATIVE_TOOL_SCHEMAS,
  DEFAULT_PLEX_URL,
  isMutativeOpsEnabled,
} from "./plex/index.js";
import { startServer } from "./shared/transport.js";

// Trakt integration
import { TraktMCPFunctions } from "./trakt/mcp-functions.js";
import { TRAKT_TOOL_SCHEMAS } from "./trakt/tool-schemas.js";
import { createTraktToolRegistry } from "./trakt/tool-registry.js";

// Arr integration (Sonarr/Radarr)
import { ArrMCPFunctions } from "./arr/mcp-functions.js";
import { ARR_TOOL_SCHEMAS } from "./arr/tool-schemas.js";
import { createArrToolRegistry } from "./arr/tool-registry.js";

class UnifiedMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "plex-mcp-server", version: "1.1.0" },
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

    const mutativeEnabled = isMutativeOpsEnabled();
    const plexTools = new PlexTools(plexClient);
    const traktFunctions = new TraktMCPFunctions(plexClient);
    const plexRegistry = createPlexToolRegistry(plexTools, {
      includeMutative: mutativeEnabled,
      traktFunctions,
    });
    const traktRegistry = createTraktToolRegistry(traktFunctions);
    const arrFunctions = new ArrMCPFunctions();
    const arrRegistry = createArrToolRegistry(arrFunctions);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...PLEX_TOOL_SCHEMAS,
        ...(mutativeEnabled ? PLEX_MUTATIVE_TOOL_SCHEMAS : []),
        ...TRAKT_TOOL_SCHEMAS,
        ...ARR_TOOL_SCHEMAS,
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
  }

  async run() {
    await startServer(this.server, "Plex MCP server (unified)");
  }
}

export async function main() {
  const server = new UnifiedMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
