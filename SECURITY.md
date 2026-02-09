# Security Policy

## Reporting Security Vulnerabilities

Please do **not** report security vulnerabilities through public GitHub issues.

Instead, use [GitHub Security Advisories](https://github.com/niavasha/plex-mcp-server/security) to report vulnerabilities privately.

Include:
- Description of the issue
- Steps to reproduce
- Impact assessment

## Security Practices

- API tokens (Plex, Sonarr, Radarr, Trakt) are read from environment variables and never logged
- No `eval()` or dynamic code execution
- All HTTP requests use timeouts
- Dependency vulnerabilities are scanned via CI (`npm audit`, CodeQL, TruffleHog)
- Dependabot auto-merges patch/minor dependency updates

## Out of Scope

- Plex Media Server vulnerabilities (report to [Plex](https://www.plex.tv/security/))
- MCP protocol vulnerabilities (report to [Anthropic](https://modelcontextprotocol.io/))
- Sonarr/Radarr vulnerabilities (report upstream)
