/**
 * The tools advertised by tools/list.
 *
 * Write tools are only listed when PLEX_ENABLE_MUTATIVE_OPS=true. Calling one
 * while disabled is still refused by the Plex registry; this keeps clients
 * from being offered tools that can only fail.
 */

import { PLEX_TOOL_SCHEMAS, PLEX_MUTATIVE_TOOL_SCHEMAS } from "../plex/tool-schemas.js";
import { isMutativeOpsEnabled } from "../plex/constants.js";
import { TRAKT_TOOL_SCHEMAS } from "../trakt/tool-schemas.js";
import { ARR_TOOL_SCHEMAS } from "../arr/tool-schemas.js";
import { withAnnotations } from "./tool-annotations.js";

export function listedToolSchemas() {
  return withAnnotations([
    ...PLEX_TOOL_SCHEMAS,
    ...(isMutativeOpsEnabled() ? PLEX_MUTATIVE_TOOL_SCHEMAS : []),
    ...TRAKT_TOOL_SCHEMAS,
    ...ARR_TOOL_SCHEMAS,
  ]);
}
