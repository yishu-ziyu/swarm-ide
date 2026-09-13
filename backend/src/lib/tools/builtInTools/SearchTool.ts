import { z } from "zod";
import { buildTool, successResult, type ToolCallOptions } from "../Tool";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Search Tool (grep)
// ============================================================================

const SearchToolSchema = z.object({
  pattern: z.string().describe("Regex pattern to search for"),
  paths: z.array(z.string()).describe("Files or directories to search"),
  caseSensitive: z.boolean().default(false).describe("Case sensitive search"),
  matchesOnly: z.boolean().default(true).describe("Show only match lines"),
  lineNumbers: z.boolean().default(true).describe("Show line numbers"),
  maxMatches: z.number().default(100).describe("Maximum number of matches"),
  include: z.string().optional().describe("File glob pattern to include"),
  exclude: z.string().optional().describe("File glob pattern to exclude"),
});

export type SearchToolInput = z.infer<typeof SearchToolSchema>;

const SearchToolDef = buildTool({
  name: "Search",
  description: "Search for a pattern in files using regex.",
  inputSchema: SearchToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,

  async call(
    input: SearchToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const {
      pattern,
      paths,
      caseSensitive = false,
      matchesOnly = true,
      maxMatches = 100,
      include,
      exclude,
    } = input;

    try {
      const args = [
        "-n",
        ...(caseSensitive ? [] : ["-i"]),
        ...(matchesOnly ? ["-o"] : ["-n"]),
        "--max-count", maxMatches.toString(),
      ];

      if (include) {
        args.push("--include", include);
      }
      if (exclude) {
        args.push("--exclude", exclude);
      }

      args.push("-E", pattern);
      args.push(...paths);

      const { stdout, stderr } = await execAsync(`grep ${args.join(" ")}`, {
        maxBuffer: 10 * 1024 * 1024,
      });

      const matches = stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx === -1) return { line: "", text: line };
          return {
            line: line.slice(0, colonIdx),
            text: line.slice(colonIdx + 1),
          };
        });

      return successResult({
        pattern,
        matches,
        totalMatches: matches.length,
        paths,
      });

    } catch (err: any) {
      if (err.exitCode === 1) {
        return successResult({ pattern, matches: [], totalMatches: 0, paths });
      }
      return successResult({ pattern, matches: [], totalMatches: 0, paths, error: err.stderr || err.message });
    }
  },
});

export const SearchTool = SearchToolDef;
