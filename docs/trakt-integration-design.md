# Trakt.tv Integration Architecture Design

## Overview

This document outlines the design for integrating Trakt.tv sync capabilities into the Plex MCP Server, enabling advanced statistics, cross-platform synchronization, and enhanced recommendations.

## Architecture Components

### 1. Trakt API Client (`src/trakt/client.ts`)

```typescript
interface TraktConfig {
  baseUrl: string;           // https://api-v2launch.trakt.tv
  clientId: string;          // OAuth application client ID
  clientSecret: string;      // OAuth application client secret  
  redirectUri: string;       // OAuth redirect URI
  accessToken?: string;      // User's access token (stored securely)
  refreshToken?: string;     // For token refresh
}

class TraktClient {
  // Authentication methods
  generateAuthUrl(): string
  exchangeCodeForToken(code: string): Promise<TraktTokens>
  refreshAccessToken(): Promise<TraktTokens>
  
  // Core API methods
  scrobbleStart(item: TraktScrobbleItem): Promise<void>
  scrobblePause(item: TraktScrobbleItem): Promise<void>
  scrobbleStop(item: TraktScrobbleItem): Promise<void>
  
  // Sync methods
  syncWatchedMovies(movies: TraktMovie[]): Promise<TraktSyncResult>
  syncWatchedShows(shows: TraktShow[]): Promise<TraktSyncResult>
  getWatchedMovies(): Promise<TraktMovie[]>
  getWatchedShows(): Promise<TraktShow[]>
  
  // Statistics methods
  getUserStats(): Promise<TraktUserStats>
  getWatchedProgress(): Promise<TraktProgress[]>
}
```

### 2. Data Mapping Layer (`src/trakt/mapper.ts`)

Converts between Plex and Trakt data formats:

```typescript
interface PlexToTraktMapper {
  mapPlexMovieToTrakt(plexMovie: PlexMovie): TraktMovie
  mapPlexShowToTrakt(plexShow: PlexShow, episode: PlexEpisode): TraktShow
  mapPlexWatchSessionToScrobble(session: PlexWatchSession): TraktScrobbleItem
  mapTraktStatsToMCP(stats: TraktUserStats): MCPStatsResponse
}
```

### 3. Sync Engine (`src/trakt/sync.ts`)

Handles bidirectional synchronization:

```typescript
class TraktSyncEngine {
  // One-time full sync
  performFullSync(direction: 'plex-to-trakt' | 'trakt-to-plex' | 'bidirectional'): Promise<SyncResult>
  
  // Incremental sync for recent changes
  performIncrementalSync(since: Date): Promise<SyncResult>
  
  // Real-time scrobbling
  startScrobbleSession(plexSession: PlexSession): Promise<void>
  updateScrobbleProgress(plexSession: PlexSession): Promise<void>
  endScrobbleSession(plexSession: PlexSession): Promise<void>
  
  // Conflict resolution
  resolveWatchedConflicts(conflicts: SyncConflict[]): Promise<ConflictResolution[]>
}
```

### 4. MCP Integration (`src/trakt/mcp-functions.ts`)

New MCP functions for Trakt functionality:

```typescript
// Authentication & Setup
- trakt_authenticate()           // Start OAuth flow
- trakt_get_auth_status()        // Check authentication status  
- trakt_refresh_token()          // Refresh access token

// Sync Operations
- trakt_sync_to_trakt()          // Push Plex history to Trakt
- trakt_sync_from_trakt()        // Pull Trakt history to compare
- trakt_perform_full_sync()      // Bidirectional full sync
- trakt_get_sync_status()        // Check sync progress/status

// Enhanced Analytics
- trakt_get_user_stats()         // Advanced Trakt-powered statistics
- trakt_get_watching_progress()  // Cross-platform progress tracking
- trakt_get_recommendations()    // Trakt-powered recommendations
- trakt_compare_with_friends()   // Social comparison features

// Real-time Scrobbling
- trakt_start_scrobbling()       // Enable auto-scrobbling
- trakt_stop_scrobbling()        // Disable auto-scrobbling
- trakt_scrobble_session()       // Manual scrobble single session
```

## Data Flow Architecture

### 1. Authentication Flow
```
User → MCP Client → trakt_authenticate() → Generate OAuth URL → 
User authorizes → Callback with code → Exchange for tokens → Store securely
```

