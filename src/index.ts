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
import { fetchControlDocs, fetchConceptDocs } from "./fetcher.js";
import {
  discoverConcepts,
  resolveConceptPage,
  formatConceptIndex,
} from "./concepts.js";

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

// Resource: dotvvm://concepts
server.resource(
  "dotvvm-concepts",
  "dotvvm://concepts",
  {
    description:
      "Index of all DotVVM concept documentation pages — covers data binding, routing, validation, viewmodels, security, layout, control development, and more.",
    mimeType: "text/markdown",
  },
  async () => {
    const registry = await discoverConcepts();
    return {
      contents: [
        {
          uri: "dotvvm://concepts",
          mimeType: "text/markdown",
          text: formatConceptIndex(registry),
        },
      ],
    };
  }
);

// Tool 3: get_dotvvm_concept_docs
server.tool(
  "get_dotvvm_concept_docs",
  "Get documentation for a DotVVM framework concept. Use this when you need to understand how DotVVM works — topics include data binding (value binding, resource binding, binding context), routing (parameters, localization, redirection), validation (client-side, extensibility), viewmodels (filters, protection, caching), control development (markup controls, code-only controls, properties), layout (master pages, SPA), security (authentication, authorization), localization, diagnostics, and more. Use a path like 'data-binding/value-binding' or 'routing/overview'. Read the dotvvm://concepts resource first to see all available pages.",
  {
    path: z
      .string()
      .describe(
        'Concept page path, e.g. "data-binding/value-binding", "routing/overview", "viewmodels/filters/action-filters", or "server-side-rendering"'
      ),
  },
  async ({ path }) => {
    const registry = await discoverConcepts();
    const page = resolveConceptPage(registry, path);

    if (!page) {
      const searchTerm =
        path.toLowerCase().split("/").pop() ?? path.toLowerCase();
      const suggestions = registry.allPages
        .filter((p) => p.path.toLowerCase().includes(searchTerm))
        .slice(0, 10)
        .map((p) => `  - ${p.path}`);

      let msg = `Concept page "${path}" not found.`;
      if (suggestions.length > 0) {
        msg += `\n\nDid you mean one of these?\n${suggestions.join("\n")}`;
      } else {
        msg += `\n\nUse list_dotvvm_concepts or read the dotvvm://concepts resource to see all available pages.`;
      }

      return {
        content: [{ type: "text" as const, text: msg }],
        isError: true,
      };
    }

    const cacheKey = `concept__${page.path.replace(/\//g, "__")}`;
    const docs = await fetchConceptDocs(page.repoPath, cacheKey);

    const breadcrumb = page.category
      ? page.subCategory
        ? `${page.category} > ${page.subCategory} > ${page.name}`
        : `${page.category} > ${page.name}`
      : page.name;

    const header = `# ${page.name}\n**Path:** ${page.path}\n**Section:** ${breadcrumb}\n`;

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
