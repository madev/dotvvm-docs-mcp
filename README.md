# dotvvm-docs-mcp

An MCP (Model Context Protocol) server that exposes DotVVM UI control documentation to AI assistants. Documentation is sourced directly from the [`riganti/dotvvm-docs`](https://github.com/riganti/dotvvm-docs) GitHub repository (branch `4.0`) and cached locally for 30 days.

> **Status:** Early prototype — not yet stable. Expect breaking changes.
> **Not yet published to npm.** The `npx @madev/dotvvm-docs-mcp` install instructions below will work once the package is released.

## Prerequisites

- Node.js 18+ (native `fetch` required)
- npm

## Development setup

```bash
npm install
npm run dev        # runs via tsx (no build step needed)
```

`npm run dev` starts the server on stdio. It does not print a prompt — this is expected, since MCP servers communicate over JSON-RPC on stdin/stdout.

## Building

```bash
npm run build      # compiles TypeScript to dist/
npm start          # runs compiled output
```

## MCP tools

| Tool | Description |
|------|-------------|
| `list_dotvvm_controls` | Lists all discovered controls. Accepts optional `category` or `prefix` filter. |
| `get_dotvvm_control_docs` | Returns composed Markdown docs for a control (description, HTML output, code samples, ViewModels). |

### Control naming

DotVVM controls are identified by a tag prefix that maps to a namespace:

| Prefix | Namespace / Category |
|--------|----------------------|
| `dot:` | Built-in controls (`builtin`) |
| `auto:` | Auto UI controls (`builtin-autoui`) |
| `bs:` | Bootstrap 3 (`bootstrap`) |
| `bs4:` | Bootstrap 4 (`bootstrap4`) |
| `bs5:` | Bootstrap 5 (`bootstrap5`) |
| `bp:` | Business Pack + Messaging (`businesspack`, `businesspack-messaging`) |

Use `prefix:Name` syntax to disambiguate controls that exist in multiple namespaces — e.g. `dot:Button`, `bp:GridView`, `bs5:Alert`.

## Integrating with Claude Code

Add to your Claude Code MCP config (`.claude/settings.json` or global settings):

```json
{
  "mcpServers": {
    "dotvvm-docs": {
      "command": "npx",
      "args": ["-y", "@madev/dotvvm-docs-mcp"]
    }
  }
}
```

## Integrating with Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "dotvvm-docs": {
      "command": "npx",
      "args": ["-y", "@madev/dotvvm-docs-mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

### Local development

To use a local checkout instead of the published package:

```json
{
  "mcpServers": {
    "dotvvm-docs": {
      "command": "npx",
      "args": ["tsx", "/path/to/dotvvm-docs-mcp/src/index.ts"]
    }
  }
}
```

## Caching

Control discovery and documentation are cached to disk at:

```
~/.dotvvm-docs-mcp/cache/
├── _registry.json          # control list (from GitHub API)
├── builtin__Button.json    # per-control docs
└── ...
```

Cache TTL is **30 days**. To force a refresh, delete the relevant `.json` file or the entire cache directory.

## Project structure

```
src/
├── index.ts      # MCP server entry point, tool definitions
├── controls.ts   # Control discovery via GitHub API + prefix resolution
├── fetcher.ts    # Raw content fetcher + Markdown composition
└── cache.ts      # File-based disk cache (30-day TTL)
```

## Data source

All documentation is fetched from:

- **Directory listings:** `https://api.github.com/repos/riganti/dotvvm-docs/contents/Controls/{category}?ref=4.0`
- **Raw content:** `https://raw.githubusercontent.com/riganti/dotvvm-docs/4.0/Controls/{category}/{ControlName}/`

Each control directory may contain `control.md`, `output.md`, and `sample{N}/` subdirectories with `page.dothtml`, `ViewModel.cs`, and `sample.md`.
