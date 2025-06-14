# Plex MCP Server

A **Model Context Protocol (MCP)** server that provides AI assistants with comprehensive access to your Plex Media Server. Query your libraries, get viewing statistics, and manage your media through natural language interactions.

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

### 📚 **Library Management**
- Browse all Plex libraries
- Search across movies, TV shows, music, and more
- Get detailed metadata for any media item

### 📊 **Tautulli-Style Analytics**
- Comprehensive viewing statistics
- User activity tracking
- Popular content analysis
- Watch history with progress tracking
- Library usage metrics

### 🎯 **Smart Querying**
- Recently watched content
- Fully watched movies/shows
- Continue watching (On Deck)
- Recently added media

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

Add to your MCP client configuration (e.g., Claude Desktop):

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

| Function | Description | Example Usage |
|----------|-------------|---------------|
| `get_libraries` | List all Plex libraries | *"What libraries do I have?"* |
| `search_media` | Search across all media | *"Find movies with Tom Hanks"* |
| `get_recently_added` | Recently added content | *"What's new on my server?"* |
| `get_on_deck` | Continue watching list | *"What should I continue watching?"* |
| `get_media_details` | Detailed media info | *"Tell me about The Matrix"* |
| `get_recently_watched` | Recently watched content | *"What did I watch yesterday?"* |
| `get_fully_watched` | Completed content | *"Show me all watched movies"* |
| `get_watch_history` | Detailed watch sessions | *"Show my viewing history"* |
| `get_watch_stats` | Viewing analytics | *"My watching statistics"* |
| `get_user_stats` | User activity data | *"Who watches the most?"* |
| `get_library_stats` | Library information | *"Tell me about my movie library"* |
| `get_popular_content` | Most popular media | *"What's trending on my server?"* |

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
│   └── index.ts          # Main MCP server implementation
├── build/                # Compiled JavaScript output
├── package.json          # Node.js dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.example          # Environment variables template
├── README.md             # This file
└── LICENSE               # MIT License
```

## 🔧 Development

### Scripts

```bash
# Development mode with auto-reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests (if implemented)
npm test
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

**MCP client issues:**
- Ensure the path to `build/index.js` is correct
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
