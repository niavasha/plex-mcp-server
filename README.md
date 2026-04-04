# Plex MCP Server

A **Model Context Protocol (MCP)** server that provides AI assistants with comprehensive access to your Plex Media Server, Sonarr, Radarr, and Trakt.tv — all from a single unified server.

<a href="https://glama.ai/mcp/servers/@niavasha/plex-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@niavasha/plex-mcp-server/badge" alt="Plex Server MCP server" />
</a>

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## What is this?

This MCP server transforms your Plex Media Server into an AI-queryable database. Ask your AI assistant questions like:

- *"What movies have I watched recently?"*
- *"Show me my viewing statistics for the past month"*
- *"What's the most popular content on my server?"*
- *"Find action movies in my library"*
- *"What's on my continue watching list?"*
- *"Add that new show to Sonarr"*
- *"What's in my download queue?"*
- *"Sync my watch history to Trakt"*

## Features

**44 tools** out of the box (53 with write operations enabled):

- **Plex Library Management** — Browse libraries, search media, get detailed metadata, list playlists and watchlist
- **Tautulli-Style Analytics** — Viewing statistics, user activity, popular content, watch history
- **Sonarr/Radarr Integration** — Browse, search, add series/movies, view queues, trigger downloads
- **Trakt.tv Sync** — OAuth authentication, watch history sync, enhanced statistics, scrobbling
- **Write Operations** (opt-in) — Create/edit playlists, update metadata, manage watchlist

