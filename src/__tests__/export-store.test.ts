import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { access, chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, utimes, writeFile } from "node:fs/promises";
import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { SessionStore, createMcpRequestHandler } from "../shared/transport.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ExportStore, registerExportResources, sweepExpiredExports } from "../plex/export-store.js";
import { toWireResponse } from "../plex/tool-registry.js";
import { PlexTools } from "../plex/tools.js";
import type { PlexClient } from "../plex/client.js";

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false
  );

// Every store in this file gets its own root. The default root is only removed by a
// process exit handler, which never runs in a test worker, so using it would leave a
// directory behind on every run.
let fileRoot: string;

beforeAll(async () => {
  fileRoot = await mkdtemp(path.join(tmpdir(), "export-store-file-"));
});

afterAll(async () => {
  await rm(fileRoot, { recursive: true, force: true });
});

function createMockClient() {
  return {
    makeRequest: vi.fn(),
    getPlexTypeId: vi.fn((type: string) => (type === "movie" ? 1 : 2)),
  };
}

describe("ExportStore", () => {
  let store: ExportStore;

  beforeEach(() => {
    store = new ExportStore({ root: fileRoot });
  });

  afterEach(async () => {
    await store.dispose();
  });

  it("serves a published file by URI and lists it", async () => {
    await writeFile(await store.reserve("a.json"), "[1]\n");
    const file = await store.publish("a.json");

    expect(file).toMatchObject({ uri: "plex-export:///a.json", name: "a.json", mimeType: "application/json", size: 4 });
    expect(store.list()).toEqual([file]);
    expect(await store.read(file.uri)).toBe("[1]\n");
  });

  // #246 item 1: a session that exported repeatedly grew by one full export each time.
  it("removes the session's oldest exports once a new one does not fit", async () => {
    const small = new ExportStore({ root: fileRoot, maxBytes: 10 });
    try {
      const published = [];
      for (const name of ["a.json", "b.json", "c.json"]) {
        await writeFile(await small.reserve(name), "[12]");
        published.push(await small.publish(name));
      }
      const [oldest, ...kept] = published;

      expect(small.list()).toEqual(kept);
      await expect(small.read(oldest.uri)).rejects.toThrow(/Unknown resource/);
      expect(await readdir(path.dirname(await small.reserve("x.json")))).toEqual(["b.json", "c.json"]);
    } finally {
      await small.dispose();
    }
  });

  it("refuses an export that alone is larger than the session may keep, and keeps the others", async () => {
    const small = new ExportStore({ root: fileRoot, maxBytes: 10 });
    try {
      await writeFile(await small.reserve("a.json"), "[1]");
      const kept = await small.publish("a.json");
      await writeFile(await small.reserve("big.json"), "[1234567890]");

      await expect(small.publish("big.json")).rejects.toThrow(/larger than the 10 bytes a session may keep/);
      expect(small.list()).toEqual([kept]);
    } finally {
      await small.dispose();
    }
  });

  it("takes the limit from PLEX_EXPORT_MAX_BYTES, 256 KiB by default", () => {
    const saved = process.env.PLEX_EXPORT_MAX_BYTES;
    try {
      delete process.env.PLEX_EXPORT_MAX_BYTES;
      expect(new ExportStore().maxBytes).toBe(262_144);
      process.env.PLEX_EXPORT_MAX_BYTES = "1000";
      expect(new ExportStore().maxBytes).toBe(1000);
    } finally {
      if (saved === undefined) delete process.env.PLEX_EXPORT_MAX_BYTES;
      else process.env.PLEX_EXPORT_MAX_BYTES = saved;
    }
  });

  it("does not expose a reserved file until it is published", async () => {
    await writeFile(await store.reserve("a.json"), "[]");

    expect(store.list()).toEqual([]);
    await expect(store.read("plex-export:///a.json")).rejects.toMatchObject({ code: ErrorCode.InvalidParams });
  });

  it("refuses URIs it did not publish, including path traversal", async () => {
    await expect(store.read("plex-export:///../../etc/passwd")).rejects.toBeInstanceOf(McpError);
    await expect(store.read("file:///etc/passwd")).rejects.toBeInstanceOf(McpError);
  });

  it("uses one directory for concurrent reservations and removes it on dispose", async () => {
    const [a, b] = await Promise.all([store.reserve("a.json"), store.reserve("b.json")]);
    expect(path.dirname(a)).toBe(path.dirname(b));
    await mkdir(path.dirname(a), { recursive: true });
    await store.dispose();
    expect(await exists(path.dirname(a))).toBe(false);
  });

  it("dispose is safe when nothing was ever reserved", async () => {
    await expect(new ExportStore().dispose()).resolves.toBeUndefined();
  });
});

