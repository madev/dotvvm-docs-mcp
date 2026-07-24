# dotvvm-docs-mcp

An MCP (Model Context Protocol) server that exposes DotVVM UI control documentation to AI assistants. Documentation is sourced directly from the [`riganti/dotvvm-docs`](https://github.com/riganti/dotvvm-docs) GitHub repository (branch `4.0`) and cached locally for 30 days.

Published on npm: [`@madevsk/dotvvm-docs-mcp`](https://www.npmjs.com/package/@madevsk/dotvvm-docs-mcp).

> **Status:** Early prototype — not yet stable. Expect breaking changes.

## Prerequisites

- Node.js 18+ (native `fetch` required)

No manual install is needed — `npx` fetches and runs the package on demand.

## Quick start

The server is meant to be launched by an MCP client (Claude Code, Claude Desktop, etc.), which spawns it over stdio. See the integration sections below for the exact config.

To sanity-check that it runs:

```bash
npx -y @madevsk/dotvvm-docs-mcp
```

This starts the server on stdio. It does not print a prompt — this is expected, since MCP servers communicate over JSON-RPC on stdin/stdout. Press `Ctrl+C` to exit.

## Integrating with Claude Code

Add to your Claude Code MCP config (`.claude/settings.json` or global settings):

```json
{
  "mcpServers": {
    "dotvvm-docs": {
      "command": "npx",
      "args": ["-y", "@madevsk/dotvvm-docs-mcp"]
    }
  }
}
```

Or register it from the CLI:

```bash
claude mcp add dotvvm-docs -- npx -y @madevsk/dotvvm-docs-mcp
```

## Integrating with Claude Desktop

Add to `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "dotvvm-docs": {
      "command": "npx",
      "args": ["-y", "@madevsk/dotvvm-docs-mcp"]
    }
  }
}
```

Restart Claude Desktop after editing the config.

## MCP tools

| Tool | Description |
|------|-------------|
| `list_dotvvm_controls` | Lists all discovered controls. Accepts optional `category` or `prefix` filter. |
| `get_dotvvm_control_docs` | Returns composed Markdown docs for a control (description, HTML output, code samples, ViewModels). |
| `get_dotvvm_concept_docs` | Returns Markdown docs for a DotVVM framework concept page. Takes a `path` like `data-binding/value-binding` or `routing/overview`. |

## MCP resources

| Resource URI | Description |
|--------------|-------------|
| `dotvvm://concepts` | Index of all DotVVM concept documentation pages, grouped by category and subcategory. Read this to discover valid `path` values for `get_dotvvm_concept_docs`. |

Concept documentation covers framework topics such as data binding (value binding, resource binding, binding context), routing (parameters, localization, redirection), validation (client-side, extensibility), viewmodels (filters, protection, caching), control development (markup controls, code-only controls, properties), layout (master pages, SPA), security (authentication, authorization), localization, and diagnostics.

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
├── index.ts      # MCP server entry point, tool + resource definitions
├── controls.ts   # Control discovery via GitHub API + prefix resolution
├── concepts.ts   # Concept page discovery + index formatting
├── fetcher.ts    # Raw content fetcher + Markdown composition
└── cache.ts      # File-based disk cache (30-day TTL)
```

## Running from source (local development)

To hack on the server or run a local checkout instead of the published package:

```bash
git clone https://github.com/madev/dotvvm-docs-mcp.git
cd dotvvm-docs-mcp
npm install
npm run dev        # runs via tsx (no build step needed)
```

`npm run dev` starts the server on stdio. It does not print a prompt — this is expected, since MCP servers communicate over JSON-RPC on stdin/stdout.

Build and run the compiled output:

```bash
npm run build      # compiles TypeScript to dist/
npm start          # runs compiled output (node dist/index.js)
```

To point an MCP client at your local checkout instead of the published package:

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

## Data source

All documentation is fetched from:

- **Control directory listings:** `https://api.github.com/repos/riganti/dotvvm-docs/contents/Controls/{category}?ref=4.0`
- **Control raw content:** `https://raw.githubusercontent.com/riganti/dotvvm-docs/4.0/Controls/{category}/{ControlName}/`
- **Concept directory listings:** `https://api.github.com/repos/riganti/dotvvm-docs/contents/Pages/concepts?ref=4.0`
- **Concept raw content:** `https://raw.githubusercontent.com/riganti/dotvvm-docs/4.0/Pages/concepts/{category}/{page}.md`

Each control directory may contain `control.md`, `output.md`, and `sample{N}/` subdirectories with `page.dothtml`, `ViewModel.cs`, and `sample.md`. Concept pages are `.md` files organized into categories and subcategories.
