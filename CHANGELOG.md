# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] — 2026-04-04

### Added
- **Unified server** (`src/plex-mcp-server.ts`): single entry point exposing all 44 tools (18 Plex + 9 Trakt + 17 Arr). 53 tools with write operations enabled.
- Extended analytics tools (`get_fully_watched`, `get_watch_stats`, `get_user_stats`, `get_library_stats`, `get_popular_content`) now available in all server variants — previously these were only in the standalone Plex server.
- Migration guide (`docs/migration-guide.md`) for users upgrading from v1.0.x.
- Comprehensive test suite: 94 tests across 8 files covering tool registration, dispatch routing, graceful degradation, and constants validation.
- CI workflow with Node 20/22 matrix, security audit gating before publish.
- npm trusted publishing via OIDC (no stored tokens).

### Changed
- `npm start` / `npm run dev` now run the unified server instead of the Plex-only server.
- Minimum Node.js version raised from 18 to 20 (vitest 4.x requires `styleText` from `node:util`).
- Tool counts: Plex 18, Trakt 9, Arr 17, Write ops 9 = 44 base / 53 total.

### Deprecated
- `build/index.js` (standalone Plex server): use `build/plex-mcp-server.js` instead.
- `build/plex-trakt-server.js`: use `build/plex-mcp-server.js` instead.
- `build/plex-arr-server.js`: use `build/plex-mcp-server.js` instead.
- `npm run dev:trakt`, `npm run dev:arr`, `npm run start:trakt`, `npm run start:arr`: use `npm run dev` / `npm start` instead.

Old binaries still work and emit a deprecation warning. They will be removed in v2.0.0.

## [1.0.5] — 2026-04-03

### Added
- Published to npm with provenance attestation via OIDC trusted publishing.
- CI workflow (`ci.yml`) with build + test on Node 18 and 22.
- Security scanning: CodeQL, TruffleHog, license compliance, npm audit.
- Dependabot auto-merge for patch/minor updates.
- Third-party GitHub Actions pinned to commit SHAs.

## [1.0.0] — 2026-04-02

### Added
- Read-only Plex tools: `get_library_items`, `export_library`, `get_playlists`, `get_playlist_items`, `get_watchlist`, `get_editable_fields`.
- Opt-in write operations (enabled with `PLEX_ENABLE_MUTATIVE_OPS=true`): `update_metadata`, `update_metadata_from_json`, `create_playlist`, `add_to_playlist`, `remove_from_playlist`, `clear_playlist`, `delete_playlist`, `add_to_watchlist`, `remove_from_watchlist`.
- Sonarr/Radarr integration: 17 tools for managing series/movies, queues, calendars.
- Trakt.tv integration: 9 tools for OAuth, sync, search, scrobbling.
- Shared module architecture: `src/plex/`, `src/arr/`, `src/trakt/`, `src/shared/`.

### Changed
- `search_media` now supports `libraryKey`, `limit`, and `offset`.
- `export_library` enforces safe export paths, handles backpressure, removes partial files on failure.
- Server entrypoints load `.env` automatically via `dotenv/config`.
