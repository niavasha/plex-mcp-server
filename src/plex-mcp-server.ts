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
  dispatchToolCall,
} from "./plex/index.js";
import { ExportStore, registerExportResources, startExportSweeper } from "./plex/export-store.js";
import { startServer, type TransportMode } from "./shared/transport.js";
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
  static createServer(transport: TransportMode = "stdio"): Server {
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

    // HTTP clients cannot read the server's files, so exports are served as MCP resources.
    const exportStore = transport === "http" ? new ExportStore() : undefined;
    if (exportStore) registerExportResources(server, exportStore);

    const plexTools = new PlexTools(plexClient, { exportStore });
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
        return await dispatchToolCall([plexRegistry, traktRegistry, arrRegistry], name, a);
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
  const transport = await startServer(
    (transport) => UnifiedMCPServer.createServer(transport),
    "Plex MCP server (unified)"
  );
  // Only HTTP keeps exports in the temp directory. The first sweep also clears
  // what a server that was killed left there.
  if (transport === "http") startExportSweeper();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
