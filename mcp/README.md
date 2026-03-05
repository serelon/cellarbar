# CellarBar MCP Server

## Claude Desktop Setup

Add this to your Claude Desktop config (`%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "cellarbar": {
      "command": "uv",
      "args": ["run", "C:\\Users\\serel\\Code\\cellarbar\\mcp\\server.py"],
      "env": {
        "BACKEND_URL": "http://localhost:5177"
      }
    }
  }
}
```

## Requirements

- `uv` installed (https://docs.astral.sh/uv/)
- Backend running: `docker compose up -d postgres backend`

Dependencies are auto-installed by `uv run` via PEP 723 inline metadata.

## Transport Modes

- **stdio** (default): For Claude Desktop / Claude Code. Run directly or via `uv run`.
- **http**: For Docker. Set `MCP_TRANSPORT=http` (done automatically by docker-compose).