describe("ExportStore lifetime", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "export-store-test-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("keeps each session in its own directory under the root (control)", async () => {
    const a = new ExportStore({ root });
    const b = new ExportStore({ root });

    const fileA = await a.reserve("x.json");
    const fileB = await b.reserve("x.json");

    expect(path.dirname(path.dirname(fileA))).toBe(root);
    expect(path.dirname(fileA)).not.toBe(path.dirname(fileB));
    expect(await readdir(root)).toHaveLength(2);

    await a.dispose();
    expect(await readdir(root)).toEqual([path.basename(path.dirname(fileB))]);
    await b.dispose();
  });

  // An export still running when its session closes used to call publish, which made a
  // new directory that nothing removed.
  it("refuses to reserve or publish after dispose, and creates nothing", async () => {
    const store = new ExportStore({ root });
    await writeFile(await store.reserve("a.json"), "[]");
    await store.dispose();

    await expect(store.reserve("b.json")).rejects.toThrow(/closed/);
    await expect(store.publish("a.json")).rejects.toThrow(/closed/);
    expect(await readdir(root)).toEqual([]);
  });

  it("an export whose session closes midway fails and leaves nothing behind", async () => {
    const store = new ExportStore({ root });
    const client = createMockClient();
    client.makeRequest.mockImplementation(async () => {
      await store.dispose();
      return { MediaContainer: { totalSize: 1, Metadata: [{ ratingKey: "1", title: "Movie A", type: "movie" }] } };
    });
    const tools = new PlexTools(client as unknown as PlexClient, { exportStore: store });

    await expect(tools.exportLibrary("1", "movie")).rejects.toBeInstanceOf(McpError);

    expect(store.list()).toEqual([]);
    expect(await readdir(root)).toEqual([]);
  });

  /** A Plex request that takes an event-loop turn, as every real one does. */
  function slowPlex() {
    const client = createMockClient();
    client.makeRequest.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { MediaContainer: { totalSize: 1, Metadata: [{ ratingKey: "1", title: "Movie A", type: "movie" }] } };
    });
    return client;
  }

  // The session can close between the path being reserved and the file being opened.
  // The export must fail, not hang on a destroyed stream, and must not bring the
  // directory back.
  it("an export whose session closes right after reserving fails and leaves nothing behind", { timeout: 3000 }, async () => {
    const store = new ExportStore({ root });
    const reserve = store.reserve.bind(store);
    vi.spyOn(store, "reserve").mockImplementationOnce(async (name: string) => {
      const filePath = await reserve(name);
      await store.dispose();
      return filePath;
    });
    const tools = new PlexTools(slowPlex() as unknown as PlexClient, { exportStore: store });

    await expect(tools.exportLibrary("1", "movie")).rejects.toBeInstanceOf(McpError);

    expect(await readdir(root)).toEqual([]);
  });

  it("removes the written file when it cannot be published", async () => {
    const store = new ExportStore({ root });
    vi.spyOn(store, "publish").mockRejectedValue(new Error("boom"));
    const tools = new PlexTools(slowPlex() as unknown as PlexClient, { exportStore: store });

    await expect(tools.exportLibrary("1", "movie")).rejects.toThrow(/Failed to export library: boom/);

    const [sessionDir] = await readdir(root);
    expect(await readdir(path.join(root, sessionDir))).toEqual([]);
  });

  // Something outside the server (a temp cleaner, an operator) can delete the files of a
  // session that is still live. The next export must work, not hang or fail for good.
  it("exports again after the session's directory was removed from outside", { timeout: 3000 }, async () => {
    const store = new ExportStore({ root });
    const tools = new PlexTools(slowPlex() as unknown as PlexClient, { exportStore: store });
    await tools.exportLibrary("1", "movie");
    const [sessionDir] = await readdir(root);
    await rm(path.join(root, sessionDir), { recursive: true });

    const response = await tools.exportLibrary("1", "movie");

    const [link] = response.resourceLinks!;
    expect(JSON.parse(await store.read(link.uri))).toHaveLength(1);
  });

  it("starts a new session's exports after the root itself was removed", async () => {
    await rm(root, { recursive: true });

    const filePath = await new ExportStore({ root }).reserve("a.json");

    expect(await exists(path.dirname(filePath))).toBe(true);
  });

  const permissions = async (dir: string) => (await stat(dir)).mode & 0o777;

  // Exports hold the user's library. mkdtemp makes directories only the owner can read,
  // and a directory brought back after an outside removal must be no more open than that.
  it.skipIf(process.platform === "win32")("keeps a replaced session directory, and a recreated root, private", async () => {
    const store = new ExportStore({ root });
    const first = path.dirname(await store.reserve("a.json"));
    expect(await permissions(first)).toBe(0o700);

    await rm(root, { recursive: true });
    const second = path.dirname(await store.reserve("a.json"));

    expect(await permissions(second)).toBe(0o700);
    expect(await permissions(root)).toBe(0o700);
  });

  // A directory at the old path that others can read may not be ours any more.
  it.skipIf(process.platform === "win32")("moves to a new directory, and forgets the old files, if the old one is no longer private", async () => {
    const store = new ExportStore({ root });
    const first = await store.reserve("a.json");
    await writeFile(first, "[]");
    await store.publish("a.json");
    await chmod(path.dirname(first), 0o755);

    const second = await store.reserve("b.json");

    expect(path.dirname(second)).not.toBe(path.dirname(first));
    expect(await permissions(path.dirname(second))).toBe(0o700);
    expect(store.list()).toEqual([]);
    // Still ours, so it is removed, not left for others to read.
    expect(await exists(path.dirname(first))).toBe(false);
  });

  it("a reserve still running when the session closes fails and leaves nothing behind", async () => {
    const store = new ExportStore({ root });
    await store.reserve("a.json");

    const pending = store.reserve("b.json");
    const disposing = store.dispose();

    await expect(pending).rejects.toThrow(/closed/);
    await disposing;
    expect(await readdir(root)).toEqual([]);
  });

  it("lets the same session try again after its directory could not be created", async () => {
    // A file where the root should be: creating the session directory fails.
    await rm(root, { recursive: true });
    await writeFile(root, "");
    const store = new ExportStore({ root });
    await expect(store.reserve("a.json")).rejects.toThrow();

    await rm(root);
    await mkdir(root);

    expect(await exists(path.dirname(await store.reserve("a.json")))).toBe(true);
  });
});

