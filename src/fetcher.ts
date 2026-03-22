import { cacheGet, cacheSet } from "./cache.js";

const RAW_BASE =
  "https://raw.githubusercontent.com/riganti/dotvvm-docs/4.0";

async function fetchRaw(path: string): Promise<string | null> {
  const res = await fetch(`${RAW_BASE}/${path}`);
  if (!res.ok) return null;
  return res.text();
}

export async function fetchControlDocs(
  repoPath: string,
  cacheKey: string
): Promise<string> {
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const parts: string[] = [];

  // Description
  const controlMd = await fetchRaw(`${repoPath}/control.md`);
  if (controlMd) {
    parts.push(`## Description\n\n${controlMd.trim()}`);
  }

  // HTML Output
  const outputMd = await fetchRaw(`${repoPath}/output.md`);
  if (outputMd) {
    parts.push(`## HTML Output\n\n${outputMd.trim()}`);
  }

  // Samples — probe sequentially until 404
  for (let i = 1; ; i++) {
    const sampleDir = `${repoPath}/sample${i}`;

    // Check if sample exists by trying sample.md or page.dothtml
    const sampleMd = await fetchRaw(`${sampleDir}/sample.md`);
    const pageDothtml = await fetchRaw(`${sampleDir}/page.dothtml`);

    if (!sampleMd && !pageDothtml) break;

    const sampleParts: string[] = [];

    // Try to get title from sample.json
    const sampleJson = await fetchRaw(`${sampleDir}/sample.json`);
    let title = `Sample ${i}`;
    if (sampleJson) {
      try {
        const meta = JSON.parse(sampleJson);
        if (meta.Title) title = meta.Title;
        else if (meta.title) title = meta.title;
      } catch {
        // ignore parse errors
      }
    }

    sampleParts.push(`### ${title}`);

    if (sampleMd) {
      sampleParts.push(sampleMd.trim());
    }

    if (pageDothtml) {
      sampleParts.push("**DotVVM Markup:**\n```dothtml\n" + pageDothtml.trim() + "\n```");
    }

    const viewModel = await fetchRaw(`${sampleDir}/ViewModel.cs`);
    if (viewModel) {
      sampleParts.push("**ViewModel:**\n```csharp\n" + viewModel.trim() + "\n```");
    }

    parts.push(sampleParts.join("\n\n"));
  }

  const composed = parts.join("\n\n---\n\n");
  await cacheSet(cacheKey, composed);
  return composed;
}

export async function fetchConceptDocs(
  repoPath: string,
  cacheKey: string
): Promise<string> {
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const content = await fetchRaw(repoPath);
  if (!content) {
    return "(Documentation content not found)";
  }

  // Replace relative image references with text notes (images can't render in MCP)
  const processed = content.replace(
    /!\[([^\]]*)\]\((?!https?:\/\/)([^)]+\.(?:png|jpg|jpeg|gif|svg))\)/gi,
    "[$1 — image: $2]"
  );

  await cacheSet(cacheKey, processed);
  return processed;
}
