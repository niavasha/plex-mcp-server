# Plex MCP Server

A **Model Context Protocol (MCP)** server that provides AI assistants with comprehensive access to your Plex Media Server. Query your libraries, get viewing statistics, and manage your media through natural language interactions.

<a href="https://glama.ai/mcp/servers/@niavasha/plex-mcp-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@niavasha/plex-mcp-server/badge" alt="Plex Server MCP server" />
</a>

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎬 What is this?

This MCP server transforms your Plex Media Server into an AI-queryable database. Ask your AI assistant questions like:

- *"What movies have I watched recently?"*
- *"Show me my viewing statistics for the past month"*
- *"What's the most popular content on my server?"*
- *"Find action movies in my library"*
- *"What's on my continue watching list?"*

## ✨ Features

### 📚 **Library Management** (Plex)
- Browse all Plex libraries
- Search across movies, TV shows, music, and more
- Get detailed metadata for any media item

### 📊 **Tautulli-Style Analytics** (Plex)
- Comprehensive viewing statistics
- User activity tracking
- Popular content analysis
- Watch history with progress tracking
- Library usage metrics

### 🎯 **Smart Querying** (Plex)
- Recently watched content
- Fully watched movies/shows
- Continue watching (On Deck)
- Recently added media

### 📡 **Sonarr/Radarr Integration** (Plex+Arr Server)
- Browse and search your Sonarr series and Radarr movie libraries
- Add new series/movies by TVDB/TMDB ID with auto-detected quality profiles
- View download queues, missing episodes/movies, and calendar
- Trigger searches for missing content
- Check service status for both Sonarr and Radarr

### 🔄 **Trakt.tv Sync** (Plex+Trakt Server)
- OAuth authentication with Trakt.tv
- Sync Plex watch history to Trakt
- Enhanced viewing statistics from Trakt
- Search the Trakt database
- Real-time scrobbling support

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
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

### Configuration