// Shutdown calls process.exit() while dispose() may still be deleting, and a crash in
// the close path runs no dispose at all. The exit handler is the backstop.
describe("ExportStore default root", () => {
  let onceSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    onceSpy = vi.spyOn(process, "once");
  });

  afterEach(() => {
    onceSpy.mockRestore();
  });

  const exitHandlers = () =>
    onceSpy.mock.calls.filter((call: unknown[]) => call[0] === "exit").map((call: unknown[]) => call[1] as () => void);

  it("registers nothing until an export is reserved (control: stdio never reserves)", async () => {
    const fresh = await import("../plex/export-store.js");
    new fresh.ExportStore();

    expect(exitHandlers()).toEqual([]);
  });

  it("puts every session under one directory and removes it, files included, on exit", async () => {
    const fresh = await import("../plex/export-store.js");
    const a = new fresh.ExportStore();
    const b = new fresh.ExportStore();
    const fileA = await a.reserve("a.json");
    const fileB = await b.reserve("b.json");
    await writeFile(fileA, "[]");
    const sharedRoot = path.dirname(path.dirname(fileA));

    expect(path.dirname(path.dirname(fileB))).toBe(sharedRoot);
    expect(exitHandlers()).toHaveLength(1);

    exitHandlers()[0]();

    expect(await exists(sharedRoot)).toBe(false);
  });

  // The old path is known to anyone who listed the temp directory, so it is not reused.
  it("makes a new shared directory if the old one was removed from outside", async () => {
    const fresh = await import("../plex/export-store.js");
    const first = path.dirname(path.dirname(await new fresh.ExportStore().reserve("a.json")));
    await rm(first, { recursive: true });

    const second = path.dirname(path.dirname(await new fresh.ExportStore().reserve("a.json")));

    expect(second).not.toBe(first);
    expect(await exists(first)).toBe(false);
    for (const handler of exitHandlers()) handler();
    expect(await exists(second)).toBe(false);
  });

  // One failure to create the shared directory must not fail every later export.
  it("tries again after the shared directory could not be created", async () => {
    const fresh = await import("../plex/export-store.js");
    const realTmp = process.env.TMPDIR;
    process.env.TMPDIR = path.join(tmpdir(), `export-store-missing-${process.pid}`);
    try {
      await expect(new fresh.ExportStore().reserve("a.json")).rejects.toThrow(/ENOENT/);
    } finally {
      if (realTmp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = realTmp;
    }

    const filePath = await new fresh.ExportStore().reserve("a.json");

    expect(await exists(path.dirname(filePath))).toBe(true);
    exitHandlers()[0]();
    expect(await exists(path.dirname(path.dirname(filePath)))).toBe(false);
  });
});

