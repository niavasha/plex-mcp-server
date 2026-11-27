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
 * An export older than PLEX_EXPORT_MAX_AGE_SECONDS is no longer listed or served. The
 * store deletes its file the next time the session lists, reads or publishes exports,
 * and startExportSweeper() deletes the rest within an hour, including those a killed
 * process left. Stdio exports under ./exports are not swept.
 */

import { randomInt } from "node:crypto";
import { rmSync } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
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
const SUFFIX_LENGTH = 6;

function randomChars(length: number): string {
  let chars = "";
  for (let i = 0; i < length; i++) {
    chars += NAME_ALPHABET[randomInt(NAME_ALPHABET.length)];
  }
  return chars;
}

/**
 * A new export file name: 32 random letters and digits, then ".json". Concurrent
 * exports of one library used to get the same name from the same millisecond.
 */
export function randomExportName(): string {
  return `${randomChars(NAME_LENGTH)}.json`;
}

/**
 * A stdio export's name, which the user finds in ./exports: the library and the time,
 * then a short random suffix so exports in the same millisecond do not collide.
 */
export function libraryExportName(libraryKey: string, now: number = Date.now()): string {
  return `library_${libraryKey}_${now}_${randomChars(SUFFIX_LENGTH)}.json`;
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
 * Every root this process created. A replaced root can still hold the directories of
 * sessions that started before, so all of them are removed at exit, not just the current one.
 */
const createdRoots = new Set<string>();
let exitHandlerRegistered = false;

/** Exit handlers cannot await, hence the synchronous removal. */
function removeCreatedRoots(): void {
  for (const dir of createdRoots) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Nothing useful can be done this late.
    }
  }
}

/**
 * Session directories of this process's open stores. This process's sweeper never
 * removes them, even when they are old and empty. Another server's sweeper can, which
 * reserve() handles by creating the directory again.
 */
const liveSessionDirs = new Set<string>();

/**
 * The directory every session's exports live under, created on first use and removed
 * when the process exits. One exit handler serves every root, so replacing the root
 * does not add listeners.
 */
