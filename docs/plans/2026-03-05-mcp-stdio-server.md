# MCP Stdio Server for Claude Desktop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the CellarBar MCP server work with Claude Desktop via stdio transport, while keeping the existing HTTP transport for Docker.

**Architecture:** Single `mcp/server.py` with configurable transport (env var). Docker Compose sets `TRANSPORT=http`; local runs default to stdio. Claude Desktop config points to `uv run mcp/server.py`.

**Tech Stack:** Same FastMCP server, `uv run` for dependency management (no manual pip install needed).

---

### Task 1: Make MCP Server Transport Configurable

**Files:**
- Modify: `mcp/server.py`
- Modify: `docker-compose.yml`

**What to build:**

Change the `if __name__` block in `mcp/server.py` to read transport from env:

```python
if __name__ == "__main__":
    transport = os.environ.get("MCP_TRANSPORT", "stdio")
    if transport == "http":
        mcp.run(
            transport="http",
            host="0.0.0.0",
            port=5178,
            path="/mcp",
        )
    else:
        mcp.run(transport="stdio")
```

Also add a PEP 723 inline script metadata block at the top of `mcp/server.py` (before the imports) so `uv run` can auto-install dependencies without needing a venv:

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["fastmcp>=2.0", "httpx>=0.28"]
# ///
```

In `docker-compose.yml`, add `MCP_TRANSPORT: http` to the mcp service's environment so Docker keeps using HTTP transport:

```yaml
  mcp:
    build: ./mcp
    environment:
      BACKEND_URL: http://backend:8000
      MCP_TRANSPORT: http
```

**Verify:**
- Docker: `docker compose up -d --build mcp` → logs show "Starting MCP server... with transport 'http'"
- Local: `cd mcp && uv run server.py` → should start in stdio mode (will hang waiting for stdin, that's correct — Ctrl+C to exit)

**Commit:** `feat: make MCP server transport configurable (stdio default, http for Docker)`

---

### Task 2: Claude Desktop Configuration

**Files:**
- Create: `mcp/README.md` (short setup instructions)

**What to build:**

Create `mcp/README.md` with the Claude Desktop config snippet:

```markdown
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

**Requirements:**
- `uv` installed (`pip install uv` or see https://docs.astral.sh/uv/)
- Backend running (`docker compose up -d postgres backend`)

The server auto-installs its Python dependencies via `uv run` — no manual pip install needed.
```

**Also:** Actually apply this config to the user's Claude Desktop config file. Read the existing config at `%APPDATA%\Claude\claude_desktop_config.json` first — if it exists, merge the cellarbar entry into the existing `mcpServers` object. If it doesn't exist, create it.

The config path on Windows is: `C:\Users\serel\AppData\Roaming\Claude\claude_desktop_config.json`

**Verify:** Restart Claude Desktop. The CellarBar MCP server should appear in the tools list.

**Commit:** `feat: add Claude Desktop MCP config and setup docs`
