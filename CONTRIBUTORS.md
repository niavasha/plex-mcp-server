# Contributors

This project is better than it would have been because of the people below.
Thank you.

Listed in order of first contribution.

## Maintainer

- **Harry Manley** ([@niavasha](https://github.com/niavasha)) — author and maintainer

## Contributors

- **[@punkpeye](https://github.com/punkpeye)** — added the MCP server registry badge
  ([#1](https://github.com/niavasha/plex-mcp-server/pull/1)), the project's first
  outside contribution.

- **Robert Molenkamp** ([@rolo20](https://github.com/rolo20)) — built out the
  read-only Plex tool surface and hardened `export_library`
  ([#16](https://github.com/niavasha/plex-mcp-server/pull/16)), then designed the
  opt-in mutative tool set behind `PLEX_ENABLE_MUTATIVE_OPS`
  ([#17](https://github.com/niavasha/plex-mcp-server/pull/17)). The
  safe-by-default posture of the write operations is his design.

- **Jeremy Mulenex** ([@poedenon](https://github.com/poedenon)) — proposed and
  implemented the `get_active_sessions` tool, and diagnosed the multi-session
  HTTP transport bug that caused concurrent MCP clients to fail with
  `400 already initialized`
  ([#89](https://github.com/niavasha/plex-mcp-server/pull/89)). Correctly
  identified that a single shared `McpServer` instance cannot back multiple
  transports — the root cause behind needing a second server instance to run
  more than one agent.

- **[@warlyjr-cloud](https://github.com/warlyjr-cloud)** — declared MCP tool
  annotations (safety hints) across all 55 tools, so a client can tell a read
  from a write from an irreversible delete
  ([#117](https://github.com/niavasha/plex-mcp-server/pull/117)). Spotted that
  the server advertised no `readOnlyHint`/`destructiveHint` at all, which left
  every tool looking equally risky to an approval UI, and got the per-tool
  classification right first time.

## Adding yourself

If you've had a change merged and you're not listed here, that's an oversight
rather than a judgement — please open a PR adding yourself, or an issue and
we'll do it for you.

See [the Contributing section of the README](README.md#contributing) to get
started.
