/**
 * Per-session store for library exports served over HTTP.
 *
 * Over HTTP the client cannot reach the server's filesystem, so export_library
 * writes its file into a private temp directory and hands the client an MCP
 * resource link. The client fetches the file with resources/read. The directory
 * lives as long as the session and is deleted when the session's Server closes:
 * on DELETE, on idle expiry and at shutdown. All session directories sit under
 * one per-process directory that is removed when the process exits, which covers
 * a deletion still in flight at exit. A process that is killed outright leaves
 * its directory behind.
 */

import { randomInt } from "node:crypto";
import { rmSync } from "node:fs";
import { lstat, mkdir, mkdtemp, rm, stat, readFile } from "node:fs/promises";
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

const NAME_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const NAME_LENGTH = 32;

/**
 * A new export file name: 32 random letters and digits, then ".json". Concurrent
 * exports of one library used to get the same name from the same millisecond.
 */
export function randomExportName(): string {
  let name = "";
  for (let i = 0; i < NAME_LENGTH; i++) {
    name += NAME_ALPHABET[randomInt(NAME_ALPHABET.length)];
  }
  return `${name}.json`;
}

export interface ExportFile {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ExportStoreOptions {
  /** Directory to create the session directory in. Defaults to one shared per process. */
  root?: string;
}

let processRoot: Promise<string> | undefined;

/**
 * The directory every session's exports live under, created on first use and removed
 * when the process exits. Exit handlers cannot await, hence the synchronous removal.
 */
function getProcessRoot(): Promise<string> {
  processRoot ??= mkdtemp(path.join(tmpdir(), "plex-mcp-exports-")).then(
    (dir) => {
      process.once("exit", () => {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // Nothing useful can be done this late.
        }
      });
      return dir;
    },
    (error) => {
      // Not cached: one failure must not fail every later export in the process.
      processRoot = undefined;
      throw error;
    }
  );
  return processRoot;
}

/**
 * True if `dir` is a real directory that only this user can reach, as mkdtemp makes
 * them. A directory that was removed from outside can come back as someone else's, or
 * as a link, so anything else is treated as gone. Windows has no such modes to check.
 */
async function isPrivateDir(dir: string): Promise<boolean> {
  try {
    const info = await lstat(dir);
    if (!info.isDirectory()) return false;
    // New files belong to the effective user, so that is the one to compare.
    if (typeof process.geteuid !== "function") return true;
    return info.uid === process.geteuid() && (info.mode & 0o077) === 0;
  } catch {
    return false;
  }
}

/** Removes a directory this store stopped using, if it is still a directory of ours. */
async function removeIfOurs(dir: string): Promise<void> {
  try {
    const info = await lstat(dir);
    const ours = typeof process.geteuid !== "function" || info.uid === process.geteuid();
    if (info.isDirectory() && ours) {
      await rm(dir, { recursive: true, force: true });
    }
  } catch {
    // Already gone, or not ours to remove.
  }
}

/** The shared root, replaced by a new one if the old one is no longer ours. */
async function usableProcessRoot(): Promise<string> {
  const current = getProcessRoot();
  const root = await current;
  if (await isPrivateDir(root)) return root;
  // The old path is known to anyone who listed the temp directory: do not reuse it.
  if (processRoot === current) processRoot = undefined;
  return getProcessRoot();
}

/** A new directory for one session. Brings a caller's own root back if it was removed. */
async function createSessionDir(root: string): Promise<string> {
  const prefix = path.join(root, "session-");
  let dir: string;
  try {
    dir = await mkdtemp(prefix);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // mkdir succeeds on a directory that is already there, whoever made it.
    await mkdir(root, { recursive: true, mode: 0o700 });
    if (!(await isPrivateDir(root))) {
      throw new Error("The export directory was replaced by one that is not private to this server");
    }
    dir = await mkdtemp(prefix);
  }
  // A filesystem with no owners or modes would fail the check on every export, and each
  // one would start another directory. Say so once instead.
  if (!(await isPrivateDir(dir))) {
    await removeIfOurs(dir);
    throw new Error("Could not create an export directory that is private to this server");
  }
  return dir;
}

export class ExportStore {
  private dirPromise?: Promise<string>;
  private disposed = false;
  private readonly files = new Map<string, { file: ExportFile; filePath: string }>();

  constructor(private readonly options: ExportStoreOptions = {}) {}

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("The export store is closed: its session has ended");
    }
  }

  /** Returns the path to write an export to. Not readable by clients until publish(). */
  async reserve(name: string): Promise<string> {
    this.assertOpen();
    let dir = await this.sessionDir();
    if (!(await isPrivateDir(dir))) {
      // Something outside the server removed or replaced a live session's directory.
      // Its files went with it. Start a new one instead of reusing the path.
      dir = await this.sessionDir(dir);
    }
    if (this.disposed) {
      // The session closed meanwhile, and dispose() may have run before the directory existed.
      await rm(dir, { recursive: true, force: true });
      this.assertOpen();
    }
    return path.join(dir, name);
  }

  /** The session's directory, created on first use. `lost` names one to stop using. */
  private async sessionDir(lost?: string): Promise<string> {
    if (lost !== undefined && this.dirPromise && (await this.dirPromise.catch(() => undefined)) === lost) {
      this.dirPromise = undefined;
      this.files.clear();
      await removeIfOurs(lost);
    }
    // Cache the promise, not the result, so concurrent exports share one directory.
    const dirPromise = (this.dirPromise ??= (
      this.options.root !== undefined ? Promise.resolve(this.options.root) : usableProcessRoot()
    ).then(createSessionDir));
    try {
      return await dirPromise;
    } catch (error) {
      // Not cached, so the session's next export can try again.
      if (this.dirPromise === dirPromise) this.dirPromise = undefined;
      throw error;
    }
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
    // A concurrent reserve() may have replaced the directory while this one waited.
    this.assertOpen();
    if ((await this.dirPromise?.catch(() => undefined)) !== path.dirname(filePath)) {
      throw new Error("The export directory was replaced while the export ran");
    }
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

  /** Removes the session's files. Afterwards reserve() and publish() throw. Safe to repeat. */
  async dispose(): Promise<void> {
    this.disposed = true;
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
