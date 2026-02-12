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

### Changed
- `search_media` now supports `libraryKey`, `limit`, and `offset`.
- `export_library` now enforces safe export paths under `./exports`, handles write backpressure, captures stream errors earlier, and removes partial files on failure.
- Server entrypoints now load `.env` automatically via `dotenv/config`.

