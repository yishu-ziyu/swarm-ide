import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions } from "../Tool";
import { readFile } from "node:fs/promises";

// ============================================================================
// File Read Tool
// ============================================================================

const FileReadToolSchema = z.object({
  path: z.string().describe("Path to the file to read"),
  limit: z.number().optional().describe("Maximum number of lines to read"),
  offset: z.number().optional().describe("Starting line offset"),
  lineNumbers: z.boolean().default(false).describe("Show line numbers"),
});

export type FileReadToolInput = z.infer<typeof FileReadToolSchema>;

const FileReadToolDef = buildTool({
  name: "Read",
  description: "Read the contents of a file.",
  inputSchema: FileReadToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,

  async call(
    input: FileReadToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { path, limit, offset, lineNumbers } = input;

    try {
      const content = await readFile(path, "utf-8");
      let lines = content.split("\n");

      if (offset) {
        lines = lines.slice(offset);
      }

      if (limit) {
        lines = lines.slice(0, limit);
      }

      const result = {
        path,
        content: lines.join("\n"),
        linesRead: lines.length,
        totalLines: content.split("\n").length,
        lineNumbers: lineNumbers
          ? lines.map((l, i) => `${(offset || 0) + i + 1} | ${l}`).join("\n")
          : null,
        truncated: content.split("\n").length > (limit || Infinity),
      };

      return successResult(result);

    } catch (err: any) {
      return errorResult(err.code === "ENOENT" ? `File not found: ${path}` : err.message);
    }
  },
});

export const FileReadTool = FileReadToolDef;

// ============================================================================
// File Stats Tool
// ============================================================================

const FileStatsToolSchema = z.object({
  path: z.string().describe("Path to get file/directory stats"),
});

export type FileStatsToolInput = z.infer<typeof FileStatsToolSchema>;

const FileStatsToolDef = buildTool({
  name: "Stats",
  description: "Get file or directory statistics.",
  inputSchema: FileStatsToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,

  async call(
    input: FileStatsToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { path } = input;

    try {
      const { stat } = await import("node:fs/promises");
      const stats = await stat(path);
      return successResult({
        path,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        isSymlink: stats.isSymbolicLink(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        mode: stats.mode,
      });

    } catch (err: any) {
      return errorResult(err.code === "ENOENT" ? `Path not found: ${path}` : err.message);
    }
  },
});

export { FileStatsToolDef as StatsTool };