// #246 item 6: nothing removed the directory of a process that was killed.
describe("export lifetime", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const NOW = Date.UTC(2030, 0, 15);
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "export-store-sweep-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /** Gives a file or directory this modification time, `daysAgo` before NOW. */
  const age = (target: string, daysAgo: number) => {
    const when = new Date(NOW - daysAgo * DAY_MS);
    return utimes(target, when, when);
  };

  async function writeAged(file: string, daysAgo: number) {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "[]");
    await age(file, daysAgo);
  }

  it("takes the lifetime from PLEX_EXPORT_MAX_AGE_SECONDS, 7 days by default", () => {
    const saved = process.env.PLEX_EXPORT_MAX_AGE_SECONDS;
    try {
      delete process.env.PLEX_EXPORT_MAX_AGE_SECONDS;
      expect(new ExportStore().maxAgeMs).toBe(7 * DAY_MS);
      process.env.PLEX_EXPORT_MAX_AGE_SECONDS = "60";
      expect(new ExportStore().maxAgeMs).toBe(60_000);
    } finally {
      if (saved === undefined) delete process.env.PLEX_EXPORT_MAX_AGE_SECONDS;
      else process.env.PLEX_EXPORT_MAX_AGE_SECONDS = saved;
    }
  });

  it("a store forgets and deletes an export once it is older than the lifetime", async () => {
    let clock = NOW;
    const store = new ExportStore({ root: dir, maxAgeMs: 7 * DAY_MS, now: () => clock });
    try {
      const filePath = await store.reserve("a.json");
      await writeAged(filePath, 0);
      const file = await store.publish("a.json");

      clock += 7 * DAY_MS;
      expect(store.list()).toEqual([file]);

      clock += 1;
      expect(store.list()).toEqual([]);
      await expect(store.read(file.uri)).rejects.toThrow(/Unknown resource/);
      await vi.waitFor(async () => expect(await exists(filePath)).toBe(false));
    } finally {
      await store.dispose();
    }
  });

  it("deletes expired files and the directories they leave empty, from every process's directory", async () => {
    const killed = path.join(dir, "plex-mcp-exports-killed");
    const live = path.join(dir, "plex-mcp-exports-live");
    const unrelated = path.join(dir, "something-else");
    await writeAged(path.join(killed, "session-a", "old.json"), 8);
    await writeAged(path.join(live, "session-b", "old.json"), 8);
    await writeAged(path.join(live, "session-b", "new.json"), 1);
    await writeAged(path.join(unrelated, "old.json"), 30);
    // Creating entries moved the directories' own times; put them back.
    for (const target of [path.join(killed, "session-a"), killed, path.join(live, "session-b"), live]) {
      await age(target, 8);
    }

    await sweepExpiredExports({ dir, maxAgeMs: 7 * DAY_MS, now: () => NOW });

    expect(await exists(killed)).toBe(false);
    expect(await readdir(path.join(live, "session-b"))).toEqual(["new.json"]);
    expect(await exists(path.join(unrelated, "old.json"))).toBe(true);
  });

  it("keeps a recent empty directory, which a live session may be about to write to", async () => {
    const fresh = path.join(dir, "plex-mcp-exports-fresh", "session-c");
    await mkdir(fresh, { recursive: true });
    await age(fresh, 1);
    await age(path.dirname(fresh), 1);

    await sweepExpiredExports({ dir, maxAgeMs: 7 * DAY_MS, now: () => NOW });

    expect(await exists(fresh)).toBe(true);
  });

  it("startExportSweeper sweeps the temp directory at once", async () => {
    const fresh = await import("../plex/export-store.js");
    const killed = path.join(dir, "plex-mcp-exports-killed");
    const old = new Date(Date.now() - 8 * DAY_MS);
    await mkdir(path.join(killed, "session-a"), { recursive: true });
    await writeFile(path.join(killed, "session-a", "old.json"), "[]");
    for (const target of [path.join(killed, "session-a", "old.json"), path.join(killed, "session-a"), killed]) {
      await utimes(target, old, old);
    }
    const realTmp = process.env.TMPDIR;
    process.env.TMPDIR = dir;
    try {
      fresh.startExportSweeper();
      await vi.waitFor(async () => expect(await exists(killed)).toBe(false));
    } finally {
      fresh.stopExportSweeper();
      if (realTmp === undefined) delete process.env.TMPDIR;
      else process.env.TMPDIR = realTmp;
    }
  });

  it("does not follow links out of an export directory", async () => {
    const outside = path.join(dir, "outside");
    await writeAged(path.join(outside, "old.json"), 30);
    const root = path.join(dir, "plex-mcp-exports-linked");
    await mkdir(root);
    await symlink(outside, path.join(root, "session-link"));

    await sweepExpiredExports({ dir, maxAgeMs: 7 * DAY_MS, now: () => NOW });

    expect(await exists(path.join(outside, "old.json"))).toBe(true);
  });
});

