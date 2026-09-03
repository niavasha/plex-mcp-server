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
 * which is the same data in noticeably fewer characters — and so in fewer
 * tokens of the model's context.
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
 * JSON, comes out *larger*. Emitting whichever encoding is shorter costs one
 * comparison and turns "usually cheaper" into "never more expensive", which is
 * the only version of this worth switching on by default in your own config.
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
 * @param data   The payload the tool wants to return
 * @param indent Spaces of JSON indentation, matching `JSON.stringify`'s third
 *               argument, and the baseline TOON has to beat to be used.
 * @returns TOON when it is shorter than that JSON, otherwise the JSON itself
 */
export function formatToolPayload(data: unknown, indent?: number): string {
  const json = JSON.stringify(data, null, indent);
  if (!isToonOutputEnabled()) return json;

  const toon = encode(JSON.parse(json));
  return toon.length < json.length ? toon : json;
}
