import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { decode } from "@toon-format/toon";
import { PlexTools } from "../plex/tools.js";
import { PlexClient } from "../plex/client.js";
import { createTraktToolRegistry } from "../trakt/tool-registry.js";
import { TraktMCPFunctions } from "../trakt/mcp-functions.js";
import { createArrToolRegistry } from "../arr/tool-registry.js";
import { ArrMCPFunctions } from "../arr/mcp-functions.js";
import {
  OUTPUT_FORMAT_ENV_VAR,
  isToonOutputEnabled,
  formatToolPayload,
} from "../shared/output-format.js";

/**
 * The contract these tests defend is narrow and worth stating plainly:
 *
 *   1. With PLEX_OUTPUT_FORMAT unset, output is byte-for-byte what it has
 *      always been. Existing installs cannot notice this feature exists.
 *   2. With PLEX_OUTPUT_FORMAT=toon, output is TOON that decodes back to
 *      exactly the value the JSON path would have produced — same keys, same
 *      types, same omissions.
 */

const originalFormat = process.env[OUTPUT_FORMAT_ENV_VAR];

function useToon() {
  process.env[OUTPUT_FORMAT_ENV_VAR] = "toon";
}

afterEach(() => {
  if (originalFormat === undefined) delete process.env[OUTPUT_FORMAT_ENV_VAR];
  else process.env[OUTPUT_FORMAT_ENV_VAR] = originalFormat;
});

beforeEach(() => {
  delete process.env[OUTPUT_FORMAT_ENV_VAR];
});

describe("isToonOutputEnabled", () => {
  it("is off when the variable is unset", () => {
    expect(isToonOutputEnabled()).toBe(false);
  });

  it("is off for any value other than toon", () => {
    for (const value of ["", "json", "yaml", "true", "TOONISH"]) {
      process.env[OUTPUT_FORMAT_ENV_VAR] = value;
      expect(isToonOutputEnabled()).toBe(false);
    }
  });

  it("accepts toon regardless of case or surrounding whitespace", () => {
    for (const value of ["toon", "TOON", "Toon", " toon "]) {
      process.env[OUTPUT_FORMAT_ENV_VAR] = value;
      expect(isToonOutputEnabled()).toBe(true);
    }
  });
});

describe("formatToolPayload", () => {
  const payload = { items: [{ id: 1, title: "A" }, { id: 2, title: "B" }] };

  it("emits unchanged JSON by default", () => {
    expect(formatToolPayload(payload)).toBe(JSON.stringify(payload));
    expect(formatToolPayload(payload, 2)).toBe(JSON.stringify(payload, null, 2));
  });

  it("emits a tabular TOON array when enabled", () => {
    useToon();
    expect(formatToolPayload(payload)).toBe("items[2]{id,title}:\n  1,A\n  2,B");
  });

  it("never returns more text than plain JSON would have", () => {
    useToon();
    for (const indent of [undefined, 2]) {
      expect(formatToolPayload(payload, indent).length).toBeLessThanOrEqual(
        JSON.stringify(payload, null, indent).length
      );
    }
  });

  it("keeps the JSON when TOON would be longer", () => {
    // Elements with differing keys cannot use TOON's tabular form, and its
    // list form is the longer encoding here.
    const ragged = { items: [{ a: 1 }, { a: 1, b: 2 }] };
    useToon();
    expect(formatToolPayload(ragged)).toBe(JSON.stringify(ragged));
  });

  it("drops undefined properties exactly as JSON.stringify does", () => {
    // Several tools omit optional fields by assigning undefined. Encoding the
    // raw value would turn those into nulls; normalizing through JSON first
    // keeps both formats reporting the same key set.
    const withHoles = { a: 1, summary: undefined, items: [{ id: 1, summary: undefined }] };
    useToon();
    expect(decode(formatToolPayload(withHoles))).toEqual(JSON.parse(JSON.stringify(withHoles)));
    expect(formatToolPayload(withHoles)).not.toContain("summary");
  });

  it("still throws on values JSON cannot represent", () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    useToon();
    expect(() => formatToolPayload(circular)).toThrow(TypeError);
  });
});

/** Create a mock PlexClient without hitting any real server */
function createMockClient() {
  return {
    makeRequest: vi.fn(),
    makeDiscoverRequest: vi.fn(),
    getPlexTypeId: vi.fn(() => 1),
  } as unknown as PlexClient;
}

