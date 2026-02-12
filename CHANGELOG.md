# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Read-only Plex tools:
  - `get_library_items`
  - `export_library`
  - `get_playlists`
  - `get_playlist_items`
  - `get_watchlist`
  - `get_editable_fields`
- Opt-in mutative Plex tools (enabled with `PLEX_ENABLE_MUTATIVE_OPS=true`):
  - `update_metadata`
  - `update_metadata_from_json`
  - `create_playlist`
  - `add_to_playlist`
  - `remove_from_playlist`
  - `clear_playlist` (preview by default, apply when `confirm=true`)
  - `add_to_watchlist`
  - `remove_from_watchlist`

### Changed
- `search_media` now supports `libraryKey`, `limit`, and `offset`.
- `export_library` now enforces safe export paths under `./exports`, handles write backpressure, captures stream errors earlier, and removes partial files on failure.
- Server entrypoints now load `.env` automatically via `dotenv/config`.
- Mutative tool registration now uses shared `src/plex` schemas/registry and is conditionally exposed only when `PLEX_ENABLE_MUTATIVE_OPS=true`.
