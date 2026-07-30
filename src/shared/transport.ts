/**
 * Shared transport factory for MCP servers.
 * Supports stdio (default) and HTTP transports via --transport flag.
 *
 * Multi-session HTTP mode: each client connection gets its own
 * StreamableHTTPServerTransport backed by its own Server instance, keyed by
 * session ID. A single Server cannot back multiple transports — its
 * initialization state is per-connection — so sharing one across clients makes
 * the second client fail with "already initialized".
 */

import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

type TransportMode = "stdio" | "http";

/** Largest accepted JSON-RPC request body. Guards against memory exhaustion
 *  from an unauthenticated POST to /mcp. */
export const DEFAULT_MAX_BODY_BYTES = 4 * 1024 * 1024;

/** Close a session after this long with no traffic. */
export const DEFAULT_SESSION_IDLE_MS = 300_000;

/** Ceiling on concurrent sessions. Each session holds a Server instance, so
 *  this bounds memory against a client that never reuses its session ID. */
export const DEFAULT_MAX_SESSIONS = 64;

/** How often the idle sweeper runs. */
export const SESSION_SWEEP_INTERVAL_MS = 30_000;

export class BodyTooLargeError extends Error {
  constructor(limit: number) {
    super(`Request body exceeds ${limit} bytes`);
    this.name = "BodyTooLargeError";
  }
}

export class SessionLimitError extends Error {
  constructor(limit: number) {
    super(`Maximum of ${limit} concurrent sessions reached`);
    this.name = "SessionLimitError";
  }
}

/**
 * Read a request body, refusing anything over `maxBytes`.
 *
 * Length is tracked in bytes across chunks rather than trusting
 * Content-Length, which a client controls and may understate.
 */
export function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        // Pause rather than destroy: the caller still needs the socket open
        // long enough to write a 413 the client can actually read.
        req.pause();
        reject(new BodyTooLargeError(maxBytes));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** The subset of StreamableHTTPServerTransport the store depends on. */
interface SessionTransport {
  sessionId?: string;
  close(): Promise<void>;
  onclose?: (() => void) | undefined;
}

interface SessionEntry {
  transport: SessionTransport;
  lastActivity: number;
}

export interface SessionStoreOptions {
  maxSessions?: number;
  idleTimeoutMs?: number;
  /** Injectable clock — keeps idle-expiry behaviour testable. */
  now?: () => number;
}

/**
 * Tracks live HTTP sessions and expires idle ones.
 *
 * A single sweeper timer scans the map rather than one timer per session:
 * per-session timers leak whenever a session is dropped by a path that does
 * not own its timer.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly maxSessions: number;
  private readonly idleTimeoutMs: number;
  private readonly now: () => number;
  private sweeper?: ReturnType<typeof setInterval>;

  constructor(options: SessionStoreOptions = {}) {
    this.maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_SESSION_IDLE_MS;
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.sessions.size;
  }

  isFull(): boolean {
    return this.sessions.size >= this.maxSessions;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  /** Register a session. Throws SessionLimitError when at capacity. */
  add(transport: SessionTransport): void {
    const id = transport.sessionId;
    if (!id) throw new Error("Cannot register a transport with no session ID");
    if (!this.sessions.has(id) && this.isFull()) {
      throw new SessionLimitError(this.maxSessions);
    }
    this.sessions.set(id, { transport, lastActivity: this.now() });
  }

  /** Look up a session, recording the lookup as activity. */
  get(id: string): SessionTransport | undefined {
    const entry = this.sessions.get(id);
    if (!entry) return undefined;
    entry.lastActivity = this.now();
    return entry.transport;
  }

  close(id: string): void {
    const entry = this.sessions.get(id);
    if (!entry) return;

    this.sessions.delete(id);
    // Detach before closing: the transport's own close path fires onclose,
    // which would otherwise re-enter here.
    entry.transport.onclose = undefined;
    void entry.transport.close().catch(() => {});
  }

  /** Close every session idle beyond the timeout. Returns the closed IDs. */
  sweep(): string[] {
    const deadline = this.now() - this.idleTimeoutMs;
    const expired: string[] = [];

    for (const [id, entry] of this.sessions) {
      if (entry.lastActivity < deadline) expired.push(id);
    }
    for (const id of expired) this.close(id);

    return expired;
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id);
    this.stopSweeper();
  }

  startSweeper(intervalMs: number = SESSION_SWEEP_INTERVAL_MS): void {
    if (this.sweeper) return;
    this.sweeper = setInterval(() => {
      for (const id of this.sweep()) {
        console.error(`Session ${id} expired after ${this.idleTimeoutMs}ms idle`);
      }
    }, intervalMs);
    // Do not hold the event loop open on this timer.
    this.sweeper.unref?.();
  }

  stopSweeper(): void {
    if (!this.sweeper) return;
    clearInterval(this.sweeper);
    this.sweeper = undefined;
  }
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function sendRpcError(res: ServerResponse, status: number, code: number, message: string): void {
  sendJson(res, status, { jsonrpc: "2.0", error: { code, message }, id: null });
}

