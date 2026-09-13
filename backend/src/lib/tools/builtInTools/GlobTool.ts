import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions } from "../Tool";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

// ============================================================================
// Glob Tool - File pattern matching
// ============================================================================

const GlobToolSchema = z.object({
  pattern: z.string().describe("Glob pattern to match files"),
  cwd: z.string().optional().describe("Working directory for pattern matching"),
  maxResults: z.number().default(1000).describe("Maximum number of results"),
  includeDirs: z.boolean().default(false).describe("Include directories in results"),
  ignore: z.array(z.string()).optional().describe("Ignore patterns"),
});

export type GlobToolInput = z.infer<typeof GlobToolSchema>;

function globToRegex(pattern: string): RegExp {
  const parts = pattern.split(/[\/\\]/);
  let regexStr = "";

  for (const part of parts) {
    if (part === "**") {
      regexStr += "(?:.*/)?";
    } else if (part === "*") {
      regexStr += "[^/\\\\]*";
    } else {
      regexStr += part.replace(/[.+^${}()|[\]\\]/g, "\\$&") + "/?";
    }
  }

  return new RegExp(regexStr);
}

async function walkDir(
  dir: string,
  maxDepth: number,
  currentDepth: number,
  regex: RegExp,
  maxResults: number,
  results: string[],
  includeDirs: boolean
): Promise<void> {
  if (results.length >= maxResults) return;

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const fullPath = join(dir, entry.name);
      const relativePath = fullPath.replace(/\\/g, "/");

      if (regex.test(relativePath) || regex.test(entry.name)) {
        if (entry.isDirectory() && includeDirs) {
          results.push(relativePath);
        } else if (entry.isFile()) {
          results.push(relativePath);
        }
      }

      if (entry.isDirectory() && currentDepth < maxDepth) {
        await walkDir(fullPath, maxDepth, currentDepth + 1, regex, maxResults, results, includeDirs);
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

const GlobToolDef = buildTool({
  name: "Glob",
  description: "Find files matching a glob pattern.",
  inputSchema: GlobToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,

  async call(
    input: GlobToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { pattern, cwd = ".", maxResults = 1000, includeDirs = false } = input;

    try {
      const regex = globToRegex(pattern);
      const results: string[] = [];

      await walkDir(cwd, 20, 0, regex, maxResults, results, includeDirs);

      return successResult({
        pattern,
        cwd,
        files: results,
        totalFiles: results.length,
        returnedFiles: results.length,
        truncated: false,
      });

    } catch (err: any) {
      return errorResult(err.message);
    }
  },
});

export const GlobTool = GlobToolDef;
