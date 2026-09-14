import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function resolveResearchNotePath(workspaceId: string, filename: string): string {
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    throw new Error("Note name must be a markdown file like notes.md");
  }
  const safe = path.basename(filename).trim();
  if (!/^[\w.\-]+\.md$/i.test(safe)) {
    throw new Error("Note name must be a markdown file like notes.md");
  }
  const root = path.resolve(process.cwd(), "research-output", workspaceId);
  const resolved = path.resolve(root, safe);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Note path escapes the research output directory");
  }
  return resolved;
}

export async function saveResearchNote(input: {
  workspaceId: string;
  filename: string;
  content: string;
}): Promise<{ path: string; bytes: number }> {
  const filePath = resolveResearchNotePath(input.workspaceId, input.filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, input.content, "utf-8");
  return { path: filePath, bytes: Buffer.byteLength(input.content, "utf-8") };
}