describe("registerExportResources", () => {
  let store: ExportStore;
  let server: Server;
  let client: Client;

  beforeEach(async () => {
    store = new ExportStore({ root: fileRoot });
    server = new Server({ name: "test", version: "0" }, { capabilities: { tools: {} } });
    registerExportResources(server, store);
    client = new Client({ name: "test-client", version: "0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close();
    await store.dispose();
  });

  it("advertises resources, lists and reads an export over MCP", async () => {
    expect(client.getServerCapabilities()?.resources).toBeDefined();
    await writeFile(await store.reserve("a.json"), '[{"ratingKey":"1"}]\n');
    const file = await store.publish("a.json");

    const listed = await client.listResources();
    expect(listed.resources).toEqual([expect.objectContaining({ uri: file.uri, mimeType: "application/json" })]);

    const read = await client.readResource({ uri: file.uri });
    expect(read.contents).toEqual([{ uri: file.uri, mimeType: "application/json", text: '[{"ratingKey":"1"}]\n' }]);
  });

  it("returns an error for an unknown resource", async () => {
    await expect(client.readResource({ uri: "plex-export:///missing.json" })).rejects.toThrow(/Unknown resource/);
  });

  it("removes the session's files when the session closes", async () => {
    const filePath = await store.reserve("a.json");
    await mkdir(path.dirname(filePath), { recursive: true });

    await client.close();
    await vi.waitFor(async () => expect(await exists(path.dirname(filePath))).toBe(false));
  });
});

// The review of #244 found the directory was removed only when the client sent DELETE.
describe("a session's exports over the real HTTP handler", () => {
  let root: string;
  let httpServer: HttpServer;
  let baseUrl: string;
  let clock: number;
  let sessions: SessionStore;
  let exportStore: ExportStore;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "export-store-http-"));
    clock = 1_000_000;
    sessions = new SessionStore({ idleTimeoutMs: 300_000, now: () => clock });
    const handler = createMcpRequestHandler({
      getServer: () => {
        const server = new Server({ name: "test", version: "0" }, { capabilities: { tools: {} } });
        exportStore = new ExportStore({ root });
        registerExportResources(server, exportStore);
        return server;
      },
      serverName: "test",
      store: sessions,
    });
    httpServer = createServer(handler);
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1.0" } },
      }),
    });
    expect(response.status).toBe(200);
    await writeFile(await exportStore.reserve("a.json"), "[]");
    await exportStore.publish("a.json");
  });

  afterEach(async () => {
    sessions.closeAll();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });

  it("are kept while the session is live (control)", async () => {
    clock += 299_000;
    expect(sessions.sweep()).toEqual([]);

    expect(await readdir(root)).toHaveLength(1);
    expect(exportStore.list()).toHaveLength(1);
  });

  it("are removed when the idle sweeper expires the session", async () => {
    clock += 300_001;
    expect(sessions.sweep()).toHaveLength(1);

    await vi.waitFor(async () => expect(await readdir(root)).toEqual([]));
  });

  it("are removed when every session is closed at shutdown", async () => {
    sessions.closeAll();

    await vi.waitFor(async () => expect(await readdir(root)).toEqual([]));
  });
});

