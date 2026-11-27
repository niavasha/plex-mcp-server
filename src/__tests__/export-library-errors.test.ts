import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { WriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExportStore } from "../plex/export-store.js";
import { PlexTools } from "../plex/tools.js";
import type { PlexClient } from "../plex/client.js";

// The stream export_library writes to, so a request can fail at the moment the bug needs.
let exportStream: WriteStream;

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    createWriteStream: (...args: Parameters<typeof fs.createWriteStream>) =>
      (exportStream = fs.createWriteStream(...args)),
  };
});

// #246 item 8: a request that failed while the first write was still in flight was
// reported as "Cannot call write after a stream was destroyed", losing the real cause.
describe("export_library error reporting", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), "export-library-errors-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([
    ["over HTTP (export store)", true],
    ["over stdio", false],
  ])("reports the Plex error as the cause, %s", async (_label, withStore) => {
    const client = {
      getPlexTypeId: vi.fn(() => 1),
      // Fails once the file is open, while the opening "[" is being written.
      makeRequest: vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            exportStream.once("open", () => reject(new Error("connect ECONNREFUSED")));
          })
      ),
    };
    const store = withStore ? new ExportStore({ root }) : undefined;
    const tools = new PlexTools(client as unknown as PlexClient, { exportStore: store });

    try {
      await expect(tools.exportLibrary("1", "movie")).rejects.toThrow(
        "Failed to export library: connect ECONNREFUSED"
      );
    } finally {
      await store?.dispose();
    }
  });
});
