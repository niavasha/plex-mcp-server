import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as FsPromises from "node:fs/promises";
import path from "node:path";

// Checks in ExportStore that only matter when the filesystem misbehaves or someone else
// touches the temp directory at the wrong moment. The real filesystem will not do that on
// request, so node:fs/promises is wrapped: each function is the real one unless a test
// swaps it for one call.
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    mkdtemp: vi.fn(actual.mkdtemp),
    lstat: vi.fn(actual.lstat),
    stat: vi.fn(actual.stat),
    writeFile: vi.fn(actual.writeFile),
  };
});

const fs = await import("node:fs/promises");
const real = await vi.importActual<typeof FsPromises>("node:fs/promises");
const { tmpdir } = await import("node:os");
const { ExportStore } = await import("../plex/export-store.js");

const enoent = () => Object.assign(new Error("ENOENT: no such file or directory, mkdtemp"), { code: "ENOENT" });

describe.skipIf(process.platform === "win32")("ExportStore when the temp directory is interfered with", () => {
  let parent: string;
  let root: string;

  beforeEach(async () => {
    parent = await real.mkdtemp(path.join(tmpdir(), "export-store-hardening-"));
    root = path.join(parent, "root");
    await real.mkdir(root, { mode: 0o700 });
  });

  afterEach(async () => {
    vi.mocked(fs.mkdtemp).mockImplementation(real.mkdtemp);
    vi.mocked(fs.lstat).mockImplementation(real.lstat);
    vi.mocked(fs.stat).mockImplementation(real.stat);
    vi.mocked(fs.writeFile).mockImplementation(real.writeFile);
    await real.rm(parent, { recursive: true, force: true });
  });

  it("works normally through the wrapped filesystem (control)", async () => {
    const store = new ExportStore({ root });

    const filePath = await store.reserve("a.json");
    await real.writeFile(filePath, "[]");

    await expect(store.publish("a.json")).resolves.toMatchObject({ name: "a.json", size: 2 });
    await store.dispose();
    expect(await real.readdir(root)).toEqual([]);
  });

  // The root vanished, and by the time it is recreated somebody else has put a directory
  // there. mkdir succeeds on a directory that already exists, whoever made it.
  it("refuses a root that reappeared as a directory open to others", async () => {
    vi.mocked(fs.mkdtemp).mockImplementationOnce(async () => {
      await real.chmod(root, 0o777);
      throw enoent();
    });

    await expect(new ExportStore({ root }).reserve("a.json")).rejects.toThrow(/not private/);

    expect(await real.readdir(root)).toEqual([]);
  });

  it("recreates a root that really is missing (control for the test above)", async () => {
    await real.rm(root, { recursive: true });

    const filePath = await new ExportStore({ root }).reserve("a.json");

    expect(((await real.stat(root)).mode & 0o777).toString(8)).toBe("700");
    expect(path.dirname(path.dirname(filePath))).toBe(root);
  });

  // A filesystem that reports no owners or modes fails the privacy check for every new
  // directory. Without a clear stop, each export would abandon one directory and try again.
  it("says so, and leaves nothing behind, if a new directory does not come out private", async () => {
    vi.mocked(fs.lstat).mockImplementation(async (target, ...rest) => {
      const info = await real.lstat(target as string, ...(rest as []));
      if (path.basename(String(target)).startsWith("session-")) {
        return Object.assign(Object.create(Object.getPrototypeOf(info)), info, { mode: (info.mode & ~0o777) | 0o777 });
      }
      return info;
    });
    const store = new ExportStore({ root });

    await expect(store.reserve("a.json")).rejects.toThrow(/Could not create an export directory that is private/);
    await expect(store.reserve("a.json")).rejects.toThrow(/Could not create an export directory that is private/);

    expect(await real.readdir(root)).toEqual([]);
  });

  // Same modes, different owner: the directory was swapped for somebody else's.
  it("moves away from a session directory that now belongs to another user, without touching it", async () => {
    const store = new ExportStore({ root });
    const first = path.dirname(await store.reserve("a.json"));
    vi.mocked(fs.lstat).mockImplementation(async (target, ...rest) => {
      const info = await real.lstat(target as string, ...(rest as []));
      if (String(target) === first) {
        return Object.assign(Object.create(Object.getPrototypeOf(info)), info, { uid: info.uid + 1 });
      }
      return info;
    });

    const second = path.dirname(await store.reserve("a.json"));

    expect(second).not.toBe(first);
    // Not ours any more, so not ours to delete.
    expect((await real.readdir(root)).sort()).toEqual([path.basename(first), path.basename(second)].sort());
    await store.dispose();
  });

  // publish() checks the directory, then measures the file. If the directory is replaced
  // in between, the file must not be listed: read() would serve it from a directory the
  // store has given up.
  it("does not publish a file whose directory was replaced while it was being measured", async () => {
    const store = new ExportStore({ root });
    const filePath = await store.reserve("a.json");
    await real.writeFile(filePath, "[]");
    vi.mocked(fs.stat).mockImplementationOnce(async (target, ...rest) => {
      const info = await real.stat(target as string, ...(rest as []));
      await real.chmod(path.dirname(filePath), 0o755);
      await store.reserve("b.json");
      return info;
    });

    await expect(store.publish("a.json")).rejects.toThrow(/replaced while the export ran/);

    expect(store.list()).toEqual([]);
    await store.dispose();
  });

  // reserve() found the session directory in place, then another server's sweeper removed
  // it, old and empty, before reserve() created the export's file in it.
  it("creates the session directory again when it disappears before the export's file is created", async () => {
    const store = new ExportStore({ root });
    const first = path.dirname(await store.reserve("a.json"));
    vi.mocked(fs.writeFile).mockImplementationOnce(async (file, ...rest) => {
      await real.rm(path.dirname(file as string), { recursive: true });
      return real.writeFile(file as string, ...(rest as [string]));
    });

    const second = await store.reserve("b.json");

    expect(path.dirname(second)).not.toBe(first);
    expect(await real.readdir(path.dirname(second))).toEqual(["b.json"]);
    await store.dispose();
  });
});
