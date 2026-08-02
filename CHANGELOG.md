# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0](https://github.com/niavasha/plex-mcp-server/compare/v1.3.1...v1.4.0) (2026-08-02)


### Added

* declare MCP tool annotations (safety hints) for all advertised tools ([dc8859b](https://github.com/niavasha/plex-mcp-server/commit/dc8859b8a171a5804f088762a46c32eeef7d4ed4))


### Fixed

* make tool annotations safe-by-default ([ded995d](https://github.com/niavasha/plex-mcp-server/commit/ded995d84110fe940dd5c805d0c6092ee3aa7a5c))

## [1.3.1](https://github.com/niavasha/plex-mcp-server/compare/v1.3.0...v1.3.1) (2026-07-30)


### Fixed

* **ci:** dispatch the publish from the tag so provenance names the right commit ([1dfe9e0](https://github.com/niavasha/plex-mcp-server/commit/1dfe9e08273c2e40ab3137cbe235d3e49a7619c2))
* **ci:** publish from publish.yml only, so npm accepts the release ([839060e](https://github.com/niavasha/plex-mcp-server/commit/839060eaa3cb118427eface3155a00254ad54a8a))


### Documentation

* dedupe the released 1.3.0 changelog ([ff65d2f](https://github.com/niavasha/plex-mcp-server/commit/ff65d2f9502aeb26971b701e690cb854a9d70f70))

## [1.3.0](https://github.com/niavasha/plex-mcp-server/compare/v1.2.0...v1.3.0) (2026-07-30)


### Added

* **get_active_sessions** — returns currently active Plex streams: who is watching what, player state and platform, session location, transcode decisions and media quality. Contributed by [@poedenon](https://github.com/poedenon) ([47e4248](https://github.com/niavasha/plex-mcp-server/commit/47e424811b3a133b65a9f05efac1f98fe50914a8))
* **Multi-session HTTP transport** — each client now gets its own server instance and transport, so concurrent MCP clients no longer fail with `400 already initialized`. Diagnosed and implemented by [@poedenon](https://github.com/poedenon) ([c6f760d](https://github.com/niavasha/plex-mcp-server/commit/c6f760db078efd96b23d1f71381b22e43f2e81b0))
* **Dockerfile** — multi-stage build running as an unprivileged user, built and boot-tested in CI ([c6f760d](https://github.com/niavasha/plex-mcp-server/commit/c6f760db078efd96b23d1f71381b22e43f2e81b0))


### Fixed

* **get_active_sessions:** read `Media` as a list. The Plex API returns it as an array, so every media field previously resolved to `undefined` while still producing a well-formed response ([b4a1780](https://github.com/niavasha/plex-mcp-server/commit/b4a1780f30873f662f407f1641e4e99e3eb1cb26))
* **transport:** bound sessions and request bodies, and repair idle expiry. An unauthenticated `POST /mcp` could previously exhaust memory, and every session was torn down 300s after creation regardless of activity ([9746691](https://github.com/niavasha/plex-mcp-server/commit/9746691d4c05af237f14262cc38b37224d22c0ed))
* **docs:** correct the stale tool count and guard it with a test ([85f9d42](https://github.com/niavasha/plex-mcp-server/commit/85f9d42f78feaab1d1fc86b8a921b6e002416236))


### Documentation

* add `get_active_sessions` to the README, plus CONTRIBUTORS.md and docs/RELEASING.md ([95b90d6](https://github.com/niavasha/plex-mcp-server/commit/95b90d6b5d92a4e7db9d83ce4eeeb3cab33211eb))


### Dependencies

* bump axios from 1.18.1 to 1.19.0 ([586d755](https://github.com/niavasha/plex-mcp-server/commit/586d755ab842e4462bf426c3c61de779676d98e3))
* bump the Docker base image from node:22-slim to node:26-slim ([186b201](https://github.com/niavasha/plex-mcp-server/commit/186b201996dfa3dbb6e2f4a0b5f6ead54cc98eb8))

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
