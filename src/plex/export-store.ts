/**
 * Per-session store for library exports served over HTTP.
 *
 * Over HTTP the client cannot reach the server's filesystem, so export_library
 * writes its file into a private temp directory and hands the client an MCP
 * resource link. The client fetches the file with resources/read. The directory
 * lives as long as the session and is deleted when the session's Server closes:
 * on DELETE, on idle expiry and at shutdown. All session directories sit under
 * one per-process directory that is removed when the process exits, which covers
 * a deletion still in flight at exit.
 *
 * No export outlives PLEX_EXPORT_MAX_AGE_SECONDS. The store forgets older ones, and
 * startExportSweeper() deletes them from disk, including those a killed process left.
 */

import { randomInt } from "node:crypto";
import { rmSync } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, rmdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  ListResourcesRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { positiveIntFromEnv } from "../shared/utils.js";

export const EXPORT_URI_PREFIX = "plex-export:///";
export const EXPORT_MIME_TYPE = "application/json";

export const EXPORT_MAX_BYTES_ENV_VAR = "PLEX_EXPORT_MAX_BYTES";
/** Space a session's exports may take together unless PLEX_EXPORT_MAX_BYTES says otherwise. */
export const DEFAULT_EXPORT_MAX_BYTES = 256 * 1024;

export const EXPORT_MAX_AGE_ENV_VAR = "PLEX_EXPORT_MAX_AGE_SECONDS";
/** How long an export is kept unless PLEX_EXPORT_MAX_AGE_SECONDS says otherwise. */
export const DEFAULT_EXPORT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

/** The longest the sweeper waits between runs. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Every process's export directory in the temp directory starts with this. */
const PROCESS_ROOT_PREFIX = "plex-mcp-exports-";

function exportMaxAgeMs(): number {
  return positiveIntFromEnv(EXPORT_MAX_AGE_ENV_VAR, DEFAULT_EXPORT_MAX_AGE_SECONDS) * 1000;
}

/** One rule for the store and the sweeper: an export expires this long after it was written. */
function isExpired(modifiedMs: number, maxAgeMs: number, now: number): boolean {
  return now - modifiedMs > maxAgeMs;
}

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
  /** Bytes the session's exports may take together. Defaults to PLEX_EXPORT_MAX_BYTES. */
  maxBytes?: number;
  /** How long an export is kept. Defaults to PLEX_EXPORT_MAX_AGE_SECONDS. */
  maxAgeMs?: number;
  /** Injectable clock, for testing expiry. */
  now?: () => number;
}

let processRoot: Promise<string> | undefined;

/**
 * The directory every session's exports live under, created on first use and removed
 * when the process exits. Exit handlers cannot await, hence the synchronous removal.
 */
