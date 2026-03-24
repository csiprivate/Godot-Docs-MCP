# Godot Docs MCP

Local mirror and MCP server for the official Godot stable documentation.

## Contents

- `vendor/godot-docs`: local mirror of `godotengine/godot-docs` on branch `stable`
- `scripts/update-godot-docs.ps1`: refreshes the local mirror on Windows
- `scripts/update-godot-docs.sh`: refreshes the local mirror on Linux/macOS
- `scripts/search-godot-docs.ps1`: direct shell search helper on Windows
- `scripts/search-godot-docs.sh`: direct shell search helper on Linux/macOS
- `src/index.ts`: MCP server for Codex

## Setup

### Windows

```powershell
cd E:\Repos\godot-docs-mcp
npm install
npm run build
powershell -ExecutionPolicy Bypass -File scripts/update-godot-docs.ps1
```

### Linux / macOS

```bash
cd /path/to/godot-docs-mcp
npm install
npm run build
bash scripts/update-godot-docs.sh
```

## Codex MCP entry

### Windows

```toml
[mcp_servers.godot_docs]
command = "node"
args = ["E:\\Repos\\godot-docs-mcp\\build\\index.js"]

[mcp_servers.godot_docs.env]
GODOT_DOCS_REPO = "E:\\Repos\\godot-docs-mcp\\vendor\\godot-docs"
```

### Linux / macOS

```toml
[mcp_servers.godot_docs]
command = "node"
args = ["/path/to/godot-docs-mcp/build/index.js"]

[mcp_servers.godot_docs.env]
GODOT_DOCS_REPO = "/path/to/godot-docs-mcp/vendor/godot-docs"
```

Restart Codex after changing the config so the new MCP server is loaded.
