import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { encode, decode } from "@toon-format/toon";

/**
 * Smoke tests for the TOON dependency (issue #144). formatToolPayload trusts
 * decode(encode(x)) === x and never decodes at runtime; the pin keeps upgrades
 * deliberate rather than whatever a caret range lets in.
 */
const readJson = (p: string) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));

describe("@toon-format/toon", () => {
  it("is pinned to exactly the locked version", () => {
    const declared = readJson("package.json").dependencies["@toon-format/toon"];
    const locked = readJson("package-lock.json").packages["node_modules/@toon-format/toon"].version;
    expect(declared).toBe(locked);
  });

  const shapes: Record<string, unknown> = {
    tabular: {
      query: "dune", offset: 0,
      results: [
        { ratingKey: "1001", title: "Dune", year: 2021, summary: "Paul, a, b: c", rating: 8.1 },
        { ratingKey: "1002", title: "Dune: Part Two", year: 2024, summary: "one\ntwo", rating: 8.6 },
      ],
    },
    ragged: { queue: [{ id: 1, title: "Ep 1", progress: 42.5 }, { id: 2, title: "Ep 2" }] },
    nested: { sonarr: { connected: true, error: null }, radarr: { connected: false, tags: [], meta: {} } },
    strings: {
      items: [
        { title: "", note: "  padded  " },
        { title: "123", note: "true" },
        { title: "naïve café — 映画 🎬", note: "\"quoted\" \\ #[x]{y}" },
      ],
    },
    trakt: {
      results: [
        { type: "movie", score: 1000, movie: { title: "Dune", year: 2021, ids: { trakt: 1, slug: "dune-2021", imdb: "tt1160419", tmdb: 438631 } } },
        { type: "show", score: 900, show: { title: "Dune: Prophecy", ids: { trakt: 2, slug: "dune-prophecy", tvdb: 403245 } } },
      ],
    },
    numbers: { values: [0, -1, 1.5, 1e21, Number.MAX_SAFE_INTEGER, -0.000001] },
  };

  for (const [name, payload] of Object.entries(shapes)) {
    it(`round-trips a ${name} payload`, () => {
      const value = JSON.parse(JSON.stringify(payload));
      expect(decode(encode(value))).toEqual(value);
    });
  }
});