function getProcessRoot(): Promise<string> {
  processRoot ??= mkdtemp(path.join(tmpdir(), PROCESS_ROOT_PREFIX)).then(
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

/** True if this user owns the entry. Windows has no owners to check. */
function isOurs(info: Stats): boolean {
  return typeof process.geteuid !== "function" || info.uid === process.geteuid();
}

/** Removes a directory this store stopped using, if it is still a directory of ours. */
async function removeIfOurs(dir: string): Promise<void> {
  try {
    const info = await lstat(dir);
    if (info.isDirectory() && isOurs(info)) {
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

/** Why an export was refused for being larger than a session may keep. */
export function exportTooLargeMessage(maxBytes: number): string {
  return `The export is larger than the ${maxBytes} bytes a session may keep (set ${EXPORT_MAX_BYTES_ENV_VAR} to change it)`;
}

export class ExportStore {
  private dirPromise?: Promise<string>;
  private disposed = false;
  private readonly files = new Map<string, { file: ExportFile; filePath: string; modifiedMs: number }>();
  private readonly now: () => number;

  /** Bytes the session's exports may take together. Publishing removes the oldest to stay within it. */
  readonly maxBytes: number;
  /** How long an export is kept after it was written. */
  readonly maxAgeMs: number;

  constructor(private readonly options: ExportStoreOptions = {}) {
    this.maxBytes = options.maxBytes ?? positiveIntFromEnv(EXPORT_MAX_BYTES_ENV_VAR, DEFAULT_EXPORT_MAX_BYTES);
    this.maxAgeMs = options.maxAgeMs ?? exportMaxAgeMs();
    this.now = options.now ?? Date.now;
  }

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

  /**
   * Makes a fully written, reserved file readable by the client. Removes the session's
   * oldest exports until all of them fit in maxBytes. A file that alone does not fit is
   * refused.
   */
  async publish(name: string): Promise<ExportFile> {
    const filePath = await this.reserve(name);
    const info = await stat(filePath);
    const file: ExportFile = {
      uri: `${EXPORT_URI_PREFIX}${name}`,
      name,
      mimeType: EXPORT_MIME_TYPE,
      size: info.size,
    };
    if (file.size > this.maxBytes) {
      throw new Error(exportTooLargeMessage(this.maxBytes));
    }
    // A concurrent reserve() may have replaced the directory while this one waited.
    this.assertOpen();
    if ((await this.dirPromise?.catch(() => undefined)) !== path.dirname(filePath)) {
      throw new Error("The export directory was replaced while the export ran");
    }
    // Expiry goes by the file's mtime, as the sweeper's does, so both agree on the moment.
    this.files.set(file.uri, { file, filePath, modifiedMs: info.mtimeMs });
    this.dropExpired();
    await this.evictOldest();
    return file;
  }

  /** Removes the oldest exports until the session's exports fit in maxBytes again. */
  private async evictOldest(): Promise<void> {
    let total = 0;
    for (const { file } of this.files.values()) total += file.size;
    // A Map iterates in insertion order, so the oldest come first. The newest always
    // fits on its own, so the loop stops before reaching it.
    const evicted: string[] = [];
    for (const [uri, { file, filePath }] of this.files) {
      if (total <= this.maxBytes) break;
      this.files.delete(uri);
      total -= file.size;
      evicted.push(filePath);
    }
    for (const filePath of evicted) {
      await rm(filePath, { force: true }).catch((error) => {
        console.error("Failed to remove an export over the session's space limit:", error);
      });
    }
  }

  /** Forgets exports past their lifetime and deletes their files. */
  private dropExpired(): void {
    const now = this.now();
    for (const [uri, { filePath, modifiedMs }] of this.files) {
      if (!isExpired(modifiedMs, this.maxAgeMs, now)) continue;
      this.files.delete(uri);
      rm(filePath, { force: true }).catch((error) => {
        console.error("Failed to remove an expired export:", error);
      });
    }
  }

  list(): ExportFile[] {
    this.dropExpired();
    return [...this.files.values()].map((entry) => entry.file);
  }

  async read(uri: string): Promise<string> {
    this.dropExpired();
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

export interface ExportSweepOptions {
  /** Directory holding the process directories. Defaults to the system temp directory. */
  dir?: string;
  /** Defaults to PLEX_EXPORT_MAX_AGE_SECONDS. */
  maxAgeMs?: number;
  now?: () => number;
}

/**
 * Deletes export files past their lifetime from every export directory of this user,
 * this process's and those left by others, killed ones included, then the directories
 * that are old and left empty. rmdir removes only an empty directory, so a file another
 * server is writing at that moment is never lost.
 */
export async function sweepExpiredExports(options: ExportSweepOptions = {}): Promise<void> {
  const dir = options.dir ?? tmpdir();
  const maxAgeMs = options.maxAgeMs ?? exportMaxAgeMs();
  const now = (options.now ?? Date.now)();
  for (const name of await readdir(dir)) {
    if (name.startsWith(PROCESS_ROOT_PREFIX)) {
      await sweepDir(path.join(dir, name), maxAgeMs, now);
    }
  }
}

/** Files first, so the directory can then be found empty. Links are never followed. */
async function sweepDir(dir: string, maxAgeMs: number, now: number): Promise<void> {
  // Read before anything inside is deleted, which would make the directory look new.
  const info = await lstat(dir).catch(ignoreGone);
  if (!info?.isDirectory() || !isOurs(info)) return;

  for (const name of (await readdir(dir).catch(ignoreGone)) ?? []) {
    const entry = path.join(dir, name);
    const entryInfo = await lstat(entry).catch(ignoreGone);
    if (!entryInfo || !isOurs(entryInfo)) continue;
    if (entryInfo.isDirectory()) {
      await sweepDir(entry, maxAgeMs, now);
    } else if (entryInfo.isFile() && isExpired(entryInfo.mtimeMs, maxAgeMs, now)) {
      await rm(entry, { force: true });
    }
  }

  if (isExpired(info.mtimeMs, maxAgeMs, now)) {
    await rmdir(dir).catch((error: NodeJS.ErrnoException) => {
      // Still in use, or already removed by someone else.
      if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") ignoreGone(error);
    });
  }
}

/** For entries another process may remove at any moment: gone is fine, anything else is not. */
function ignoreGone(error: NodeJS.ErrnoException): undefined {
  if (error.code === "ENOENT") return undefined;
  throw error;
}

let sweeper: ReturnType<typeof setInterval> | undefined;

/**
 * Runs sweepExpiredExports() now, then every hour, or every lifetime when that is
 * shorter. Repeated calls do nothing while it runs.
 */
export function startExportSweeper(): void {
  if (sweeper) return;
  const maxAgeMs = exportMaxAgeMs();
  const run = () => {
    sweepExpiredExports({ maxAgeMs }).catch((error) => {
      console.error("Failed to remove expired exports:", error);
    });
  };
  run();
  sweeper = setInterval(run, Math.min(maxAgeMs, SWEEP_INTERVAL_MS));
  // Do not hold the event loop open on this timer.
  sweeper.unref?.();
}

export function stopExportSweeper(): void {
  if (!sweeper) return;
  clearInterval(sweeper);
  sweeper = undefined;
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
