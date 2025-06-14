# Changelog

All notable changes to the Plex MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-XX

### 🎉 Initial Release

This is the first stable release of the Plex MCP Server, providing comprehensive AI integration with Plex Media Server through the Model Context Protocol.

### ✨ Added

#### Core Library Functions
- **`get_libraries`** - List all Plex libraries with metadata
- **`search_media`** - Search across all media types with filtering
- **`get_recently_added`** - Retrieve recently added content with customizable limits
- **`get_on_deck`** - Access continue watching (On Deck) items
- **`get_media_details`** - Get detailed information about specific media items

#### Analytics & History Functions
- **`get_recently_watched`** - Recently watched content with progress tracking
- **`get_fully_watched`** - Complete list of fully watched movies/shows
- **`get_watch_history`** - Detailed session history with user and device information
- **`get_watch_stats`** - Comprehensive viewing analytics (Tautulli-style)
- **`get_user_stats`** - User-specific viewing statistics
- **`get_library_stats`** - Library-specific information and metadata
- **`get_popular_content`** - Most popular content by plays or duration

#### Robust Error Handling
- **Multiple fallback methods** for each function to ensure compatibility
- **Graceful degradation** when features aren't available
- **Helpful error messages** explaining limitations and requirements
- **Compatibility across Plex configurations** (free and Plex Pass)

#### Developer Experience
- **TypeScript implementation** with full type safety
- **Comprehensive documentation** with examples and troubleshooting
- **Environment-based configuration** for easy deployment
- **MCP 1.0 compliance** for broad client compatibility

### 🛠️ Technical Details

#### Architecture
- Built on the **Model Context Protocol (MCP)** specification
- **Node.js** and **TypeScript** implementation
- **Axios** for HTTP requests to Plex API
- **Stdio transport** for MCP client communication

#### Compatibility
- **Node.js** 18.0.0 or higher
- **All modern Plex Media Server versions**
- **MCP-compatible clients** (Claude Desktop, etc.)
- **Cross-platform** support (Windows, macOS, Linux)

#### Configuration
- **Environment variable** based configuration
- **Flexible Plex server URLs** (local and remote)
- **Secure token-based authentication**
- **Optional debug logging**

### 📚 Documentation

#### Complete User Documentation
- **Comprehensive README.md** with quick start guide
- **Step-by-step installation** instructions
- **Plex token acquisition** guide
- **MCP client configuration** examples
- **Troubleshooting section** for common issues

#### Developer Resources
- **CONTRIBUTING.md** with development guidelines
- **Detailed API documentation** for all functions
- **Code examples** and usage patterns
- **Testing guidelines** and best practices

### 🔒 Security

#### Authentication & Privacy
- **Secure Plex token handling** through environment variables
- **No sensitive data logging** or storage
- **Local network communication** by default
- **User data privacy** - no external data transmission

### 🎯 Key Features Highlights

#### AI-Friendly Integration
- **Natural language queries** supported through MCP
- **Rich metadata responses** with comprehensive information
- **Contextual error handling** with helpful suggestions
- **Consistent API responses** across all functions

#### Analytics Capabilities
- **Tautulli-inspired analytics** for comprehensive insights
- **Multi-dimensional statistics** (users, libraries, platforms, time)
- **Flexible time range filtering** for historical analysis
- **Progress tracking** and completion detection

#### Reliability Features
- **Multiple endpoint fallbacks** for maximum compatibility
- **Graceful error recovery** prevents client crashes
- **Version-agnostic implementation** works across Plex versions
- **Smart filtering and sorting** for optimal results

### 🚀 Getting Started

```bash
# Quick installation
git clone https://github.com/niavasha/plex-mcp-server.git
cd plex-mcp-server
npm install
npm run build

# Configure your Plex server
cp .env.example .env
# Edit .env with your Plex URL and token

# Start the server
npm start
```

### 📈 Performance

- **Efficient API usage** with smart batching and filtering
- **Minimal memory footprint** with streaming responses
- **Fast response times** through optimized queries
- **Scalable architecture** for large media libraries

### 🤝 Community

- **Open source** under MIT license
- **Community contributions** welcome
- **Comprehensive contribution guidelines**
- **Active issue tracking** and feature requests

---

## Release Notes

### What's New in v1.0.0

This initial release provides a production-ready MCP server that transforms your Plex Media Server into an AI-queryable database. You can now ask your AI assistant natural language questions about your media library and get comprehensive, accurate responses.

### Upgrade Path

This is the initial release, so no upgrade considerations apply.

### Known Limitations

- **Watchlist functions** removed due to inconsistent Plex API support across configurations
- **Some analytics features** require Plex Pass for full functionality
- **Historical data** availability depends on Plex server logging configuration

### Future Roadmap

- Enhanced analytics with more granular filtering
- Support for Plex collections and playlists
- Real-time activity monitoring
- Extended metadata enrichment
- Performance optimizations for large libraries

---

**For detailed information about any release, see the [GitHub Releases](https://github.com/niavasha/plex-mcp-server/releases) page.**
