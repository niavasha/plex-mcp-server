/**
 * Arr (Sonarr/Radarr) Integration Module
 * Main exports for the *arr integration
 */

export { SonarrClient, RadarrClient } from "./client.js";
export { ArrMCPFunctions } from "./mcp-functions.js";
export { createArrToolRegistry } from "./tool-registry.js";
export {
  ARR_TOOL_SCHEMAS,
  SONARR_TOOL_SCHEMAS,
  RADARR_TOOL_SCHEMAS,
  ARR_CROSS_TOOL_SCHEMAS,
} from "./tool-schemas.js";
export * from "./types.js";
export * from "./constants.js";