describe("export_library over HTTP (export store)", () => {
  const movie = { ratingKey: "1", title: "Movie A", year: 2001, type: "movie", guid: "plex://movie/a" };
  let client: ReturnType<typeof createMockClient>;
  let store: ExportStore;
  let tools: PlexTools;

  beforeEach(() => {
    client = createMockClient();
    client.makeRequest.mockResolvedValue({ MediaContainer: { totalSize: 1, Metadata: [movie] } });
    store = new ExportStore({ root: fileRoot });
    tools = new PlexTools(client as unknown as PlexClient, { exportStore: store });
  });

  afterEach(async () => {
    await store.dispose();
  });

  it("returns a resource link instead of a server path, and the link serves the records", async () => {
    const response = await tools.exportLibrary("1", "movie", "ignored.json");

    const summary = JSON.parse(response.content[0].text);
    expect(summary).toMatchObject({ exported: true, libraryKey: "1", type: "movie", totalExported: 1, totalSize: 1 });
    expect(summary.outputPath).toBeUndefined();

    expect(response.resourceLinks).toHaveLength(1);
    const [link] = response.resourceLinks!;
    expect(link).toMatchObject({ type: "resource_link", mimeType: "application/json" });
    expect(summary.resourceUri).toBe(link.uri);
    expect(JSON.parse(await store.read(link.uri))).toEqual([expect.objectContaining({ ratingKey: "1", title: "Movie A" })]);
  });

  // #246 item 2: names came from Date.now(), so two exports in one millisecond shared a file.
  it("gives concurrent exports of one library their own random file names", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    try {
      const responses = await Promise.all([tools.exportLibrary("1", "movie"), tools.exportLibrary("1", "movie")]);
      const links = responses.map((response) => response.resourceLinks![0]);

      for (const link of links) {
        expect(link.name).toMatch(/^[A-Za-z0-9]{32}\.json$/);
        expect(JSON.parse(await store.read(link.uri))).toHaveLength(1);
      }
      expect(links[0].uri).not.toBe(links[1].uri);
      expect(store.list()).toHaveLength(2);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("stops an export larger than the session may keep, and leaves the older exports alone", async () => {
    const small = new ExportStore({ root: fileRoot, maxBytes: 1000 });
    const smallTools = new PlexTools(client as unknown as PlexClient, { exportStore: small });
    try {
      const first = (await smallTools.exportLibrary("1", "movie")).resourceLinks![0];
      const many = Array.from({ length: 50 }, (_, i) => ({ ...movie, ratingKey: String(i) }));
      client.makeRequest.mockResolvedValue({ MediaContainer: { totalSize: many.length, Metadata: many } });

      await expect(smallTools.exportLibrary("1", "movie")).rejects.toThrow(
        "Failed to export library: The export is larger than the 1000 bytes a session may keep"
      );
      expect(small.list().map((file) => file.uri)).toEqual([first.uri]);
      expect(await readdir(path.dirname(await small.reserve("x.json")))).toEqual([first.name]);
    } finally {
      await small.dispose();
    }
  });

  it("does not write under ./exports, even when outputPath is given", async () => {
    await tools.exportLibrary("1", "movie", "http-mode-test.json");
    expect(await exists(path.resolve(process.cwd(), "exports", "http-mode-test.json"))).toBe(false);
  });

  it("publishes nothing when the export fails", async () => {
    client.makeRequest.mockRejectedValue(new Error("plex down"));
    await expect(tools.exportLibrary("1", "movie")).rejects.toThrow(/Failed to export library|plex down/);
    expect(store.list()).toEqual([]);
  });

  it("still validates the library key", async () => {
    await expect(tools.exportLibrary("../x")).rejects.toThrow(/numeric Plex ID/);
  });

  it("without a store (stdio) keeps writing a file and returns its path with no links", async () => {
    const stdioTools = new PlexTools(client as unknown as PlexClient);
    const name = `export-store-stdio-${process.pid}.json`;
    const file = path.resolve(process.cwd(), "exports", name);
    try {
      const response = await stdioTools.exportLibrary("1", "movie", name);
      expect(JSON.parse(response.content[0].text).outputPath).toBe(file);
      expect(response.resourceLinks).toBeUndefined();
      expect(JSON.parse(await readFile(file, "utf8"))).toHaveLength(1);
    } finally {
      await rm(file, { force: true });
    }
  });
});

describe("toWireResponse", () => {
  it("appends resource links to content and drops the internal field", () => {
    const link = { type: "resource_link" as const, uri: "plex-export:///a.json", name: "a.json" };
    const wire = toWireResponse({ content: [{ type: "text", text: "x" }], resourceLinks: [link] });
    expect(wire).toEqual({ content: [{ type: "text", text: "x" }, link] });
  });

  it("leaves responses without links unchanged", () => {
    const response = { content: [{ type: "text", text: "x" }] };
    expect(toWireResponse(response)).toEqual(response);
  });
});
