import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage } from "node:http";

import {
  SessionStore,
  SessionLimitError,
  BodyTooLargeError,
  readBody,
  createMcpRequestHandler,
  normalizeMcpPath,
  DEFAULT_MAX_BODY_BYTES,
} from "../shared/transport.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Minimal stand-in for a StreamableHTTPServerTransport. */
function fakeTransport(sessionId: string) {
  return {
    sessionId,
    close: vi.fn().mockResolvedValue(undefined),
    onclose: undefined as (() => void) | undefined,
  };
}

/** Turn a string into something shaped like an IncomingMessage. */
function fakeRequest(body: string): IncomingMessage {
  return Readable.from([Buffer.from(body)]) as unknown as IncomingMessage;
}

// ── readBody ─────────────────────────────────────────────────────────────────

describe("readBody", () => {
  it("reads a complete body", async () => {
    const body = JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 1 });
    await expect(readBody(fakeRequest(body), 1024)).resolves.toBe(body);
  });

  it("reads an empty body as an empty string", async () => {
    await expect(readBody(fakeRequest(""), 1024)).resolves.toBe("");
  });

  // Regression: the body was previously accumulated with no upper bound, so an
  // unauthenticated POST to /mcp could exhaust process memory.
  it("rejects a body larger than the limit", async () => {
    const huge = "x".repeat(5000);
    await expect(readBody(fakeRequest(huge), 1024)).rejects.toBeInstanceOf(
      BodyTooLargeError
    );
  });

  it("enforces the limit across chunks, not just per chunk", async () => {
    const req = Readable.from([
      Buffer.from("x".repeat(600)),
      Buffer.from("x".repeat(600)),
    ]) as unknown as IncomingMessage;

    await expect(readBody(req, 1024)).rejects.toBeInstanceOf(BodyTooLargeError);
  });

  it("accepts a body exactly at the limit", async () => {
    const exact = "x".repeat(1024);
    await expect(readBody(fakeRequest(exact), 1024)).resolves.toHaveLength(1024);
  });
});

// ── SessionStore ─────────────────────────────────────────────────────────────