### 2. Sync Flow (Plex → Trakt)
```
Plex Watch History → Data Mapper → Trakt API Format → 
Rate Limited Batch Upload → Conflict Resolution → Sync Result
```

### 3. Real-time Scrobbling Flow
```
Plex Session Start → Start Scrobble → Progress Updates → 
Session End → Stop Scrobble → Update Trakt History
```

### 4. Enhanced Analytics Flow
```
Trakt User Data + Plex Data → Analytics Engine → 
Enhanced Statistics → MCP Response Format
```

## Configuration & Security

### Environment Variables
```bash
# Trakt OAuth Application (created at https://trakt.tv/oauth/applications)
TRAKT_CLIENT_ID=your_client_id
TRAKT_CLIENT_SECRET=your_client_secret
TRAKT_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob  # For PIN-based auth

# Optional: Default sync settings
TRAKT_AUTO_SYNC=true
TRAKT_SCROBBLE_ENABLED=true
TRAKT_SYNC_INTERVAL=3600  # 1 hour in seconds
```

### Token Storage
- Access tokens stored securely (encrypted at rest)
- Refresh tokens handled automatically
- Per-user token management for multi-user Plex servers

## Rate Limiting & Error Handling

### Rate Limiting Strategy
- Respect Trakt's rate limits (429 status codes)
- Implement exponential backoff
- Batch operations where possible
- Queue requests during high-traffic periods

### Error Handling
```typescript
class TraktErrorHandler {
  handleRateLimit(retryAfter: number): Promise<void>
  handleAuthenticationError(): Promise<void>
  handleNetworkError(error: NetworkError): Promise<void>
  handleSyncConflict(conflict: SyncConflict): Promise<ConflictResolution>
}
```

## Database Schema (Optional Local Cache)

```sql
-- User authentication
CREATE TABLE trakt_users (
  plex_user_id INTEGER PRIMARY KEY,
  trakt_user_id INTEGER,
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync status tracking
CREATE TABLE trakt_sync_sessions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  sync_type TEXT, -- 'full', 'incremental', 'scrobble'
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  status TEXT, -- 'running', 'completed', 'failed'
  items_processed INTEGER,
  items_failed INTEGER,
  last_error TEXT
);

-- Conflict resolution log
CREATE TABLE trakt_sync_conflicts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  plex_rating_key TEXT,
  trakt_id INTEGER,
  conflict_type TEXT,
  plex_data JSON,
  trakt_data JSON,
  resolution TEXT,
  resolved_at TIMESTAMP
);
```

## Implementation Phases

### Phase 1: Core Integration
1. ✅ Basic Trakt API client with OAuth authentication
2. ✅ Plex-to-Trakt data mapping
3. ✅ One-way sync (Plex → Trakt)
4. ✅ Basic MCP functions for sync operations

### Phase 2: Enhanced Features
1. ⏳ Bidirectional sync with conflict resolution
2. ⏳ Real-time scrobbling integration
3. ⏳ Enhanced analytics using Trakt data
4. ⏳ Basic recommendation engine

### Phase 3: Advanced Features
1. 📋 Social features and friend comparison
2. 📋 Multi-user support for shared Plex servers
3. 📋 Advanced recommendation algorithms
4. 📋 Integration with other services via Trakt

## Security Considerations

- **Token Security**: Encrypt tokens at rest, secure transmission
- **API Key Management**: Never expose client secrets in logs
- **User Privacy**: Respect user privacy settings from both Plex and Trakt
- **Rate Limiting**: Implement proper backoff to avoid service disruption
- **Data Validation**: Validate all data before sync operations

## Testing Strategy

1. **Unit Tests**: Test data mapping, API client methods
2. **Integration Tests**: Test full sync flows with mock APIs  
3. **Rate Limit Testing**: Test behavior under rate limiting
4. **Error Scenario Testing**: Network failures, auth failures, conflicts
5. **Performance Testing**: Large library sync performance

## Monitoring & Observability

- Sync success/failure rates
- API response times and error rates
- Token refresh frequency
- User engagement with Trakt features
- Conflict resolution patterns

---

*Design Version*: 1.0  
*Last Updated*: 2025-09-08  
*Next Review*: After Phase 1 implementation