#!/usr/bin/env node

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  PlexClient,
  PlexTools,
  createPlexToolRegistry,
  PLEX_TOOL_SCHEMAS,
  PLEX_MUTATIVE_TOOL_SCHEMAS,
  DEFAULT_PLEX_URL,
  isMutativeOpsEnabled,
} from "./plex/index.js";

class PlexMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "plex-server", version: "0.1.0" },
      { capabilities: { tools: {} } }
    );

    const plexToken = process.env.PLEX_TOKEN;
    if (!plexToken) {
      throw new Error("PLEX_TOKEN environment variable is required");
    }

    const client = new PlexClient({
      baseUrl: process.env.PLEX_URL || DEFAULT_PLEX_URL,
      token: plexToken,
    });

    const mutativeEnabled = isMutativeOpsEnabled();
    const tools = new PlexTools(client);
    const registry = createPlexToolRegistry(tools, { includeMutative: mutativeEnabled });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: mutativeEnabled
        ? [...PLEX_TOOL_SCHEMAS, ...PLEX_MUTATIVE_TOOL_SCHEMAS]
        : PLEX_TOOL_SCHEMAS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await registry.handle(name, (args ?? {}) as Record<string, unknown>);
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
    console.error("Plex MCP server running on stdio");
  }
}

async function main() {
  const server = new PlexMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