> **One server, all tools.** Trakt and Sonarr/Radarr credentials are optional — tools that need them return a helpful setup message if the key is missing. You don't need to configure everything upfront.

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Plex Media Server** (any recent version)
- **Plex Token** ([How to get your token](#getting-your-plex-token))
- **MCP-compatible client** (Claude Desktop, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/niavasha/plex-mcp-server.git
cd plex-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

Or install directly from npm:
```bash
npx plex-mcp-server
```

### Configuration

1. **Get your Plex token** (see [instructions below](#getting-your-plex-token))

2. **Configure your MCP client** (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "plex": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/plex-mcp-server.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token_here",

        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "optional_sonarr_api_key",

        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "optional_radarr_api_key",

        "TRAKT_CLIENT_ID": "optional_trakt_client_id",
        "TRAKT_CLIENT_SECRET": "optional_trakt_client_secret"
      }
    }
  }
}
```

> **Only `PLEX_TOKEN` is required.** All other credentials are optional — tools for unconfigured services return a clear error message explaining how to set them up, rather than crashing the server.

> **Sonarr/Radarr API keys** can be found at **Settings > General > API Key** in each app's web UI.

> **Trakt.tv setup** requires a [Trakt OAuth application](https://trakt.tv/oauth/applications). Create one with redirect URI `urn:ietf:wg:oauth:2.0:oob`, then add the Client ID and Secret to your config. Once the server is running, ask your AI assistant to "authenticate with Trakt" — it will guide you through the OAuth flow. See the [Trakt setup guide](docs/trakt-setup-guide.md) for detailed instructions.

<details>
<summary><strong>Migrating from v1.0.x?</strong></summary>

In v1.0.x there were three separate server binaries (`build/index.js`, `build/plex-trakt-server.js`, `build/plex-arr-server.js`). In v1.1.0+ these are replaced by a single unified binary: `build/plex-mcp-server.js`.

The old binaries still work but emit a deprecation warning. Update your MCP config to point to `build/plex-mcp-server.js` and remove any duplicate server entries.

See the [migration guide](docs/migration-guide.md) for full details.
</details>

### Usage

Once configured, you can ask your AI assistant:

```
"What movies did I watch last week?"
"Show me my most popular TV shows this month"
"Give me viewing statistics for the past 30 days"
"Search for Christopher Nolan movies in my library"
"What's on my continue watching list?"
"List all my Plex libraries"
"Add The Bear to Sonarr"
"What's in my Radarr download queue?"
"Sync my Plex history to Trakt"
```

### Recommended Workflows

**Sync Plex watch history to Trakt:**
1. Set up Trakt credentials (see above)
2. Ask: *"Authenticate with Trakt"* — follow the OAuth flow
3. Ask: *"Do a dry run sync of my Plex history to Trakt"* — preview what would sync
4. Ask: *"Sync my Plex watch history to Trakt"* — run the actual sync

**Find and add new content:**
1. Ask: *"Search Sonarr for Severance"* — find the TVDB ID
2. Ask: *"Add Severance to Sonarr"* — it auto-detects quality profiles and root folders
3. Ask: *"What's in my Sonarr download queue?"* — monitor progress

**Cross-platform viewing analytics:**
1. Ask: *"Show me my Plex viewing stats for the last 30 days"*
2. Ask: *"What are my Trakt stats?"* — see lifetime stats (movies watched, hours, milestones)
3. Ask: *"What are my most popular movies this month?"*

## Available Functions

### Plex Tools (18 tools)

| Function | Description |
|----------|-------------|
| `get_libraries` | List all Plex libraries |
| `get_library_items` | List items in a library with pagination |
| `export_library` | Export a full library to JSON (under `./exports`) |
| `search_media` | Search media globally or within one library |
| `get_recently_added` | Recently added content |
| `get_on_deck` | Continue watching list |
| `get_media_details` | Detailed media info |
| `get_editable_fields` | Show editable fields and available tags for an item |
| `get_playlists` | List all Plex playlists |
| `get_playlist_items` | List items in a playlist |
| `get_watchlist` | Get current Plex watchlist |
| `get_recently_watched` | Recently watched content |
| `get_watch_history` | Detailed watch sessions |
| `get_fully_watched` | Fully watched movies/shows |
| `get_watch_stats` | Comprehensive viewing statistics |
| `get_user_stats` | User activity statistics |
| `get_library_stats` | Library usage metrics |
| `get_popular_content` | Most popular content analysis |

### Write Operations (9 tools, opt-in)

Set `PLEX_ENABLE_MUTATIVE_OPS=true` to enable these tools. They allow your AI assistant to make changes to your Plex server. **Use with care** — while we test these tools, there are no guarantees. Review changes your assistant proposes before confirming.

| Function | Description |
|----------|-------------|
| `update_metadata` | Update metadata fields and editable tags for a media item |
| `update_metadata_from_json` | Apply a metadata JSON payload using best-effort field mapping |
| `create_playlist` | Create a new smart or static playlist |
| `add_to_playlist` | Add a media item to a playlist |
| `remove_from_playlist` | Remove an item from a playlist |
| `clear_playlist` | Preview and optionally clear all items from a playlist (`confirm=true`) |
| `delete_playlist` | Delete a playlist without deleting the underlying media |
| `add_to_watchlist` | Add a media item to the Plex watchlist |
| `remove_from_watchlist` | Remove a media item from the Plex watchlist |

### Sonarr Tools (8 tools)

| Function | Description |
|----------|-------------|
| `sonarr_get_series` | List series with optional title filter |
| `sonarr_search` | Search TheTVDB for new series |
| `sonarr_add_series` | Add series by TVDB ID |
| `sonarr_get_missing` | Missing/wanted episodes |
| `sonarr_get_queue` | Download queue |
| `sonarr_get_calendar` | Upcoming episodes |
| `sonarr_get_profiles` | Quality profiles and root folders |
| `sonarr_trigger_search` | Trigger missing episode search |

### Radarr Tools (8 tools)

| Function | Description |
|----------|-------------|
| `radarr_get_movies` | List movies with optional title filter |
| `radarr_search` | Search TMDB for new movies |
| `radarr_add_movie` | Add movie by TMDB ID |
| `radarr_get_missing` | Missing/wanted movies |
| `radarr_get_queue` | Download queue |
| `radarr_get_calendar` | Upcoming movies |
| `radarr_get_profiles` | Quality profiles and root folders |
| `radarr_trigger_search` | Trigger missing movie search |

### Cross-Service Tools (1 tool)

| Function | Description |
|----------|-------------|
| `arr_get_status` | Check Sonarr/Radarr connection status |

### Trakt Tools (9 tools)

| Function | Description |
|----------|-------------|
| `trakt_authenticate` | Start Trakt.tv OAuth flow |
| `trakt_complete_auth` | Complete authentication |
| `trakt_get_auth_status` | Check auth status |
| `trakt_sync_to_trakt` | Sync Plex history to Trakt |
| `trakt_sync_from_trakt` | Get Trakt data for comparison |
| `trakt_get_user_stats` | Enhanced stats from Trakt |
| `trakt_search` | Search Trakt database |
| `trakt_start_scrobbling` | Real-time scrobbling |
| `trakt_get_sync_status` | Check sync operation status |

## Getting Your Plex Token

1. **Open Plex Web App** in your browser
2. **Navigate to Settings** > Account > Privacy
3. **Click "Show Advanced"** at the bottom
4. **Copy your Plex Token**

Alternative method:
- Visit: `http://YOUR_PLEX_IP:32400/web/index.html#!/settings/account`
- Look for the "Plex Token" field

## Project Structure

```
plex-mcp-server/
├── src/
│   ├── plex-mcp-server.ts    # Unified server entry point (44+ tools)
│   ├── index.ts               # Deprecated shim → plex-mcp-server
│   ├── plex-arr-server.ts     # Deprecated shim → plex-mcp-server
│   ├── plex-trakt-server.ts   # Deprecated shim → plex-mcp-server
│   ├── plex/                  # Shared Plex module
│   │   ├── client.ts          #   Plex API client
│   │   ├── tools.ts           #   Plex tool implementations
│   │   ├── tool-registry.ts   #   Map-based tool dispatch
│   │   ├── tool-schemas.ts    #   MCP tool schema definitions
│   │   ├── constants.ts       #   Configuration defaults
│   │   └── types.ts           #   TypeScript type definitions
│   ├── arr/                   # Sonarr/Radarr module
│   │   ├── client.ts          #   Base ArrClient + Sonarr/Radarr subclasses
│   │   ├── mcp-functions.ts   #   Tool implementations (17 tools)
│   │   ├── tool-registry.ts   #   Map-based tool dispatch
│   │   ├── tool-schemas.ts    #   MCP tool schema definitions
│   │   ├── constants.ts       #   Configuration defaults
│   │   └── types.ts           #   TypeScript type definitions
│   ├── trakt/                 # Trakt.tv module
│   │   ├── client.ts          #   Trakt API client + OAuth
│   │   ├── sync.ts            #   Plex-to-Trakt sync engine
│   │   ├── mapper.ts          #   Plex-to-Trakt data mapping
│   │   ├── mcp-functions.ts   #   Tool implementations (9 tools)
│   │   ├── tool-registry.ts   #   Map-based tool dispatch
│   │   └── tool-schemas.ts    #   MCP tool schema definitions
│   ├── shared/                # Shared utilities
│   │   └── utils.ts           #   truncate, sleep, chunkArray
│   └── __tests__/             # Test suite (94 tests)
├── build/                     # Compiled JavaScript output
├── docs/                      # Documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example               # Environment variables template
└── README.md
```

## Development

### Scripts

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test
npm run test:watch
```

### Building from Source

```bash
git clone https://github.com/niavasha/plex-mcp-server.git
cd plex-mcp-server
npm install
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## Troubleshooting

### Common Issues

**Connection refused:**
- Verify your Plex server is running
- Check the `PLEX_URL` in your environment config
- Ensure the port (usually 32400) is correct

**Authentication errors:**
- Verify your Plex token is correct
- Check token permissions in Plex settings
- Ensure token hasn't expired

**Empty responses:**
- Some features require Plex Pass
- Check if your libraries are accessible
- Verify media has been scanned and is available

**Sonarr/Radarr connection issues:**
- Verify Sonarr/Radarr is running and accessible from the MCP server host
- Check that the API key is correct (Settings > General > API Key)
- Sonarr uses API v3 at `/api/v3/` — ensure your URL doesn't include a trailing path
- For large Radarr libraries (20k+ movies), the initial `radarr_get_movies` call may take up to 30 seconds

**Trakt authentication issues:**
- Ensure `TRAKT_CLIENT_ID` and `TRAKT_CLIENT_SECRET` are both set
- Use the `trakt_authenticate` tool to start the OAuth flow
- Complete authentication with `trakt_complete_auth` using the code from Trakt

**MCP client issues:**
- Ensure the path is set to `build/plex-mcp-server.js` (the unified server)
- Check that Node.js is in your system PATH
- Verify environment variables are set in client config

### Getting Help

- [Open an issue](https://github.com/niavasha/plex-mcp-server/issues)
- Check existing [discussions](https://github.com/niavasha/plex-mcp-server/discussions)
- Review the [MCP documentation](https://modelcontextprotocol.io/)

## Requirements

- **Node.js** 20.0.0 or higher
- **Plex Media Server** (any recent version)
- **Network access** between MCP server and Plex server
- **Valid Plex token** with appropriate permissions

## Security Notes

- **Keep your Plex token secure** - never commit it to version control
- **Use environment variables** for sensitive configuration
- **Run on trusted networks** - the server communicates directly with Plex
- **Regular token rotation** - consider refreshing tokens periodically
- **Write operations** are disabled by default — enable only if you trust your AI assistant's judgment

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Anthropic](https://anthropic.com/) for the Model Context Protocol
- [Plex](https://www.plex.tv/) for the amazing media server
- [Tautulli](https://tautulli.com/) for analytics inspiration
- The open-source community for various libraries and tools

## Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - The standard this server implements
- [Claude Desktop](https://claude.ai/) - Popular MCP client
- [Tautulli](https://github.com/Tautulli/Tautulli) - Plex monitoring and analytics
- [PlexAPI](https://github.com/pkkid/python-plexapi) - Python Plex API library

---

**Built with love for the Plex and AI community**
