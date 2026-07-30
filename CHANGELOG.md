# Changelog

All notable changes to this project will be documented in this file.

## [1.3.0](https://github.com/niavasha/plex-mcp-server/compare/v1.2.0...v1.3.0) (2026-07-30)


### Added

* add get_active_sessions tool for active Plex streams ([47e4248](https://github.com/niavasha/plex-mcp-server/commit/47e424811b3a133b65a9f05efac1f98fe50914a8))
* get_active_sessions + multi-session HTTP transport (carries [#89](https://github.com/niavasha/plex-mcp-server/issues/89)) ([d52c934](https://github.com/niavasha/plex-mcp-server/commit/d52c9340a48f388cece0007ab609105e115839e1))
* multi-session HTTP transport + Dockerfile ([c6f760d](https://github.com/niavasha/plex-mcp-server/commit/c6f760db078efd96b23d1f71381b22e43f2e81b0))


### Fixed

* **docs:** correct the stale tool count and guard it with a test ([85f9d42](https://github.com/niavasha/plex-mcp-server/commit/85f9d42f78feaab1d1fc86b8a921b6e002416236))
* **get_active_sessions:** read Media as a list, add test coverage ([b4a1780](https://github.com/niavasha/plex-mcp-server/commit/b4a1780f30873f662f407f1641e4e99e3eb1cb26))
* **transport:** bound sessions and request bodies, repair idle expiry ([9746691](https://github.com/niavasha/plex-mcp-server/commit/9746691d4c05af237f14262cc38b37224d22c0ed))


### Documentation

* add get_active_sessions to README and CHANGELOG ([95b90d6](https://github.com/niavasha/plex-mcp-server/commit/95b90d6b5d92a4e7db9d83ce4eeeb3cab33211eb))
* correct the guidance on fixing a bad changelog entry ([30cdaa6](https://github.com/niavasha/plex-mcp-server/commit/30cdaa60aebca38fa9c19f479c5c5b5cbf54a130))
* expand CHANGELOG with Dockerfile and multi-session fix ([630404d](https://github.com/niavasha/plex-mcp-server/commit/630404de89b8cee27e320ccab91164158de5ef4d))


### Dependencies

* **deps:** bump axios from 1.18.1 to 1.19.0 in the production-dependencies group ([d03f9ed](https://github.com/niavasha/plex-mcp-server/commit/d03f9ed5423bbc791369388841bf74fca0096e1c))
* **deps:** bump axios in the production-dependencies group ([586d755](https://github.com/niavasha/plex-mcp-server/commit/586d755ab842e4462bf426c3c61de779676d98e3))
* **deps:** bump node from 22-slim to 26-slim in the docker group ([78cc8cb](https://github.com/niavasha/plex-mcp-server/commit/78cc8cb03d5bd2d74d5515cfafe1752e3b0ce28f))
* **deps:** bump node from 22-slim to 26-slim in the docker group ([186b201](https://github.com/niavasha/plex-mcp-server/commit/186b201996dfa3dbb6e2f4a0b5f6ead54cc98eb8))

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
