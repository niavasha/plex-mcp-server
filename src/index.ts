#!/usr/bin/env node

// DEPRECATED: Use plex-mcp-server instead (unified server with all tools).
// This shim exists for backward compatibility and will be removed in v2.0.0.

console.warn(
  "[plex-mcp-server] The standalone Plex binary is deprecated. " +
  "Use 'plex-mcp-server' instead — it includes all Plex, Trakt, and Sonarr/Radarr tools. " +
  "See https://github.com/niavasha/plex-mcp-server#migration for details."
);

import { main } from "./plex-mcp-server.js";

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
