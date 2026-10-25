import { afterEach, describe, expect, it } from "vitest";
import { listedToolSchemas } from "../shared/tool-list.js";
import { PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";
import { PLEX_MUTATIVE_OPS_ENV_VAR } from "../plex/constants.js";

// README and package.json promise 54 tools out of the box and 66 with write
// operations enabled. tools/list is what clients see, so it must agree.
const WRITE_TOOLS = PLEX_MUTATIVE_TOOL_SCHEMAS.map((s) => s.name);
const saved = process.env[PLEX_MUTATIVE_OPS_ENV_VAR];

afterEach(() => {
  if (saved === undefined) delete process.env[PLEX_MUTATIVE_OPS_ENV_VAR];
  else process.env[PLEX_MUTATIVE_OPS_ENV_VAR] = saved;
});

const names = () => listedToolSchemas().map((s) => s.name);

describe("tools/list", () => {
  it.each([undefined, "false", "1", "TRUE"])("hides write tools when the setting is %j", (value) => {
    if (value === undefined) delete process.env[PLEX_MUTATIVE_OPS_ENV_VAR];
    else process.env[PLEX_MUTATIVE_OPS_ENV_VAR] = value;

    expect(names()).toHaveLength(54);
    for (const tool of WRITE_TOOLS) expect(names()).not.toContain(tool);
  });

  it("lists write tools when write operations are enabled", () => {
    process.env[PLEX_MUTATIVE_OPS_ENV_VAR] = "true";

    expect(names()).toHaveLength(66);
    for (const tool of WRITE_TOOLS) expect(names()).toContain(tool);
  });

  it("annotates every listed tool", () => {
    process.env[PLEX_MUTATIVE_OPS_ENV_VAR] = "true";

    for (const schema of listedToolSchemas()) expect(schema.annotations).toBeDefined();
  });
});
