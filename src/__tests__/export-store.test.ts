import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { ExportStore, registerExportResources } from "../plex/export-store.js";
import { toWireResponse } from "../plex/tool-registry.js";
import { PlexTools } from "../plex/tools.js";
import type { PlexClient } from "../plex/client.js";

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false
  );

function createMockClient() {
  return {
    makeRequest: vi.fn(),
    getPlexTypeId: vi.fn((type: string) => (type === "movie" ? 1 : 2)),
  };
}

describe("ExportStore", () => {
  let store: ExportStore;

  beforeEach(() => {
    store = new ExportStore();
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

describe("registerExportResources", () => {
  let store: ExportStore;
  let server: Server;
  let client: Client;

  beforeEach(async () => {
    store = new ExportStore();
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

describe("export_library over HTTP (export store)", () => {
  const movie = { ratingKey: "1", title: "Movie A", year: 2001, type: "movie", guid: "plex://movie/a" };
  let client: ReturnType<typeof createMockClient>;
  let store: ExportStore;
  let tools: PlexTools;

  beforeEach(() => {
    client = createMockClient();
    client.makeRequest.mockResolvedValue({ MediaContainer: { totalSize: 1, Metadata: [movie] } });
    store = new ExportStore();
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
