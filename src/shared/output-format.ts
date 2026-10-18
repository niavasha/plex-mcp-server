/**
 * Optional TOON encoding for tool responses.
 *
 * Every tool answers with a JSON document in an MCP text block. Those
 * documents are overwhelmingly "some metadata plus an array of uniform
 * records" — `search_media` returns `results`, `get_library_items` returns
 * `items`, `sonarr_get_queue` returns `queue`. JSON repeats every field name
 * on every record, which is pure overhead once an array gets long.
 *
 * TOON (Token-Oriented Object Notation) encodes such an array once as a
 * header and then as delimited rows:
 *
 *   items[3]{ratingKey,title,year}:
 *     1001,Arrival,2016
 *     1002,Sicario,2015
 *     1003,Dune,2021
 *
 * which is the same data in fewer characters, and usually in fewer tokens of
 * the model's context (characters are a proxy; nothing here counts tokens).
 *
 * ## This is opt-in
 *
 * `PLEX_OUTPUT_FORMAT` is unset for existing installs, so they keep getting
 * exactly the JSON they get today, byte for byte. Only `PLEX_OUTPUT_FORMAT=toon`
 * switches encoding, and it is read per call so tests can toggle it.
 *
 * ## The payload is normalized through JSON first
 *
 * `JSON.parse(JSON.stringify(value))` is not redundant: it collapses the value
 * to the JSON data model *before* TOON sees it. Without it the two formats
 * would disagree — `JSON.stringify` drops `undefined` properties while the TOON
 * encoder would emit them as `null`, and several tools deliberately set fields
 * to `undefined` to omit them (`summary: item.summary ? ... : undefined`).
 * Normalizing first guarantees the invariant worth having: decoding the TOON
 * output yields exactly the value the JSON output parses to. It also keeps the
 * failure modes identical — a value `JSON.stringify` rejects still throws here,
 * in the same place, with the same error.
 *
 * ## And TOON is only used when it actually wins
 *
 * The tabular form above needs every element of an array to carry the same
 * keys. Tools omit absent optional fields rather than sending nulls, so a
 * single record missing its `summary` or `overview` drops the whole array to
 * TOON's one-object-per-item list form — which, measured against minified
 * JSON, comes out *larger*. Emitting TOON only when it is shorter than minified
 * JSON costs one comparison and turns "usually shorter" into "never longer, in
 * characters". Characters are a proxy for tokens, not a measurement of them:
 * the guarantee is over `String.length`, and token counts depend on the
 * model's tokeniser.
 */

import { encode } from "@toon-format/toon";

export const OUTPUT_FORMAT_ENV_VAR = "PLEX_OUTPUT_FORMAT";

/** True when the operator asked for TOON-encoded tool responses. */
export function isToonOutputEnabled(): boolean {
  return process.env[OUTPUT_FORMAT_ENV_VAR]?.trim().toLowerCase() === "toon";
}

/**
 * Serialize a tool payload for the MCP text block.
 *
 * The size gate uses one baseline on every call path: TOON is emitted only
 * when it is strictly shorter, by `String.length` (UTF-16 code units, not
 * tokens), than the *minified* JSON of the same value. Comparing against the
 * JSON each module happens to emit would let TOON win on an indented path
 * merely by beating whitespace, so "TOON is shorter" would mean different
 * things in different modules. Minified JSON is the encoding-neutral,
 * strictest baseline, and since any indentation only adds characters, TOON is
 * then also shorter than whatever JSON the path would otherwise have returned.
 *
 * When TOON does not win, the result is the path's default JSON, byte for
 * byte, so falling back never changes what an operator without TOON sees.
 *
 * @param data   The payload the tool wants to return
 * @param indent Spaces of JSON indentation, matching `JSON.stringify`'s third
 *               argument. Shapes the JSON output only, not the size gate.
 * @returns TOON when it is shorter than minified JSON, otherwise the JSON
 */
export function formatToolPayload(data: unknown, indent?: number): string {
  const json = JSON.stringify(data, null, indent);
  if (!isToonOutputEnabled()) return json;

  const minified = indent ? JSON.stringify(data) : json;
  const toon = encode(JSON.parse(minified));
  return toon.length < minified.length ? toon : json;
}
