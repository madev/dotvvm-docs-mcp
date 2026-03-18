import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CACHE_DIR = join(homedir(), ".dotvvm-docs-mcp", "cache");
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface CacheEntry {
  fetchedAt: number;
  content: string;
}

function cacheFilePath(key: string): string {
  return join(CACHE_DIR, `${key}.json`);
}

export async function cacheGet(key: string): Promise<string | null> {
  try {
    const raw = await readFile(cacheFilePath(key), "utf-8");
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      return null;
    }
    return entry.content;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, content: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const entry: CacheEntry = { fetchedAt: Date.now(), content };
  await writeFile(cacheFilePath(key), JSON.stringify(entry), "utf-8");
}