const SEARCH_FIXTURE = {
  MediaContainer: {
    Metadata: [
      { ratingKey: "1", title: "First", type: "movie", year: 2001, summary: "One", rating: 7.5 },
      { ratingKey: "2", title: "Second", type: "movie", year: 2002, summary: "Two", rating: 8 },
    ],
  },
};

/** Same tool, but the second result has no summary — a common real response. */
const RAGGED_FIXTURE = {
  MediaContainer: {
    Metadata: [
      { ratingKey: "1", title: "First", type: "movie", year: 2001, summary: "One", rating: 7.5 },
      { ratingKey: "2", title: "Second", type: "movie", year: 2002, rating: 8 },
    ],
  },
};

describe("Plex tool responses", () => {
  let client: ReturnType<typeof createMockClient>;
  let tools: PlexTools;

  beforeEach(() => {
    client = createMockClient();
    tools = new PlexTools(client as unknown as PlexClient);
    (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue(SEARCH_FIXTURE);
  });

  it("returns pretty-printed JSON by default", async () => {
    const text = (await tools.searchMedia("q")).content[0].text;
    expect(text.startsWith("{\n")).toBe(true);
    expect(JSON.parse(text).results).toHaveLength(2);
  });

  it("returns TOON that decodes to the same value when enabled", async () => {
    const json = (await tools.searchMedia("q")).content[0].text;
    useToon();
    const toon = (await tools.searchMedia("q")).content[0].text;

    expect(toon).not.toBe(json);
    expect(decode(toon)).toEqual(JSON.parse(json));
  });

  it("uses the tabular form when every result carries the same fields", async () => {
    useToon();
    const toon = (await tools.searchMedia("q")).content[0].text;
    expect(toon).toContain("results[2]{ratingKey,title,type,year,summary,rating}:");
  });

  it("does not grow the response when results have differing fields", async () => {
    // Tools omit optional fields rather than sending nulls, so an array is
    // only tabular when every element happens to have the same ones. In the
    // ragged case TOON's list form can be the longer encoding, and then the
    // JSON is kept instead.
    (client.makeRequest as ReturnType<typeof vi.fn>).mockResolvedValue(RAGGED_FIXTURE);
    const json = (await tools.searchMedia("q")).content[0].text;
    useToon();
    const toon = (await tools.searchMedia("q")).content[0].text;

    expect(toon.length).toBeLessThanOrEqual(json.length);
    expect(decode(toon)).toEqual(JSON.parse(json));
  });
});

describe("Trakt tool responses", () => {
  const traktFunctions = {
    traktGetAuthStatus: async () => ({ authenticated: true, user: "someone" }),
  } as unknown as TraktMCPFunctions;

  it("returns compact JSON by default", async () => {
    const registry = createTraktToolRegistry(traktFunctions);
    const text = (await registry.handle("trakt_get_auth_status")).content[0].text;
    expect(text).toBe('{"authenticated":true,"user":"someone"}');
  });

  it("returns equivalent TOON when enabled", async () => {
    useToon();
    const registry = createTraktToolRegistry(traktFunctions);
    const text = (await registry.handle("trakt_get_auth_status")).content[0].text;
    expect(decode(text)).toEqual({ authenticated: true, user: "someone" });
  });
});

describe("Sonarr/Radarr tool responses", () => {
  const queue = {
    queue: [
      { id: 1, title: "Ep 1", status: "downloading", progress: 42 },
      { id: 2, title: "Ep 2", status: "queued", progress: 0 },
    ],
  };
  const arrFunctions = { sonarrGetQueue: async () => queue } as unknown as ArrMCPFunctions;

  it("returns compact JSON by default", async () => {
    const registry = createArrToolRegistry(arrFunctions);
    const text = (await registry.handle("sonarr_get_queue")).content[0].text;
    expect(text).toBe(JSON.stringify(queue));
  });

  it("returns equivalent TOON when enabled", async () => {
    useToon();
    const registry = createArrToolRegistry(arrFunctions);
    const text = (await registry.handle("sonarr_get_queue")).content[0].text;
    expect(text).toContain("queue[2]{id,title,status,progress}:");
    expect(decode(text)).toEqual(queue);
  });
});
