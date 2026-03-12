/**
 * Shared transport factory for MCP servers.
 * Supports stdio (default) and HTTP transports via --transport flag.
 */

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

type TransportMode = "stdio" | "http";

function parseArgs(): { transport: TransportMode; port: number } {
  const args = process.argv.slice(2);
  let transport: TransportMode = "stdio";
  let port = 3000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--transport" && args[i + 1]) {
      const value = args[i + 1];
      if (value !== "stdio" && value !== "http") {
        throw new Error(`Invalid transport: ${value}. Must be "stdio" or "http".`);
      }
      transport = value;
      i++;
    }
    if (args[i] === "--port" && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port: ${args[i + 1]}`);
      }
      i++;
    }
  }

  if (process.env.MCP_PORT) {
    const envPort = parseInt(process.env.MCP_PORT, 10);
    if (Number.isFinite(envPort) && envPort >= 1 && envPort <= 65535) {
      port = envPort;
    }
  }

  return { transport, port };
}

export async function startServer(server: Server, serverName: string): Promise<void> {
  const { transport, port } = parseArgs();

  if (transport === "stdio") {
    const stdioTransport = new StdioServerTransport();
    await server.connect(stdioTransport);
    console.error(`${serverName} running on stdio`);
    return;
  }

  // Stateful HTTP transport — session ID tracks each client connection.
  // enableJsonResponse allows clients that don't support SSE to get JSON responses.
  const httpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });

  await server.connect(httpTransport);

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: serverName }));
      return;
    }

    if (url.pathname === "/mcp") {
      await httpTransport.handleRequest(req, res);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Not Found",
      message: "Use POST /mcp for MCP requests, or GET /health for health check",
    }));
  });

  httpServer.listen(port, () => {
    console.error(`${serverName} running on http://localhost:${port}/mcp`);
  });
}
