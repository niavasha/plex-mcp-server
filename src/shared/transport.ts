/**
 * Shared transport factory for MCP servers.
 * Supports stdio (default) and HTTP transports via --transport flag.
 *
 * Multi-session HTTP mode: each client connection gets its own
 * StreamableHTTPServerTransport instance + a dedicated McpServer instance,
 * keyed by session ID. This allows concurrent multi-agent requests without
 * "already initialized" errors.
 */

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
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

// ── Per-session state ─────────────────────────────────────────────────────────
// One transport + one McpServer instance per session, so each agent gets
// its own initialized state and concurrent requests don't block each other.
interface SessionState {
  transport: StreamableHTTPServerTransport;
  inactivityTimer: ReturnType<typeof setInterval>;
}
const sessions = new Map<string, SessionState>();

// Session inactivity timeout — close a session after this many seconds of idle.
// The inactivity timer resets on every request that uses the session.
const SESSION_TIMEOUT_SECONDS = parseInt(
  process.env.SESSION_TIMEOUT_SECONDS || "300", 10
);

function closeSession(sessionId: string): void {
  const state = sessions.get(sessionId);
  if (!state) return;

  clearInterval(state.inactivityTimer);
  sessions.delete(sessionId);

  // Remove onclose handler BEFORE closing to prevent recursion.
  state.transport.onclose = undefined;
  state.transport.close().catch(() => {});

  console.error(`Session ${sessionId} closed (total: ${sessions.size})`);
}

// Factory function — subclasses/replace this to create a custom McpServer
// with different tools registered. By default, the caller passes `getServer`
// into startServer so we can call it fresh for each new session.
export async function startServer(
  getServer: () => { connect(t: any): Promise<void> },
  serverName: string,
  _options?: { transport?: TransportMode; port?: number }
): Promise<void> {
  const { transport, port } = parseArgs();

  if (transport === "stdio") {
    // stdio: single shared server, single session — no session management needed.
    const stdioTransport = new StdioServerTransport();
    const server = getServer();
    await server.connect(stdioTransport);
    console.error(`${serverName} running on stdio`);
    return;
  }

  // ── Multi-session HTTP ──────────────────────────────────────────────────────
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: serverName }));
      return;
    }

    if (url.pathname !== "/mcp") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: "Not Found",
        message: "Use POST /mcp for MCP requests, or GET /health for health check",
      }));
      return;
    }

    // Read and parse the request body once.
    const rawBody = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk: any) => { data += chunk; });
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }

    // mcp-session-id: undefined when absent, string when present.
    const rawSessionId = req.headers["mcp-session-id"];
    const sessionId = typeof rawSessionId === "string" ? rawSessionId : undefined;

    if (!sessionId) {
      // ── New session: create transport + server, store in map ─────────────
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
      });

      let lastActivity = Date.now();

      const inactivityTimer = setInterval(() => {
        const idle = (Date.now() - lastActivity) / 1000;
        if (idle > SESSION_TIMEOUT_SECONDS) {
          console.error(
            `Session idle for ${Math.round(idle)}s (>${SESSION_TIMEOUT_SECONDS}s), closing`
          );
          closeSession(transport.sessionId!);
        }
      }, 30_000);

      // Set up onclose to clean up the session map.
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) closeSession(sid);
      };

      // IMPORTANT: Create a fresh McpServer instance for this session.
      // The SDK example creates one server per session — do NOT share a single
      // server instance across transports; the internal state is not designed
      // for concurrent connections to the same server object.
      const server = getServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, body);

      // Register the session AFTER handleRequest (when sessionId is set).
      // Note: onsessioninitialized may not fire in JSON response mode, so we
      // do it here explicitly. Subsequent requests from this client (which
      // include the session ID from the response header) will find it.
      if (transport.sessionId && !sessions.has(transport.sessionId)) {
        sessions.set(transport.sessionId, { transport, inactivityTimer });
        console.error(`Session ${transport.sessionId} initialized (total: ${sessions.size})`);
      }

      // Reset activity timer after handling.
      lastActivity = Date.now();
      return;
    }

    // ── Existing session: reuse its transport ────────────────────────────────
    const state = sessions.get(sessionId);
    if (!state) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found or expired" },
        id: null,
      }));
      return;
    }

    // Reset inactivity timer on each request.
    // We store lastActivity on the transport object as a lightweight timer.
    (state.transport as any)._lastActivity = Date.now();
    await state.transport.handleRequest(req, res, body);
  });

  httpServer.listen(port, () => {
    console.error(`${serverName} running on http://localhost:${port}/mcp`);
  });
}