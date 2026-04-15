# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] — 2026-04-15

### Fixed
- **`create_playlist` returned 400 error** ([#48](https://github.com/niavasha/plex-mcp-server/issues/48)). Calling `create_playlist` without `ratingKeys` silently flipped `smart` to `true` and POSTed `/playlists` with no `uri` parameter — which Plex rejects. The tool now validates inputs up front and rejects invalid combinations with a clear `InvalidRequest` error instead of passing them through to Plex. Verified against the `python-plexapi` reference implementation, which itself raises `BadRequest` when no items are provided.
- **Multi-item playlist creation is now a single round-trip.** Previously, a playlist with N items resulted in one `/playlists` POST (seeding only the first item) plus N-1 follow-up `addToPlaylist` calls. The tool now comma-joins all rating keys into the initial `uri` parameter — matching `python-plexapi` — so an N-item playlist is created in exactly one POST.

### Added
- **Smart playlist support in `create_playlist`**. Pass `smart: true` with `librarySectionId` (required) and optionally `libtype` / `smartFilter` to create a smart playlist. The tool constructs the correct `/library/sections/{id}/all` search URI. The `smartFilter` parameter accepts a raw Plex filter query string (e.g. `genre=Drama&year>=2020&sort=titleSort:asc&limit=100`).
- `SMART_PLAYLIST_LIBTYPE_IDS` constant mapping libtypes (`movie`/`show`/`season`/`episode`/`artist`/`album`/`track`/`photo`/`photoalbum`) to their numeric IDs used inside smart playlist search URIs.
- 9 new tests covering `create_playlist` validation, URI construction, comma-joining, smart playlist modes, and mutual-exclusivity guards. Test suite: 105 tests across 8 files (was 94).

### Security
- **Bumped `follow-redirects` 1.15.11 → 1.16.0** ([GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653)). Moderate severity advisory — `follow-redirects` leaks custom Authorization headers to cross-domain redirect targets. Transitive dependency via `axios@1.15.0`. `npm audit` now reports 0 vulnerabilities. Clears the scheduled Security Scans workflow on `main`.

### Breaking
- `create_playlist` now **requires** `ratingKeys` (≥1) for non-smart playlists. Previously, calling it without rating keys silently flipped to (broken) smart mode; that path was never functional, so no caller can be relying on the old behaviour.
- Internal `PlexTools.createPlaylist` signature changed from positional `(title, type, ratingKeys?, smart?)` to an options object: `(title, type, { ratingKeys?, smart?, librarySectionId?, libtype?, smartFilter? })`. Only affects direct library consumers — the MCP tool schema is fully additive and backwards compatible for existing JSON-RPC callers that pass `ratingKeys`.

## [1.1.0] — 2026-04-04

### Added
- **Unified server** (`src/plex-mcp-server.ts`): single entry point exposing all 45 tools (19 Plex + 9 Trakt + 17 Arr). 54 tools with write operations enabled.
- **`get_recommendations`**: personalized movie recommendations based on watch history. Analyzes genres, directors, actors, and ratings to score unwatched films. Supports per-user profiles for multi-user Plex servers. If Trakt is configured, uses your Trakt watched history to catch movies watched outside Plex.
- Extended analytics tools (`get_fully_watched`, `get_watch_stats`, `get_user_stats`, `get_library_stats`, `get_popular_content`) now available in all server variants — previously these were only in the standalone Plex server.
- Migration guide (`docs/migration-guide.md`) for users upgrading from v1.0.x.
- Comprehensive test suite: 94 tests across 8 files covering tool registration, dispatch routing, graceful degradation, and constants validation.
- CI workflow with Node 20/22 matrix, security audit gating before publish.
- npm trusted publishing via OIDC (no stored tokens).

### Changed
- `npm start` / `npm run dev` now run the unified server instead of the Plex-only server.
- Minimum Node.js version raised from 18 to 20 (vitest 4.x requires `styleText` from `node:util`).
- Tool counts: Plex 19, Trakt 9, Arr 17, Write ops 9 = 45 base / 54 total.

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
