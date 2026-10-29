# Changelog

All notable changes to this project will be documented in this file.

## [1.8.2](https://github.com/niavasha/plex-mcp-server/compare/v1.8.1...v1.8.2) (2026-10-29)


### Fixed

* follow-ups from the reviews of [#202](https://github.com/niavasha/plex-mcp-server/issues/202) and [#204](https://github.com/niavasha/plex-mcp-server/issues/204) ([ae3d2e9](https://github.com/niavasha/plex-mcp-server/commit/ae3d2e974c82f67807582c1603cb4e3b032f3585))
* page through watch history until enough rows match the type filter ([938b0f6](https://github.com/niavasha/plex-mcp-server/commit/938b0f68e4d5a802c6f4c3e60e9a4f4cfcb71506))

## [1.8.1](https://github.com/niavasha/plex-mcp-server/compare/v1.8.0...v1.8.1) (2026-10-29)

1.8.0 was tagged but never published to npm or ghcr.io: a moderate advisory for `@hono/node-server` (GHSA-rmxm-3fg6-px4f) appeared after its release PR passed CI, and the publish workflow's audit gate stopped it. 1.8.1 contains everything listed under 1.8.0 below, plus the fix.


### Fixed

* **deps:** bump @hono/node-server from 2.0.12 to 2.1.5 ([#206](https://github.com/niavasha/plex-mcp-server/issues/206)) ([1055e17](https://github.com/niavasha/plex-mcp-server/commit/1055e17b5b4a9b88031bce05956b2d247373f5c9))

## [1.8.0](https://github.com/niavasha/plex-mcp-server/compare/v1.7.0...v1.8.0) (2026-10-27)


### Added

* add Sonarr and Radarr tag management tools ([24ad2d6](https://github.com/niavasha/plex-mcp-server/commit/24ad2d6fc3ae64d8b1bc471a01727594d63675a9))
* include series type and tags in sonarr_get_series and radarr_get_movies ([1f258e9](https://github.com/niavasha/plex-mcp-server/commit/1f258e9f7e3c297b2326d81dfd87cb92a125c580))
* make the HTTP MCP path configurable via --path / MCP_PATH ([51f464e](https://github.com/niavasha/plex-mcp-server/commit/51f464e87840e9198276accf5ce157d5b12cafff))
* support assigning tags when adding series and movies ([df20daa](https://github.com/niavasha/plex-mcp-server/commit/df20daad652d68cc8acc173d8f3cef781a57aa02))
* support series type, cutoff-unmet search and more monitor options in sonarr_add_series ([d566535](https://github.com/niavasha/plex-mcp-server/commit/d5665359aec4495e39c273665e64b85873ec7fe1))


### Fixed

* accept a trailing slash on the MCP path and refuse non-ASCII paths ([0ccf3bd](https://github.com/niavasha/plex-mcp-server/commit/0ccf3bddc48a885ef6fedae20e74ebdd5bec8dee))
* add Radarr monitor option and drop invalid minimumAvailability value ([569ed5d](https://github.com/niavasha/plex-mcp-server/commit/569ed5dfa58a7782dbf143d3459eb1af7e5303db))
* **deps:** bump body-parser from 2.3.0 to 2.4.0 ([#192](https://github.com/niavasha/plex-mcp-server/issues/192)) ([3828ade](https://github.com/niavasha/plex-mcp-server/commit/3828ade2fc8a4bc39a45b21259607df51c3e82a1))
* **deps:** bump dotenv ([#181](https://github.com/niavasha/plex-mcp-server/issues/181)) ([3ef2aca](https://github.com/niavasha/plex-mcp-server/commit/3ef2aca9ba8d5c6e333dbe12202f768ffcc01db2))
* **deps:** bump fast-uri from 3.1.8 to 3.1.9 ([#189](https://github.com/niavasha/plex-mcp-server/issues/189)) ([0e29f28](https://github.com/niavasha/plex-mcp-server/commit/0e29f28839e197465b60912f03278e54f2aef38a))
* **deps:** bump follow-redirects from 1.16.0 to 1.16.1 ([#183](https://github.com/niavasha/plex-mcp-server/issues/183)) ([12d9214](https://github.com/niavasha/plex-mcp-server/commit/12d9214109c5797888ab599b8668fc761d4fd23b))
* **deps:** bump hono from 4.13.7 to 4.13.13 ([#182](https://github.com/niavasha/plex-mcp-server/issues/182)) ([bb85337](https://github.com/niavasha/plex-mcp-server/commit/bb85337ca39879f638fe1f044c7bf062b8aab1e1))
* **deps:** bump ip-address from 10.7.2 to 10.7.5 ([#191](https://github.com/niavasha/plex-mcp-server/issues/191)) ([c091423](https://github.com/niavasha/plex-mcp-server/commit/c091423d54c74f0fd27640766b3c98a5a529b563))
* **deps:** bump the production-dependencies group with 2 updates ([#195](https://github.com/niavasha/plex-mcp-server/issues/195)) ([27fe19b](https://github.com/niavasha/plex-mcp-server/commit/27fe19b15ca4263080596079fdb1061e60bcf50e))
* **deps:** bump zod from 3.25.64 to 4.6.7 ([#190](https://github.com/niavasha/plex-mcp-server/issues/190)) ([3e6a4ff](https://github.com/niavasha/plex-mcp-server/commit/3e6a4ff0e0700d163c727d36f0c6538bea4c9949))
* keep Sonarr/Radarr listings working without tags; clean up failed adds ([caf91fc](https://github.com/niavasha/plex-mcp-server/commit/caf91fce94da220ed18b75db7ff712af441fc419))
* only list write tools when PLEX_ENABLE_MUTATIVE_OPS is enabled ([5e00ba9](https://github.com/niavasha/plex-mcp-server/commit/5e00ba9274dfb525e5c75e47bc3ac0ccd8e02ada))
* page through Plex libraries larger than one page in Trakt sync ([2533aeb](https://github.com/niavasha/plex-mcp-server/commit/2533aebc1dcaceaeb5fd687999fb592f97998657))
* report the package version in the MCP handshake ([6ebea44](https://github.com/niavasha/plex-mcp-server/commit/6ebea44db7913de724bacb00b275351089d818e9))
* stop advertising obsolete latestSeason monitor type ([5fc5825](https://github.com/niavasha/plex-mcp-server/commit/5fc5825a6395e1226f0f062bb792342765bffdea))
* sync modern Plex agents to Trakt using Guid external ids ([696020e](https://github.com/niavasha/plex-mcp-server/commit/696020e3a7ac7d556507aff61326398441fd65b0))


### Documentation

* explain what searchForCutoffUnmetEpisodes does ([c85af29](https://github.com/niavasha/plex-mcp-server/commit/c85af294c00e2574f6707e0b996b62ba75875b66))

## [1.7.0](https://github.com/niavasha/plex-mcp-server/compare/v1.6.1...v1.7.0) (2026-10-18)


### Added

* **docker:** publish multi-arch image to ghcr.io on release ([#178](https://github.com/niavasha/plex-mcp-server/issues/178)) ([5917f0b](https://github.com/niavasha/plex-mcp-server/commit/5917f0b38d8cea70faeeb6411eaad8a5e15dcd57)), closes [#165](https://github.com/niavasha/plex-mcp-server/issues/165)


### Fixed

* **toon:** gate TOON on minified JSON for every module ([#176](https://github.com/niavasha/plex-mcp-server/issues/176)) ([394b819](https://github.com/niavasha/plex-mcp-server/commit/394b8192da23c04fae39cb5969029f1677afe754)), closes [#144](https://github.com/niavasha/plex-mcp-server/issues/144)


### Documentation

* state the TOON guarantee in characters and drop uncited savings figures ([#176](https://github.com/niavasha/plex-mcp-server/issues/176)) ([4b3f670](https://github.com/niavasha/plex-mcp-server/commit/4b3f6708efaa757c393988acd7f1027d3f7623c1))

## [1.6.1](https://github.com/niavasha/plex-mcp-server/compare/v1.6.0...v1.6.1) (2026-10-17)


### Fixed

* **deps:** bump @modelcontextprotocol/sdk ([#155](https://github.com/niavasha/plex-mcp-server/issues/155)) ([005e28d](https://github.com/niavasha/plex-mcp-server/commit/005e28dc706898f7fabf8b84ed387276e1244547))
* **deps:** bump @modelcontextprotocol/sdk ([#161](https://github.com/niavasha/plex-mcp-server/issues/161)) ([528f761](https://github.com/niavasha/plex-mcp-server/commit/528f7610a33e2a5964e53a1f322921d2a08bf885))
* **deps:** bump dotenv from 17.4.2 to 18.0.7 ([#168](https://github.com/niavasha/plex-mcp-server/issues/168)) ([0fc46ed](https://github.com/niavasha/plex-mcp-server/commit/0fc46edaeb7d86219306c3ac2916074a53de797a))
* **deps:** bump fast-uri from 3.1.7 to 3.1.8 ([#172](https://github.com/niavasha/plex-mcp-server/issues/172)) ([9f0e335](https://github.com/niavasha/plex-mcp-server/commit/9f0e33551ab8100edb262578080c61d40a4475a7))
* **deps:** bump hono from 4.13.1 to 4.13.7 ([#148](https://github.com/niavasha/plex-mcp-server/issues/148)) ([1531863](https://github.com/niavasha/plex-mcp-server/commit/1531863657add3ecaddc73d267a3217a59cd5b60))
* **deps:** bump ip-address from 10.4.0 to 10.7.2 ([#159](https://github.com/niavasha/plex-mcp-server/issues/159)) ([f561711](https://github.com/niavasha/plex-mcp-server/commit/f561711e462e562c5f3e4c76a8a8550224d6c638))
* **deps:** bump proxy-addr from 2.0.7 to 2.0.8 ([#170](https://github.com/niavasha/plex-mcp-server/issues/170)) ([cb22f48](https://github.com/niavasha/plex-mcp-server/commit/cb22f48064953203be9f939dfb60097c85f010fe))
* **deps:** bump the production-dependencies group with 2 updates ([#167](https://github.com/niavasha/plex-mcp-server/issues/167)) ([9854dd4](https://github.com/niavasha/plex-mcp-server/commit/9854dd4da18d87108804abf22a9337a6adcd3a33))


### Documentation

* note that a web-app Plex token is temporary ([#175](https://github.com/niavasha/plex-mcp-server/issues/175)) ([72c4ad5](https://github.com/niavasha/plex-mcp-server/commit/72c4ad55c2aa3cfc4960be87b3e6ea1958e7f0d2))
* update Plex token instructions to follow official Plex guide, thanks [@Shraymonks](https://github.com/Shraymonks) ([#164](https://github.com/niavasha/plex-mcp-server/issues/164)) ([44e27d3](https://github.com/niavasha/plex-mcp-server/commit/44e27d3d491c8af7ef73059b7b673e7b955afdde))

## [1.6.0](https://github.com/niavasha/plex-mcp-server/compare/v1.5.0...v1.6.0) (2026-09-03)


### Added

* add opt-in TOON output format for tool responses ([b4054af](https://github.com/niavasha/plex-mcp-server/commit/b4054af2aa2f27754f40f4f7e74dccfa587120d0))
* add opt-in TOON output format for tool responses ([afc8f78](https://github.com/niavasha/plex-mcp-server/commit/afc8f786c08fbcedee9ee49ea49e2cab1c4096c0))


### Fixed

* **deps:** bump axios in the production-dependencies group ([#138](https://github.com/niavasha/plex-mcp-server/issues/138)) ([9a5aee1](https://github.com/niavasha/plex-mcp-server/commit/9a5aee177ef2ca8b68fb5ce5b1474b1e202d63b2))
* **deps:** bump fast-uri from 3.1.5 to 3.1.7 ([#140](https://github.com/niavasha/plex-mcp-server/issues/140)) ([ab74f4b](https://github.com/niavasha/plex-mcp-server/commit/ab74f4bb297915859f1be214abf1142923203d05))
* **deps:** bump qs from 6.15.2 to 6.16.0 ([#142](https://github.com/niavasha/plex-mcp-server/issues/142)) ([afc4295](https://github.com/niavasha/plex-mcp-server/commit/afc42956cc2340d334a30dad34734ce4e812ed7f))
* **deps:** npm audit fix — fast-uri 3.1.7, qs 6.16.0 ([bf9883b](https://github.com/niavasha/plex-mcp-server/commit/bf9883b425ba3dc790dd441938d4a78c2669f0e7))

## [1.5.0](https://github.com/niavasha/plex-mcp-server/compare/v1.4.1...v1.5.0) (2026-08-20)


### Added

* add Plex media rating tool ([1f6cb40](https://github.com/niavasha/plex-mcp-server/commit/1f6cb40e4c3400b1c4c1c71dd15e96d9389c8d23))
* add Plex watch-state tools ([021b1b5](https://github.com/niavasha/plex-mcp-server/commit/021b1b524db071e8d0ccd6448817788ca5431f3b))


### Fixed

* resolve compilation and Dockerfile security warnings in CI ([8e4cf62](https://github.com/niavasha/plex-mcp-server/commit/8e4cf62823bcfe193142ca7f0e491bfbd66048ba))
* route account Watchlist through Plex Discover ([a8f6c02](https://github.com/niavasha/plex-mcp-server/commit/a8f6c02ceb9846998577adc766d10517fdb76965))


### Documentation

* add EHOSTUNREACH troubleshooting for macOS ([02b3f93](https://github.com/niavasha/plex-mcp-server/commit/02b3f93ffacb7230fa2799a24108234924e8adce))
* add Jaime Guajardo to contributors list ([e3a1756](https://github.com/niavasha/plex-mcp-server/commit/e3a17569ecfd64c98f921d106d503fe1bd635aca))

## [1.4.1](https://github.com/niavasha/plex-mcp-server/compare/v1.4.0...v1.4.1) (2026-08-08)


### Fixed

* **deps:** resolve dependency vulnerabilities ([b04e933](https://github.com/niavasha/plex-mcp-server/commit/b04e933268fc43ea56d0788314b90a910e9289bc))

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
