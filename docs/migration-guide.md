# Migration Guide: v1.0.x to v1.1.0

## What Changed

In v1.1.0, the three separate server entry points have been merged into a single unified server that exposes all tools from all integrations simultaneously.

| Old binary | New binary |
|---|---|
| `build/index.js` (Plex only) | `build/plex-mcp-server.js` |
| `build/plex-trakt-server.js` (Plex + Trakt) | `build/plex-mcp-server.js` |
| `build/plex-arr-server.js` (Plex + Arr) | `build/plex-mcp-server.js` |

## Migration Steps

1. **Update your MCP client configuration** to point to `build/plex-mcp-server.js`:

```json
{
  "mcpServers": {
    "plex": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/plex-mcp-server.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token_here",
        "SONARR_API_KEY": "optional",
        "RADARR_API_KEY": "optional",
        "TRAKT_CLIENT_ID": "optional",
        "TRAKT_CLIENT_SECRET": "optional"
      }
    }
  }
}
```

2. **Remove duplicate server entries.** If you had both `plex-arr` and `plex-trakt` configured, you now only need one `plex` entry.

3. **Add any previously-missing credentials.** The unified server registers all tools regardless of which credentials are set. Tools for unconfigured services return a clear error message explaining how to set them up — they don't crash the server.

## Backward Compatibility

The old binaries (`build/index.js`, `build/plex-trakt-server.js`, `build/plex-arr-server.js`) still exist and work. They emit a deprecation warning to stderr and then run the unified server.

They will be removed in v2.0.0.

## What You Gain

- **All 44 tools in one server** (53 with write operations enabled)
- **Extended analytics tools** (`get_fully_watched`, `get_watch_stats`, `get_user_stats`, `get_library_stats`, `get_popular_content`) are now available alongside Trakt and Arr tools — previously they were only in the standalone Plex server
- **Simpler configuration** — one server entry in your MCP client config instead of up to three
