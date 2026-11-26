/**
 * Per-session store for library exports served over HTTP.
 *
 * Over HTTP the client cannot reach the server's filesystem, so export_library
 * writes its file into a private temp directory and hands the client an MCP
 * resource link. The client fetches the file with resources/read. The directory
 * lives as long as the session and is deleted when the session closes.
 */

import { mkdtemp, rm, stat, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const EXPORT_URI_PREFIX = "plex-export:///";
export const EXPORT_MIME_TYPE = "application/json";

export interface ExportFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export class ExportStore {
  private dirPromise?: Promise<string>;
  private readonly files = new Map<string, { file: ExportFile; filePath: string }>();

  /** Returns the path to write an export to. Not readable by clients until publish(). */
  async reserve(name: string): Promise<string> {
    // Cache the promise, not the result, so concurrent exports share one directory.
    this.dirPromise ??= mkdtemp(path.join(tmpdir(), "plex-mcp-exports-"));
    return path.join(await this.dirPromise, name);
  }

  /** Makes a fully written, reserved file readable by the client. */
  async publish(name: string): Promise<ExportFile> {
    const filePath = await this.reserve(name);
    const file: ExportFile = {
      uri: `${EXPORT_URI_PREFIX}${name}`,
      name,
      mimeType: EXPORT_MIME_TYPE,
      size: (await stat(filePath)).size,
    };
    this.files.set(file.uri, { file, filePath });
    return file;
  }

  list(): ExportFile[] {
    return [...this.files.values()].map((entry) => entry.file);
  }

  async read(uri: string): Promise<string> {
    const entry = this.files.get(uri);
    if (!entry) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    return readFile(entry.filePath, "utf8");
  }

  async dispose(): Promise<void> {
    const dirPromise = this.dirPromise;
    this.dirPromise = undefined;
    this.files.clear();
    if (dirPromise) {
      await rm(await dirPromise, { recursive: true, force: true });
    }
  }
}

/** Serves the store's exports as MCP resources and removes them when the session closes. */
export function registerExportResources(server: Server, store: ExportStore): void {
  // Capabilities must be declared before the transport connects.
  server.registerCapabilities({ resources: {} });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: store.list(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    return { contents: [{ uri, mimeType: EXPORT_MIME_TYPE, text: await store.read(uri) }] };
  });

  server.onclose = () => {
    store.dispose().catch((error) => {
      console.error("Failed to remove session exports:", error);
    });
  };
}
