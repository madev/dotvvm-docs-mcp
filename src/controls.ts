import { cacheGet, cacheSet } from "./cache.js";

export type ControlCategory =
  | "builtin"
  | "builtin-autoui"
  | "bootstrap"
  | "bootstrap4"
  | "bootstrap5"
  | "businesspack"
  | "businesspack-messaging";

export interface ControlEntry {
  name: string;
  category: ControlCategory;
  prefix: string;
  repoPath: string;
}

const DISCOVERY_DIRS: {
  dir: string;
  category: ControlCategory;
  prefix: string;
}[] = [
  { dir: "Controls/builtin", category: "builtin", prefix: "dot" },
  { dir: "Controls/builtin-autoui", category: "builtin-autoui", prefix: "auto" },
  { dir: "Controls/bootstrap", category: "bootstrap", prefix: "bs" },
  { dir: "Controls/bootstrap4", category: "bootstrap4", prefix: "bs4" },
  { dir: "Controls/bootstrap5", category: "bootstrap5", prefix: "bs5" },
  { dir: "Controls/businesspack", category: "businesspack", prefix: "bp" },
  { dir: "Controls/businesspack-messaging", category: "businesspack-messaging", prefix: "bp" },
];

export const PREFIX_TO_CATEGORIES: Record<string, ControlCategory[]> = {
  dot: ["builtin"],
  auto: ["builtin-autoui"],
  bs: ["bootstrap"],
  bs4: ["bootstrap4"],
  bs5: ["bootstrap5"],
  bp: ["businesspack", "businesspack-messaging"],
};

const GITHUB_API_BASE =
  "https://api.github.com/repos/riganti/dotvvm-docs/contents";
const BRANCH = "4.0";

async function fetchDirectoryListing(dir: string): Promise<string[]> {
  const url = `${GITHUB_API_BASE}/${dir}?ref=${BRANCH}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error for ${dir}: ${res.status} ${res.statusText}`);
  }
  const items: { name: string; type: string }[] = await res.json();
  return items.filter((i) => i.type === "dir").map((i) => i.name);
}

export async function discoverControls(): Promise<ControlEntry[]> {
  const cached = await cacheGet("_registry");
  if (cached) {
    return JSON.parse(cached);
  }

  const entries: ControlEntry[] = [];

  for (const { dir, category, prefix } of DISCOVERY_DIRS) {
    try {
      const names = await fetchDirectoryListing(dir);
      for (const name of names) {
        entries.push({
          name,
          category,
          prefix,
          repoPath: `${dir}/${name}`,
        });
      }
    } catch (err) {
      // Log but continue — some directories may not exist
      console.error(`Warning: failed to discover ${dir}: ${err}`);
    }
  }

  await cacheSet("_registry", JSON.stringify(entries));
  return entries;
}

export function parseControlInput(
  input: string
): { name: string; prefix: string } | null {
  const match = input.match(/^([a-zA-Z0-9]+):(.+)$/);
  if (!match) return null;
  return { prefix: match[1].toLowerCase(), name: match[2] };
}
