#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  discoverControls,
  parseControlInput,
  PREFIX_TO_CATEGORIES,
  type ControlCategory,
  type ControlEntry,
} from "./controls.js";
import { fetchControlDocs } from "./fetcher.js";

const ALL_CATEGORIES: ControlCategory[] = [
  "builtin",
  "builtin-autoui",
  "bootstrap",
  "bootstrap4",
  "bootstrap5",
  "businesspack",
  "businesspack-messaging",
];

const server = new McpServer({
  name: "dotvvm-docs",
  version: "0.1.0",
});

// Tool 1: list_dotvvm_controls
server.tool(
  "list_dotvvm_controls",
  "List available DotVVM controls. Optionally filter by category or tag prefix.",
  {
    category: z
      .enum([
        "builtin",
        "builtin-autoui",
        "bootstrap",
        "bootstrap4",
        "bootstrap5",
        "businesspack",
        "businesspack-messaging",
      ])
      .optional()
      .describe("Filter by control category"),
    prefix: z
      .string()
      .optional()
      .describe('Filter by DotVVM tag prefix (e.g. "dot", "bp", "bs5")'),
  },
  async ({ category, prefix }) => {
    const allControls = await discoverControls();

    let filtered: ControlEntry[];

    if (category) {
      filtered = allControls.filter((c) => c.category === category);
    } else if (prefix) {
      const lowerPrefix = prefix.toLowerCase();
      const categories = PREFIX_TO_CATEGORIES[lowerPrefix];
      if (!categories) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown prefix "${prefix}". Valid prefixes: ${Object.keys(PREFIX_TO_CATEGORIES).join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      filtered = allControls.filter((c) => categories.includes(c.category));
    } else {
      filtered = allControls;
    }

    const result = filtered.map((c) => ({
      name: c.name,
      prefix: c.prefix,
      fullTag: `${c.prefix}:${c.name}`,
      category: c.category,
    }));

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(result, null, 2) },
      ],
    };
  }
);

// Tool 2: get_dotvvm_control_docs
server.tool(
  "get_dotvvm_control_docs",
  "Get documentation for a DotVVM control including description, HTML output, and code samples. Use prefix:Name syntax (e.g. dot:Button, bp:GridView, bs5:Alert) to disambiguate controls that exist in multiple namespaces.",
  {
    control: z
      .string()
      .describe(
        'Control name with optional prefix, e.g. "dot:Button", "bp:GridView", or just "Repeater"'
      ),
    category: z
      .enum([
        "builtin",
        "builtin-autoui",
        "bootstrap",
        "bootstrap4",
        "bootstrap5",
        "businesspack",
        "businesspack-messaging",
      ])
      .optional()
      .describe("Category to disambiguate when no prefix is used"),
  },
  async ({ control, category }) => {
    const allControls = await discoverControls();
    const parsed = parseControlInput(control);

    let matches: ControlEntry[];

    if (parsed) {
      // Prefix provided — resolve to specific categories
      const categories = PREFIX_TO_CATEGORIES[parsed.prefix];
      if (!categories) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown prefix "${parsed.prefix}". Valid prefixes: ${Object.keys(PREFIX_TO_CATEGORIES).join(", ")}`,
            },
          ],
          isError: true,
        };
      }
      matches = allControls.filter(
        (c) =>
          c.name.toLowerCase() === parsed.name.toLowerCase() &&
          categories.includes(c.category)
      );
    } else {
      // No prefix — search by name, optionally filtered by category
      const name = control.trim();
      matches = allControls.filter(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (category) {
        matches = matches.filter((c) => c.category === category);
      }
    }

    if (matches.length === 0) {
      // Suggest similar controls
      const searchName = (parsed?.name ?? control).toLowerCase();
      const suggestions = allControls
        .filter((c) => c.name.toLowerCase().includes(searchName))
        .slice(0, 10)
        .map((c) => `${c.prefix}:${c.name} (${c.category})`);

      let msg = `Control "${control}" not found.`;
      if (suggestions.length > 0) {
        msg += `\n\nDid you mean one of these?\n${suggestions.map((s) => `  - ${s}`).join("\n")}`;
      }

      return {
        content: [{ type: "text" as const, text: msg }],
        isError: true,
      };
    }

    if (matches.length > 1 && !parsed) {
      // Ambiguous — list all matches
      const options = matches
        .map((c) => `${c.prefix}:${c.name} (${c.category})`)
        .join(", ");
      return {
        content: [
          {
            type: "text" as const,
            text: `"${control}" exists in multiple namespaces: ${options}. Please specify which one using prefix:Name syntax.`,
          },
        ],
        isError: true,
      };
    }

    // If prefix matched multiple categories (bp:), fetch all and combine
    // But typically there's only one match per name+category
    const entry = matches[0];
    const cacheKey = `${entry.category}__${entry.name}`;

    const docs = await fetchControlDocs(entry.repoPath, cacheKey);

    const header = `# ${entry.prefix}:${entry.name}\n**Category:** ${entry.category}\n**Tag:** \`<${entry.prefix}:${entry.name}>\`\n`;

    return {
      content: [{ type: "text" as const, text: header + "\n" + docs }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