1. **Get your Plex token** (see [instructions below](#getting-your-plex-token))

2. **Create environment file:**
```bash
# Copy the example environment file
cp .env.example .env

# Edit with your details
PLEX_URL=http://localhost:32400
PLEX_TOKEN=your_plex_token_here
```

3. **Configure your MCP client:**

Add to your MCP client configuration (e.g., Claude Desktop).

**Plex only** (12 tools):
```json
{
  "mcpServers": {
    "plex": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/index.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token_here"
      }
    }
  }
}
```

**Plex + Sonarr/Radarr** (24 tools):
```json
{
  "mcpServers": {
    "plex-arr": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/plex-arr-server.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token_here",
        "SONARR_URL": "http://localhost:8989",
        "SONARR_API_KEY": "your_sonarr_api_key",
        "RADARR_URL": "http://localhost:7878",
        "RADARR_API_KEY": "your_radarr_api_key"
      }
    }
  }
}
```

**Plex + Trakt.tv** (16 tools):
```json
{
  "mcpServers": {
    "plex-trakt": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/plex-trakt-server.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token_here",
        "TRAKT_CLIENT_ID": "your_trakt_client_id",
        "TRAKT_CLIENT_SECRET": "your_trakt_client_secret"
      }
    }
  }
}
```

> **Note:** Sonarr/Radarr API keys are optional at startup — tools that need them will return a helpful error message if the key is missing. Find your API keys at **Settings > General > API Key** in each app's web UI.

### Usage

Once configured, you can ask your AI assistant:

```
🎬 "What movies did I watch last week?"
📺 "Show me my most popular TV shows this month"
📊 "Give me viewing statistics for the past 30 days"
🔍 "Search for Christopher Nolan movies in my library"
▶️ "What's on my continue watching list?"
📚 "List all my Plex libraries"
```

## 🛠️ Available Functions

### Plex Tools (all servers)

| Function | Description |
|----------|-------------|
| `get_libraries` | List all Plex libraries |
| `search_media` | Search across all media |
| `get_recently_added` | Recently added content |
| `get_on_deck` | Continue watching list |
| `get_media_details` | Detailed media info |
| `get_recently_watched` | Recently watched content |
| `get_watch_history` | Detailed watch sessions |

The standalone Plex server also includes: `get_fully_watched`, `get_watch_stats`, `get_user_stats`, `get_library_stats`, `get_popular_content`.

### Sonarr Tools (plex-arr-server)

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

### Radarr Tools (plex-arr-server)

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

### Cross-Service Tools (plex-arr-server)

| Function | Description |
|----------|-------------|
| `arr_get_status` | Check Sonarr/Radarr connection status |

### Trakt Tools (plex-trakt-server)

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

## 🔑 Getting Your Plex Token

1. **Open Plex Web App** in your browser
2. **Navigate to Settings** → Account → Privacy
3. **Click "Show Advanced"** at the bottom
4. **Copy your Plex Token**

Alternative method:
- Visit: `http://YOUR_PLEX_IP:32400/web/index.html#!/settings/account`
- Look for the "Plex Token" field

## 📁 Project Structure

```
plex-mcp-server/
├── src/
│   ├── index.ts               # Standalone Plex server (12 tools)
│   ├── plex-arr-server.ts     # Plex + Sonarr/Radarr server (24 tools)
│   ├── plex-trakt-server.ts   # Plex + Trakt server (16 tools)
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
│   └── shared/                # Shared utilities
│       └── utils.ts           #   truncate, sleep, chunkArray
├── build/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
├── .env.example               # Environment variables template
└── README.md
```

## 🔧 Development

### Scripts

```bash
# Development mode with auto-reload
npm run dev            # Plex only
npm run dev:arr        # Plex + Sonarr/Radarr
npm run dev:trakt      # Plex + Trakt

# Build for production
npm run build

# Start production server
npm start              # Plex only
npm start:arr          # Plex + Sonarr/Radarr
npm start:trakt        # Plex + Trakt
```

### Building from Source

```bash
# Clone and setup
git clone https://github.com/niavasha/plex-mcp-server.git
cd plex-mcp-server
npm install

# Development
npm run dev
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

## 🐛 Troubleshooting

### Common Issues

**Connection refused:**
- Verify your Plex server is running
- Check the `PLEX_URL` in your `.env` file
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

**MCP client issues:**
- Ensure the path to the correct server JS file is set (`build/index.js`, `build/plex-arr-server.js`, or `build/plex-trakt-server.js`)
- Check that Node.js is in your system PATH
- Verify environment variables are set in client config

### Getting Help

- 📝 [Open an issue](https://github.com/niavasha/plex-mcp-server/issues)
- 💬 Check existing [discussions](https://github.com/niavasha/plex-mcp-server/discussions)
- 📖 Review the [MCP documentation](https://modelcontextprotocol.io/)

## 📋 Requirements

- **Node.js** 18.0.0 or higher
- **Plex Media Server** (any recent version)
- **Network access** between MCP server and Plex server
- **Valid Plex token** with appropriate permissions

## 🔒 Security Notes

- **Keep your Plex token secure** - never commit it to version control
- **Use environment variables** for sensitive configuration
- **Run on trusted networks** - the server communicates directly with Plex
- **Regular token rotation** - consider refreshing tokens periodically

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com/) for the Model Context Protocol
- [Plex](https://www.plex.tv/) for the amazing media server
- [Tautulli](https://tautulli.com/) for analytics inspiration
- The open-source community for various libraries and tools

## 🔗 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - The standard this server implements
- [Claude Desktop](https://claude.ai/) - Popular MCP client
- [Tautulli](https://github.com/Tautulli/Tautulli) - Plex monitoring and analytics
- [PlexAPI](https://github.com/pkkid/python-plexapi) - Python Plex API library

---

**Built with ❤️ for the Plex and AI community**