describe("SessionStore", () => {
  let clock: number;
  const now = () => clock;

  beforeEach(() => {
    clock = 1_000_000;
  });

  function makeStore(overrides: Partial<{ maxSessions: number; idleTimeoutMs: number }> = {}) {
    return new SessionStore({
      maxSessions: overrides.maxSessions ?? 4,
      idleTimeoutMs: overrides.idleTimeoutMs ?? 300_000,
      now,
    });
  }

  it("stores and retrieves a session by id", () => {
    const store = makeStore();
    const t = fakeTransport("abc");
    store.add(t as never);

    expect(store.size).toBe(1);
    expect(store.get("abc")).toBe(t);
  });

  it("returns undefined for an unknown session id", () => {
    expect(makeStore().get("nope")).toBeUndefined();
  });

  // Regression: every POST without a session header created a transport, a
  // server and a timer, with no ceiling.
  it("refuses to exceed maxSessions", () => {
    const store = makeStore({ maxSessions: 2 });
    store.add(fakeTransport("a") as never);
    store.add(fakeTransport("b") as never);

    expect(() => store.add(fakeTransport("c") as never)).toThrow(SessionLimitError);
    expect(store.size).toBe(2);
  });

  it("frees capacity when a session is closed", () => {
    const store = makeStore({ maxSessions: 1 });
    store.add(fakeTransport("a") as never);
    store.close("a");

    expect(store.size).toBe(0);
    expect(() => store.add(fakeTransport("b") as never)).not.toThrow();
  });

  it("sweeps sessions idle beyond the timeout", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    const t = fakeTransport("stale");
    store.add(t as never);

    clock += 300_001;
    const closed = store.sweep();

    expect(closed).toEqual(["stale"]);
    expect(store.size).toBe(0);
    expect(t.close).toHaveBeenCalled();
  });

  it("does not sweep a session that is still within the timeout", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("fresh") as never);

    clock += 299_000;

    expect(store.sweep()).toEqual([]);
    expect(store.size).toBe(1);
  });

  // THE core regression from PR #89: activity was written to a dead field, so
  // the idle deadline never moved and every session died 300s after creation
  // no matter how busy it was.
  it("keeps an actively used session alive indefinitely", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("busy") as never);

    // Simulate 20 minutes of traffic, one request every 4 minutes.
    for (let i = 0; i < 5; i++) {
      clock += 240_000;
      expect(store.get("busy")).toBeDefined();
      expect(store.sweep()).toEqual([]);
    }

    expect(store.size).toBe(1);
  });

  it("treats get() as activity", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("x") as never);

    clock += 299_000;
    store.get("x"); // touch
    clock += 299_000;

    expect(store.sweep()).toEqual([]);
  });

  it("expires a session that goes quiet after being busy", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("x") as never);

    clock += 100_000;
    store.get("x");
    clock += 300_001;

    expect(store.sweep()).toEqual(["x"]);
  });

  // #246 item 7: a request longer than the idle timeout lost its session midway.
  it("does not expire a session while one of its requests runs", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("x") as never);
    const res = new EventEmitter();

    store.trackRequest("x", res as never);
    clock += 3_000_000;
    expect(store.sweep()).toEqual([]);

    res.emit("close");
    clock += 300_000;
    expect(store.sweep()).toEqual([]);
    clock += 1;
    expect(store.sweep()).toEqual(["x"]);
  });

  it("ignores a request for an unknown session", () => {
    const store = makeStore();
    expect(() => store.trackRequest("missing", new EventEmitter() as never)).not.toThrow();
  });

  it("sweeps only the stale sessions, leaving fresh ones", () => {
    const store = makeStore({ idleTimeoutMs: 300_000 });
    store.add(fakeTransport("old") as never);
    clock += 200_000;
    store.add(fakeTransport("new") as never);
    clock += 150_000; // old: 350s idle, new: 150s idle

    expect(store.sweep()).toEqual(["old"]);
    expect(store.has("new")).toBe(true);
  });

  // The transport's onclose is the only route to the Server's own onclose, where
  // per-session cleanup hangs. It used to be detached here, so a session closed by
  // the sweeper or at shutdown never ran that cleanup.
  it("closing a session runs the transport's onclose once, without recursing", () => {
    const store = makeStore();
    const t = fakeTransport("a");
    // Like the real transport, close() fires onclose.
    t.close.mockImplementation(async () => t.onclose?.());
    let oncloseCalls = 0;
    store.add(t as never);
    t.onclose = () => {
      oncloseCalls++;
      store.close("a");
    };

    store.close("a");

    expect(oncloseCalls).toBe(1);
    expect(t.close).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);
  });

  it("closing an unknown session is a no-op", () => {
    const store = makeStore();
    expect(() => store.close("ghost")).not.toThrow();
  });

  it("closeAll closes every session and empties the store", () => {
    const store = makeStore();
    const a = fakeTransport("a");
    const b = fakeTransport("b");
    store.add(a as never);
    store.add(b as never);

    store.closeAll();

    expect(store.size).toBe(0);
    expect(a.close).toHaveBeenCalled();
    expect(b.close).toHaveBeenCalled();
  });
});

// ── HTTP handler integration ─────────────────────────────────────────────────

/** Build a trivial but real MCP server exposing one tool. */
function buildTestServer() {
  const server = new Server(
    { name: "test-server", version: "0.0.0" },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      { name: "ping", description: "ping", inputSchema: { type: "object" as const, properties: {} } },
    ],
  }));
  return server;
}

