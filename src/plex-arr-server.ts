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
  DEFAULT_PLEX_URL,
} from "./plex/index.js";

// Arr integration
import { ArrMCPFunctions } from "./arr/mcp-functions.js";
import { ARR_TOOL_SCHEMAS } from "./arr/tool-schemas.js";
import { createArrToolRegistry } from "./arr/tool-registry.js";

class PlexArrMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "plex-arr-server", version: "1.0.0" },
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
    const plexRegistry = createPlexToolRegistry(plexTools);
    const arrFunctions = new ArrMCPFunctions();
    const arrRegistry = createArrToolRegistry(arrFunctions);

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...PLEX_CORE_TOOL_SCHEMAS, ...ARR_TOOL_SCHEMAS],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const a = (args ?? {}) as Record<string, unknown>;

      try {
        if (plexRegistry.has(name)) {
          return await plexRegistry.handle(name, a);
        }
        return await arrRegistry.handle(name, a);
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
    console.error("Plex-Arr MCP server running on stdio");
  }
}

async function main() {
  const server = new PlexArrMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
