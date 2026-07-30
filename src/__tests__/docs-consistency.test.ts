import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PLEX_TOOL_SCHEMAS, PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";
import { TRAKT_TOOL_SCHEMAS } from "../trakt/tool-schemas.js";
import { ARR_TOOL_SCHEMAS } from "../arr/tool-schemas.js";

/**
 * The README's tool counts have gone stale twice — once when a tool was added
 * without updating the "Features" header, and again when only one of the two
 * places stating the count was corrected. These assertions make the README a
 * build-time obligation rather than something to remember.
 */
describe("README tool counts stay in sync with the schemas", () => {
  const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8");

  const plexCount = PLEX_TOOL_SCHEMAS.length;
  const baseCount = plexCount + TRAKT_TOOL_SCHEMAS.length + ARR_TOOL_SCHEMAS.length;
  const totalCount = baseCount + PLEX_MUTATIVE_TOOL_SCHEMAS.length;

  it("states the Plex tool count correctly", () => {
    expect(readme).toContain(`### Plex Tools (${plexCount} tools)`);
  });

  it("states the base and total counts in the Features section", () => {
    expect(readme).toContain(
      `**${baseCount} tools** out of the box (${totalCount} with write operations enabled)`
    );
  });

  it("states the base and total counts above the tool tables", () => {
    expect(readme).toContain(
      `${baseCount} tools out of the box (${totalCount} with write operations enabled)`
    );
  });

  it("never states a stale count anywhere", () => {
    // Any "N tools out of the box" must be the real number.
    const claims = [...readme.matchAll(/(\d+) tools\*{0,2} out of the box/g)].map((m) =>
      Number(m[1])
    );
    expect(claims.length).toBeGreaterThan(0);
    for (const claimed of claims) expect(claimed).toBe(baseCount);
  });

  it("documents every registered tool name in the README", () => {
    const names = [
      ...PLEX_TOOL_SCHEMAS,
      ...PLEX_MUTATIVE_TOOL_SCHEMAS,
      ...TRAKT_TOOL_SCHEMAS,
      ...ARR_TOOL_SCHEMAS,
    ].map((s) => s.name);

    const undocumented = names.filter((n) => !readme.includes(`\`${n}\``));
    expect(undocumented).toEqual([]);
  });
});
