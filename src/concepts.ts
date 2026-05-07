import { cacheGet, cacheSet } from "./cache.js";

export interface ConceptPage {
  name: string;
  path: string;
  repoPath: string;
  category: string | null;
  subCategory: string | null;
}

export interface ConceptCategory {
  name: string;
  pages: string[];
  subCategories: { name: string; pages: string[] }[];
}

export interface ConceptRegistry {
  categories: ConceptCategory[];
  standalonePages: string[];
  allPages: ConceptPage[];
}

const CONCEPTS_BASE_DIR = "Pages/concepts";
const GITHUB_API_BASE =
  "https://api.github.com/repos/riganti/dotvvm-docs/contents";
const BRANCH = "4.0";

async function fetchDirectoryItems(
  dir: string
): Promise<{ name: string; type: string }[]> {
  const url = `${GITHUB_API_BASE}/${dir}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) {
    throw new Error(
      `GitHub API error for ${dir}: ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

export async function discoverConcepts(): Promise<ConceptRegistry> {
  const cached = await cacheGet("_concepts_registry");
  if (cached) return JSON.parse(cached);

  const registry: ConceptRegistry = {
    categories: [],
    standalonePages: [],
    allPages: [],
  };

  const topItems = await fetchDirectoryItems(CONCEPTS_BASE_DIR);

  for (const item of topItems) {
    if (item.type === "file" && item.name.endsWith(".md")) {
      const pageName = item.name.replace(/\.md$/, "");
      registry.standalonePages.push(pageName);
      registry.allPages.push({
        name: pageName,
        path: pageName,
        repoPath: `${CONCEPTS_BASE_DIR}/${item.name}`,
        category: null,
        subCategory: null,
      });
    } else if (item.type === "dir") {
      const category: ConceptCategory = {
        name: item.name,
        pages: [],
        subCategories: [],
      };

      let catItems: { name: string; type: string }[];
      try {
        catItems = await fetchDirectoryItems(
          `${CONCEPTS_BASE_DIR}/${item.name}`
        );
      } catch {
        console.error(`Warning: failed to list ${item.name}`);
        continue;
      }

      for (const catItem of catItems) {
        if (catItem.type === "file" && catItem.name.endsWith(".md")) {
          const pageName = catItem.name.replace(/\.md$/, "");
          category.pages.push(pageName);
          registry.allPages.push({
            name: pageName,
            path: `${item.name}/${pageName}`,
            repoPath: `${CONCEPTS_BASE_DIR}/${item.name}/${catItem.name}`,
            category: item.name,
            subCategory: null,
          });
        } else if (catItem.type === "dir") {
          const subCat: { name: string; pages: string[] } = {
            name: catItem.name,
            pages: [],
          };

          let subItems: { name: string; type: string }[];
          try {
            subItems = await fetchDirectoryItems(
              `${CONCEPTS_BASE_DIR}/${item.name}/${catItem.name}`
            );
          } catch {
            console.error(
              `Warning: failed to list ${item.name}/${catItem.name}`
            );
            continue;
          }

          for (const subItem of subItems) {
            if (subItem.type === "file" && subItem.name.endsWith(".md")) {
              const pageName = subItem.name.replace(/\.md$/, "");
              subCat.pages.push(pageName);
              registry.allPages.push({
                name: pageName,
                path: `${item.name}/${catItem.name}/${pageName}`,
                repoPath: `${CONCEPTS_BASE_DIR}/${item.name}/${catItem.name}/${subItem.name}`,
                category: item.name,
                subCategory: catItem.name,
              });
            }
          }

          if (subCat.pages.length > 0) {
            category.subCategories.push(subCat);
          }
        }
      }

      registry.categories.push(category);
    }
  }

  await cacheSet("_concepts_registry", JSON.stringify(registry));
  return registry;
}

export function resolveConceptPage(
  registry: ConceptRegistry,
  path: string
): ConceptPage | null {
  const normalized = path
    .replace(/\.md$/, "")
    .replace(/\\/g, "/")
    .toLowerCase();
  return (
    registry.allPages.find((p) => p.path.toLowerCase() === normalized) ?? null
  );
}

export function formatConceptIndex(registry: ConceptRegistry): string {
  const lines: string[] = ["# DotVVM Concept Documentation\n"];

  if (registry.standalonePages.length > 0) {
    lines.push("## Standalone Pages");
    for (const page of registry.standalonePages) {
      lines.push(`- ${page}`);
    }
    lines.push("");
  }

  lines.push("## Categories\n");
  for (const cat of registry.categories) {
    const totalPages =
      cat.pages.length +
      cat.subCategories.reduce((sum, sc) => sum + sc.pages.length, 0);
    lines.push(`### ${cat.name} (${totalPages} pages)\n`);
    for (const page of cat.pages) {
      lines.push(`- ${cat.name}/${page}`);
    }
    for (const sub of cat.subCategories) {
      lines.push(`\n**${sub.name}/**`);
      for (const page of sub.pages) {
        lines.push(`- ${cat.name}/${sub.name}/${page}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