export interface McpHandlerOptions {
  /** Called once per new session to build a dedicated Server instance. */
  getServer: () => Server;
  serverName: string;
  store: SessionStore;
  maxBodyBytes?: number;
}

/**
 * Build the node:http request handler for HTTP transport mode.
 *
 * Exposed separately from startServer so it can be exercised against an
 * ephemeral port without going through argv parsing.
 */
export function createMcpRequestHandler(options: McpHandlerOptions) {
  const { getServer, serverName, store } = options;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/health" && req.method === "GET") {
      sendJson(res, 200, { status: "ok", server: serverName, sessions: store.size });
      return;
    }

    if (url.pathname !== "/mcp") {
      sendJson(res, 404, {
        error: "Not Found",
        message: "Use POST /mcp for MCP requests, or GET /health for health check",
      });
      return;
    }

    const rawSessionId = req.headers["mcp-session-id"];
    const sessionId = typeof rawSessionId === "string" ? rawSessionId : undefined;

    // GET (SSE stream) and DELETE (session teardown) carry no body and always
    // belong to an existing session.
    if (req.method !== "POST") {
      if (!sessionId) {
        sendRpcError(res, 400, -32000, "Missing mcp-session-id header");
        return;
      }
      const transport = store.get(sessionId);
      if (!transport) {
        sendRpcError(res, 404, -32001, "Session not found or expired");
        return;
      }
      await (transport as StreamableHTTPServerTransport).handleRequest(req, res);
      return;
    }

    let rawBody: string;
    try {
      rawBody = await readBody(req, maxBodyBytes);
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        // Close the connection once the 413 is flushed — we are deliberately
        // not draining the rest of an oversized upload.
        res.setHeader("Connection", "close");
        res.once("finish", () => req.destroy());
        sendRpcError(res, 413, -32600, error.message);
        return;
      }
      sendRpcError(res, 400, -32600, "Failed to read request body");
      return;
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      sendRpcError(res, 400, -32700, "Parse error");
      return;
    }

    // ── Existing session ──────────────────────────────────────────────────
    if (sessionId) {
      const transport = store.get(sessionId);
      if (!transport) {
        sendRpcError(res, 404, -32001, "Session not found or expired");
        return;
      }
      await (transport as StreamableHTTPServerTransport).handleRequest(req, res, body);
      return;
    }

    // ── New session ───────────────────────────────────────────────────────
    if (store.isFull()) {
      sendRpcError(res, 503, -32000, "Server at session capacity, try again later");
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
    });

    transport.onclose = () => {
      if (transport.sessionId) store.close(transport.sessionId);
    };

    // A dedicated Server per session — the whole point of the session map.
    await getServer().connect(transport);
    await transport.handleRequest(req, res, body);

    // sessionId is only assigned once the initialize request has been handled.
    if (transport.sessionId) {
      try {
        store.add(transport);
        console.error(`Session ${transport.sessionId} initialized (total: ${store.size})`);
      } catch (error) {
        if (error instanceof SessionLimitError) {
          transport.onclose = undefined;
          void transport.close().catch(() => {});
          return;
        }
        throw error;
      }
    }
  };
}

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

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Start the server on the transport selected by argv.
 *
 * Takes a factory rather than an instance: HTTP mode needs a fresh Server per
 * session, and only the caller knows how to build one.
 */
export async function startServer(
  getServer: () => Server,
  serverName: string
): Promise<void> {
  const { transport, port } = parseArgs();

  if (transport === "stdio") {
    // One process, one client, one session — no session tracking needed.
    await getServer().connect(new StdioServerTransport());
    console.error(`${serverName} running on stdio`);
    return;
  }

  const store = new SessionStore({
    maxSessions: positiveIntFromEnv("MCP_MAX_SESSIONS", DEFAULT_MAX_SESSIONS),
    idleTimeoutMs:
      positiveIntFromEnv("SESSION_TIMEOUT_SECONDS", DEFAULT_SESSION_IDLE_MS / 1000) * 1000,
  });
  store.startSweeper();

  const httpServer = createServer(createMcpRequestHandler({ getServer, serverName, store }));

  const shutdown = () => {
    store.closeAll();
    httpServer.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  httpServer.listen(port, () => {
    console.error(`${serverName} running on http://localhost:${port}/mcp`);
  });
}