function getProcessRoot(): Promise<string> {
  processRoot ??= mkdtemp(path.join(tmpdir(), PROCESS_ROOT_PREFIX)).then(
    (dir) => {
      createdRoots.add(dir);
      if (!exitHandlerRegistered) {
        exitHandlerRegistered = true;
        process.once("exit", removeCreatedRoots);
      }
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

/**
 * Why an export was refused for being larger than a session may keep. The client can
 * change that, so it is not reported as a server fault.
 */
export function exportTooLargeError(maxBytes: number): McpError {
  return new McpError(
    ErrorCode.InvalidRequest,
    `Failed to export library: The export is larger than the ${maxBytes} bytes a session may keep (set ${EXPORT_MAX_BYTES_ENV_VAR} to change it)`
  );
}

export class ExportStore {
  private dirPromise?: Promise<string>;
  private disposed = false;
  private readonly files = new Map<string, { file: ExportFile; filePath: string; modifiedMs: number }>();
  private readonly now: () => number;
  /** Settles when the session's running export does. Never rejects. */
  private exportQueue: Promise<unknown> = Promise.resolve();

  /** Called whenever the session's list of exports changed. */
  onListChanged?: () => void;

  /** Bytes the session's exports may take together. Publishing removes the oldest to stay within it. */
  readonly maxBytes: number;
  /** How long an export is kept after it was written. */
  readonly maxAgeMs: number;

  constructor(private readonly options: ExportStoreOptions = {}) {
    this.maxBytes = options.maxBytes ?? positiveIntFromEnv(EXPORT_MAX_BYTES_ENV_VAR, DEFAULT_EXPORT_MAX_BYTES);
    this.maxAgeMs = options.maxAgeMs ?? exportMaxAgeMs();
    this.now = options.now ?? Date.now;
  }

  /**
   * Runs `task` once the session's earlier exports have finished, successfully or not.
   * One export at a time keeps a session's disk use within twice maxBytes: its published
   * exports plus the one being written.
   */
  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    const result = this.exportQueue.then(() => task());
    this.exportQueue = result.catch(() => undefined);
    return result;
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new Error("The export store is closed: its session has ended");
    }
  }

  /**
   * Creates an empty file to write an export to and returns its path. Not readable by
   * clients until publish(). The file keeps the directory from looking empty to another
   * server's sweeper, which removes only empty directories. That sweeper may still
   * remove the directory before the file is created, so a missing directory is created
   * again, once.
   */
  async reserve(name: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      const dir = await this.usableDir();
      const filePath = path.join(dir, name);
      try {
        // "a" creates the file without truncating one that is already there.
        await writeFile(filePath, "", { flag: "a" });
        return filePath;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT" || attempt > 1) throw error;
        await this.sessionDir(dir);
      }
    }
  }

  /** The session's directory, replaced by a new one if it was removed or tampered with. */
  private async usableDir(): Promise<string> {
    this.assertOpen();
    let dir = await this.sessionDir();
    if (!(await isPrivateDir(dir))) {
      // Something outside the server removed or replaced a live session's directory.
      // Its files went with it. Start a new one instead of reusing the path.
      dir = await this.sessionDir(dir);
    }
    if (this.disposed) {
      // The session closed meanwhile, and dispose() may have run before the directory existed.
      liveSessionDirs.delete(dir);
      await rm(dir, { recursive: true, force: true });
      this.assertOpen();
    }
    return dir;
  }

  /** The session's directory, created on first use. `lost` names one to stop using. */
  private async sessionDir(lost?: string): Promise<string> {
    if (lost !== undefined && this.dirPromise && (await this.dirPromise.catch(() => undefined)) === lost) {
      this.dirPromise = undefined;
      // The directory's files went with it.
      if (this.files.size > 0) {
        this.files.clear();
        this.onListChanged?.();
      }
      liveSessionDirs.delete(lost);
      await removeIfOurs(lost);
    }
    // Cache the promise, not the result, so concurrent exports share one directory.
    const dirPromise = (this.dirPromise ??= (
      this.options.root !== undefined ? Promise.resolve(this.options.root) : usableProcessRoot()
    )
      .then(createSessionDir)
      .then((dir) => {
        liveSessionDirs.add(dir);
        return dir;
      }));
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
    const filePath = path.join(await this.usableDir(), name);
    const info = await stat(filePath);
    const file: ExportFile = {
      uri: `${EXPORT_URI_PREFIX}${name}`,
      name,
      mimeType: EXPORT_MIME_TYPE,
      size: info.size,
    };
    if (file.size > this.maxBytes) {
      throw exportTooLargeError(this.maxBytes);
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
    // Clients that keep the list, and links from earlier exports this one evicted, need to know.
    this.onListChanged?.();
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

  /** Forgets exports past their lifetime and deletes their files. True if it dropped any. */
  private dropExpired(): boolean {
    const now = this.now();
    let dropped = false;
    for (const [uri, { filePath, modifiedMs }] of this.files) {
      if (!isExpired(modifiedMs, this.maxAgeMs, now)) continue;
      this.files.delete(uri);
      dropped = true;
      rm(filePath, { force: true }).catch((error) => {
        console.error("Failed to remove an expired export:", error);
      });
    }
    return dropped;
  }

  /** dropExpired(), telling the client when its list changed. publish() tells it once itself. */
  private dropExpiredAndNotify(): void {
    if (this.dropExpired()) this.onListChanged?.();
  }

  list(): ExportFile[] {
    this.dropExpiredAndNotify();
    return [...this.files.values()].map((entry) => entry.file);
  }

  async read(uri: string): Promise<string> {
    this.dropExpiredAndNotify();
    const entry = this.files.get(uri);
    if (!entry) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    }
    try {
      return await readFile(entry.filePath, "utf8");
    } catch (error) {
      // The error's message holds the server's path, which the client must not see.
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // Deleted from outside the store.
        this.files.delete(uri);
        this.onListChanged?.();
        throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
      console.error(`Failed to read export ${uri}:`, error);
      throw new McpError(ErrorCode.InternalError, `Failed to read resource: ${uri}`);
    }
  }

  /** Removes the session's files. Afterwards reserve() and publish() throw. Safe to repeat. */
  async dispose(): Promise<void> {
    this.disposed = true;
    const dirPromise = this.dirPromise;
    this.dirPromise = undefined;
    this.files.clear();
    if (dirPromise) {
      const dir = await dirPromise;
      liveSessionDirs.delete(dir);
      await rm(dir, { recursive: true, force: true });
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
 * that are old and left empty, except this process's live session directories. rmdir
 * removes only an empty directory, and reserve() creates an export's file before the
 * export writes it, so a file another server is writing at that moment is never lost.
 * An entry that cannot be removed is logged and skipped, so it does not keep
 * the rest from being swept.
 */
export async function sweepExpiredExports(options: ExportSweepOptions = {}): Promise<void> {
  const dir = options.dir ?? tmpdir();
  const maxAgeMs = options.maxAgeMs ?? exportMaxAgeMs();
  const now = (options.now ?? Date.now)();
  for (const name of await readdir(dir)) {
    if (name.startsWith(PROCESS_ROOT_PREFIX)) {
      await sweepEntry(path.join(dir, name), maxAgeMs, now);
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
      await sweepEntry(entry, maxAgeMs, now);
    } else if (entryInfo.isFile() && isExpired(entryInfo.mtimeMs, maxAgeMs, now)) {
      await rm(entry, { force: true }).catch((error) => {
        console.error(`Failed to remove expired export ${entry}:`, error);
      });
    }
  }

  if (isExpired(info.mtimeMs, maxAgeMs, now) && !liveSessionDirs.has(dir)) {
    await rmdir(dir).catch((error: NodeJS.ErrnoException) => {
      // Still in use, or already removed by someone else.
      if (error.code !== "ENOTEMPTY" && error.code !== "EEXIST") ignoreGone(error);
    });
  }
}

/** Sweeps one directory, logging a failure instead of passing it on to the rest of the sweep. */
async function sweepEntry(dir: string, maxAgeMs: number, now: number): Promise<void> {
  try {
    await sweepDir(dir, maxAgeMs, now);
  } catch (error) {
    console.error(`Failed to remove expired exports in ${dir}:`, error);
  }
}

/** For entries another process may remove at any moment: gone is fine, anything else is not. */
function ignoreGone(error: NodeJS.ErrnoException): undefined {
  if (error.code === "ENOENT") return undefined;
  throw error;
}

/** The running sweeper. Each start gets its own, so a sweep still in flight after a stop cannot schedule another. */
interface Sweeper {
  timer?: ReturnType<typeof setTimeout>;
  stopped: boolean;
}

let sweeper: Sweeper | undefined;

/**
 * Runs sweepExpiredExports() now, then an hour after each sweep finishes, or a lifetime
 * after when that is shorter. Waiting for the sweep keeps a slow one from overlapping the
 * next. Repeated calls do nothing while it runs.
 */
export function startExportSweeper(): void {
  if (sweeper) return;
  const state: Sweeper = { stopped: false };
  sweeper = state;
  const maxAgeMs = exportMaxAgeMs();
  const intervalMs = Math.min(maxAgeMs, SWEEP_INTERVAL_MS);
  const run = () => {
    state.timer = undefined;
    sweepExpiredExports({ maxAgeMs })
      .catch((error) => {
        console.error("Failed to remove expired exports:", error);
      })
      .finally(() => {
        if (state.stopped) return;
        state.timer = setTimeout(run, intervalMs);
        // Do not hold the event loop open on this timer.
        state.timer.unref?.();
      });
  };
  run();
}

export function stopExportSweeper(): void {
  if (!sweeper) return;
  sweeper.stopped = true;
  clearTimeout(sweeper.timer);
  sweeper = undefined;
}

/** Serves the store's exports as MCP resources and removes them when the session closes. */
export function registerExportResources(server: Server, store: ExportStore): void {
  // Capabilities must be declared before the transport connects.
  server.registerCapabilities({ resources: { listChanged: true } });

  store.onListChanged = () => {
    server.sendResourceListChanged().catch((error) => {
      console.error("Failed to notify the client that its exports changed:", error);
    });
  };

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
