import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SERVER_VERSION } from "../shared/version.js";

describe("server version", () => {
  it("reports the version published in package.json", () => {
    const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const { version } = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    expect(SERVER_VERSION).toBe(version);
  });
});
