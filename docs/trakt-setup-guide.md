# Trakt.tv Integration Setup Guide

This guide walks you through setting up Trakt.tv integration with your Plex MCP Server, enabling advanced analytics, cross-platform sync, and enhanced recommendations.

## Prerequisites

1. **Plex Media Server** - Working Plex MCP Server
2. **Trakt.tv Account** - Free account at [trakt.tv](https://trakt.tv)
3. **Node.js 18+** - Required for running the server

## Step 1: Create Trakt OAuth Application

1. **Login to Trakt.tv** and go to [OAuth Applications](https://trakt.tv/oauth/applications)

2. **Click "New Application"** and fill out the form:
   - **Name**: `Plex MCP Server` (or your preferred name)
   - **Description**: `MCP integration for Plex Media Server`
   - **Redirect URI**: `urn:ietf:wg:oauth:2.0:oob` (for PIN-based auth)
   - **Website**: Your website or leave blank
   - **Icon**: Optional

3. **Save the application** and note down:
   - **Client ID** - You'll need this for configuration
   - **Client Secret** - Keep this secure!

## Step 2: Configure Environment Variables

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit your `.env` file** with your Trakt credentials:
   ```bash
   # Plex configuration (existing)
   PLEX_URL=http://localhost:32400
   PLEX_TOKEN=your_plex_token

   # Trakt configuration (new)
   TRAKT_CLIENT_ID=your_trakt_client_id_here
   TRAKT_CLIENT_SECRET=your_trakt_client_secret_here
   TRAKT_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
   ```

## Step 3: Start the Trakt-Enabled Server

Use the Trakt-enabled version of the MCP server:

```bash
# Development mode
npm run dev:trakt

# Production mode
npm run build
npm run start:trakt
```

## Step 4: Authenticate with Trakt

Once your MCP client is connected to the Trakt-enabled server, use these functions:

### 4.1 Initiate Authentication

Call the `trakt_authenticate` function:

```json
{
  "function": "trakt_authenticate",
  "arguments": {}
}
```

This returns:
```json
{
  "success": true,
  "authUrl": "https://trakt.tv/oauth/authorize?...",
  "instructions": [
    "1. Open the provided URL in your browser",
    "2. Authorize the application on Trakt.tv", 
    "3. Copy the authorization code from the callback",
    "4. Use trakt_complete_auth with the code to complete setup"
  ]
}
```

### 4.2 Complete Authentication

1. **Open the auth URL** in your browser
2. **Authorize the application** on Trakt.tv
3. **Copy the authorization code** from the success page
4. **Complete authentication:**

```json
{
  "function": "trakt_complete_auth",
  "arguments": {
    "code": "your_authorization_code_here"
  }
}
```

### 4.3 Verify Authentication

Check that authentication worked:

```json
{
  "function": "trakt_get_auth_status",
  "arguments": {}
}
```

## Step 5: Sync Your Data

### 5.1 Dry Run Sync (Recommended First)

Test the sync without making changes:

```json
{
  "function": "trakt_sync_to_trakt",
  "arguments": {
    "dryRun": true,
    "batchSize": 25
  }
}
```

### 5.2 Full Sync to Trakt

Sync your Plex watch history to Trakt:

```json
{
  "function": "trakt_sync_to_trakt",
  "arguments": {
    "dryRun": false,
    "batchSize": 50,
    "includeProgress": false
  }
}
```

### 5.3 Compare with Trakt Data

See what's already on Trakt:

```json
{
  "function": "trakt_sync_from_trakt",
  "arguments": {}
}
```

## Available Functions

Once authenticated, you have access to these Trakt functions:

### Authentication & Setup
- `trakt_authenticate()` - Start OAuth flow
- `trakt_complete_auth(code)` - Complete authentication
- `trakt_get_auth_status()` - Check auth status

### Sync Operations  
- `trakt_sync_to_trakt(options)` - Push Plex history to Trakt
- `trakt_sync_from_trakt()` - Get Trakt history for comparison
- `trakt_get_sync_status()` - Check sync progress

### Enhanced Analytics
- `trakt_get_user_stats()` - Advanced statistics from Trakt
- `trakt_search(query, type?, year?)` - Search Trakt database

### Real-time Features
- `trakt_start_scrobbling(session)` - Enable auto-scrobbling (requires webhook setup)

## Configuration Options

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TRAKT_CLIENT_ID` | OAuth application client ID | Yes | - |
| `TRAKT_CLIENT_SECRET` | OAuth application secret | Yes | - |
| `TRAKT_REDIRECT_URI` | OAuth redirect URI | No | `urn:ietf:wg:oauth:2.0:oob` |
| `TRAKT_ACCESS_TOKEN` | User access token (auto-set) | No | - |
| `TRAKT_REFRESH_TOKEN` | User refresh token (auto-set) | No | - |
| `TRAKT_BASE_URL` | Custom API base URL | No | `https://api-v2launch.trakt.tv` |

### Sync Options

- **dryRun**: Preview sync without changes
- **batchSize**: Items per API request (25-100 recommended)
- **includeProgress**: Sync watch progress data
- **autoResolveConflicts**: Automatically handle data conflicts

## MCP Client Configuration

### Claude Desktop Example

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "plex-trakt": {
      "command": "node",
      "args": ["/path/to/plex-mcp-server/build/plex-trakt-server.js"],
      "env": {
        "PLEX_URL": "http://localhost:32400",
        "PLEX_TOKEN": "your_plex_token",
        "TRAKT_CLIENT_ID": "your_trakt_client_id",
        "TRAKT_CLIENT_SECRET": "your_trakt_client_secret"
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify client ID and secret are correct
- Check that redirect URI matches your OAuth app settings
- Ensure authorization code is copied correctly and used immediately

**Sync Errors**
- Run with `dryRun: true` first to identify issues
- Check that your Plex media has proper IMDB/TMDB/TVDB IDs
- Verify Plex server is accessible and token is valid

**Rate Limiting**
- Trakt enforces rate limits per user
- Reduce `batchSize` if you see 429 errors
- The client automatically handles rate limiting with backoff

**Missing External IDs**
- Plex media needs IMDB, TMDB, or TVDB IDs for Trakt matching
- Use Plex agents that populate these fields (like TMDB agent)
- Some content may not sync if IDs are missing

### Debug Mode

Enable debug logging:

```bash
DEBUG=true npm run dev:trakt
```

### Support

- **GitHub Issues**: [Report bugs and issues](https://github.com/your-repo/issues)
- **Trakt API Docs**: [Official documentation](https://trakt.docs.apiary.io/)
- **MCP Documentation**: [Model Context Protocol](https://modelcontextprotocol.io/)

## Privacy & Security

- **Tokens are stored locally** in your environment
- **No data is sent to third parties** (only Plex ↔ Trakt)
- **Respect rate limits** to avoid service disruption
- **OAuth tokens can be revoked** at any time on Trakt.tv

## What's Next?

Once sync is working:
1. **Set up regular syncing** (manual for now, automated in future)
2. **Explore enhanced analytics** with `trakt_get_user_stats`
3. **Use Trakt data for recommendations** (future feature)
4. **Set up real-time scrobbling** (requires webhook setup)

---

*Last Updated: 2025-09-08*  
*Version: 1.0.0*