describe("MCP HTTP handler", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  let store: SessionStore;
  let serversCreated: number;

  beforeEach(async () => {
    serversCreated = 0;
    store = new SessionStore({ maxSessions: 4, idleTimeoutMs: 300_000 });

    const handler = createMcpRequestHandler({
      getServer: () => {
        serversCreated++;
        return buildTestServer();
      },
      serverName: "test-server",
      store,
      // Small cap so the oversize test stays fast and deterministic; the
      // production default is asserted separately below.
      maxBodyBytes: 2048,
    });

    httpServer = createServer(handler);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    store.closeAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("serves a health check", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ status: "ok" });
  });

  it("404s an unknown path", async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });

  it("rejects a body over the size cap with 413", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(8192),
    });
    expect(res.status).toBe(413);
  });

  it("ships a sane production body cap", () => {
    expect(DEFAULT_MAX_BODY_BYTES).toBeGreaterThan(64 * 1024);
    expect(DEFAULT_MAX_BODY_BYTES).toBeLessThanOrEqual(16 * 1024 * 1024);
  });

  it("returns a JSON-RPC parse error for malformed JSON", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: { code: -32700 },
    });
  });

  it("404s a request carrying an unknown session id", async () => {
    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "mcp-session-id": "does-not-exist",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }),
    });
    expect(res.status).toBe(404);
  });

  // THE bug PR #89 set out to fix: a single shared McpServer cannot back two
  // transports, so the second client used to get "400 already initialized".
  it("supports two concurrent clients, each with its own session", async () => {
    const clientA = new Client({ name: "a", version: "1.0" }, { capabilities: {} });
    const clientB = new Client({ name: "b", version: "1.0" }, { capabilities: {} });

    await clientA.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
    await clientB.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));

    const [a, b] = await Promise.all([clientA.listTools(), clientB.listTools()]);

    expect(a.tools[0].name).toBe("ping");
    expect(b.tools[0].name).toBe("ping");
    expect(store.size).toBe(2);
    expect(serversCreated).toBe(2);

    await clientA.close();
    await clientB.close();
  });

  it("reuses one session across sequential requests from the same client", async () => {
    const client = new Client({ name: "a", version: "1.0" }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));

    await client.listTools();
    await client.listTools();
    await client.listTools();

    expect(store.size).toBe(1);
    expect(serversCreated).toBe(1);

    await client.close();
  });

  it("rejects a new session with 503 once the session cap is reached", async () => {
    const clients: Client[] = [];
    for (let i = 0; i < 4; i++) {
      const c = new Client({ name: `c${i}`, version: "1.0" }, { capabilities: {} });
      await c.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`)));
      clients.push(c);
    }
    expect(store.size).toBe(4);

    const res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "overflow", version: "1.0" },
        },
      }),
    });

    expect(res.status).toBe(503);

    for (const c of clients) await c.close();
  });
});

// Per-session cleanup (the export store's temp directory, for one) hangs off the
// Server's onclose. Every way a session ends has to reach it, not only DELETE.
describe("a session's Server is told when the session ends", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  let clock: number;
  let serverClosed: ReturnType<typeof vi.fn<() => void>>;

  const initializeRequest = () =>
    fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1.0" } },
      }),
    });

  async function listen(store: SessionStore) {
    const handler = createMcpRequestHandler({
      getServer: () => {
        const server = buildTestServer();
        server.onclose = () => serverClosed();
        return server;
      },
      serverName: "test-server",
      store,
    });
    httpServer = createServer(handler);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  }

  beforeEach(() => {
    clock = 1_000_000;
    serverClosed = vi.fn<() => void>();
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("not while the session is live (control)", async () => {
    const store = new SessionStore({ idleTimeoutMs: 300_000, now: () => clock });
    await listen(store);
    expect((await initializeRequest()).status).toBe(200);

    clock += 299_000;
    expect(store.sweep()).toEqual([]);

    expect(serverClosed).not.toHaveBeenCalled();
    store.closeAll();
  });

  it("when the idle sweeper expires it", async () => {
    const store = new SessionStore({ idleTimeoutMs: 300_000, now: () => clock });
    await listen(store);
    expect((await initializeRequest()).status).toBe(200);

    clock += 300_001;
    expect(store.sweep()).toHaveLength(1);

    await vi.waitFor(() => expect(serverClosed).toHaveBeenCalledTimes(1));
    expect(store.size).toBe(0);
  });

  it("when every session is closed at shutdown", async () => {
    const store = new SessionStore({ idleTimeoutMs: 300_000, now: () => clock });
    await listen(store);
    expect((await initializeRequest()).status).toBe(200);

    store.closeAll();

    await vi.waitFor(() => expect(serverClosed).toHaveBeenCalledTimes(1));
  });

  it("when the session cannot be registered because the store filled up meanwhile", async () => {
    // isFull() is checked before the Server is built; add() can still lose the race.
    class RacingStore extends SessionStore {
      override add(): void {
        throw new SessionLimitError(0);
      }
    }
    await listen(new RacingStore());

    await initializeRequest();

    await vi.waitFor(() => expect(serverClosed).toHaveBeenCalledTimes(1));
  });
});

describe("a request that outlasts the idle timeout over the real HTTP handler", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  let clock: number;
  let store: SessionStore;
  let entered: () => void;
  let release: () => void;

  const post = (body: unknown, sessionId?: string) =>
    fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
    });

  beforeEach(async () => {
    clock = 1_000_000;
    store = new SessionStore({ idleTimeoutMs: 300_000, now: () => clock });
    const handler = createMcpRequestHandler({
      getServer: () => {
        const server = buildTestServer();
        // tools/list waits until the test lets it finish.
        server.setRequestHandler(ListToolsRequestSchema, async () => {
          entered();
          await new Promise<void>((resolve) => (release = resolve));
          return { tools: [] };
        });
        return server;
      },
      serverName: "test-server",
      store,
    });
    httpServer = createServer(handler);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    store.closeAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("keeps its session until it ends, then counts idle time from its end", async () => {
    const init = await post({
      jsonrpc: "2.0",
      method: "initialize",
      id: 1,
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1.0" } },
    });
    const sessionId = init.headers.get("mcp-session-id")!;
    const handlerEntered = new Promise<void>((resolve) => (entered = resolve));

    const slow = post({ jsonrpc: "2.0", method: "tools/list", id: 2 }, sessionId);
    await handlerEntered;
    clock += 600_000;
    expect(store.sweep()).toEqual([]);

    release();
    expect((await slow).status).toBe(200);
    expect(store.sweep()).toEqual([]);
    clock += 300_001;
    expect(store.sweep()).toEqual([sessionId]);
  });
});

describe("normalizeMcpPath", () => {
  it("keeps a plain path", () => {
    expect(normalizeMcpPath("/mcp")).toBe("/mcp");
    expect(normalizeMcpPath("/plex/mcp")).toBe("/plex/mcp");
  });

  it("strips trailing slashes but keeps the root", () => {
    expect(normalizeMcpPath("/plex/")).toBe("/plex");
    expect(normalizeMcpPath("/")).toBe("/");
  });

  // A non-ASCII path can never match: request paths arrive percent-encoded.
  it.each(["mcp", "", "/mcp?x=1", "/mcp#a", "/my mcp", "/plëx", "/mcp\u0000"])("rejects %j", (raw) => {
    expect(() => normalizeMcpPath(raw)).toThrow(/Invalid MCP path/);
  });

  it("refuses to shadow the health check", () => {
    expect(() => normalizeMcpPath("/health/")).toThrow(/health check/);
  });
});

describe("MCP HTTP handler with a custom path", () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  let store: SessionStore;

  beforeEach(async () => {
    store = new SessionStore();
    const handler = createMcpRequestHandler({
      getServer: buildTestServer,
      serverName: "test-server",
      store,
      mcpPath: "/plex/mcp/",
    });
    httpServer = createServer(handler);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    store.closeAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("serves MCP on the configured path", async () => {
    const client = new Client({ name: "a", version: "1.0" }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/plex/mcp`)));

    const { tools } = await client.listTools();
    expect(tools[0].name).toBe("ping");

    await client.close();
  });

  it("no longer answers on the default path", async () => {
    const res = await fetch(`${baseUrl}/mcp`, { method: "POST", body: "{}" });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      message: expect.stringContaining("POST /plex/mcp"),
    });
  });

  it("keeps the health check at /health", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  // Reverse proxies often forward the prefix with a trailing slash.
  it("serves MCP when the request adds a trailing slash", async () => {
    const client = new Client({ name: "a", version: "1.0" }, { capabilities: {} });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${baseUrl}/plex/mcp/`)));

    const { tools } = await client.listTools();
    expect(tools[0].name).toBe("ping");

    await client.close();
  });

  it.each(["/plex/mcpx", "/plex/mcp/x", "/plex", "/plex/mcp//x"])("still 404s %s", async (path) => {
    const res = await fetch(`${baseUrl}${path}`, { method: "POST", body: "{}" });
    expect(res.status).toBe(404);
  });
});
