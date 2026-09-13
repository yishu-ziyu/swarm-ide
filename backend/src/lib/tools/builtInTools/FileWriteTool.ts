import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions } from "../Tool";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// ============================================================================
// File Write Tool
// ============================================================================

const FileWriteToolSchema = z.object({
  path: z.string().describe("Path to the file to write"),
  content: z.string().describe("Content to write to the file"),
  createDirs: z.boolean().default(false).describe("Create parent directories if they don't exist"),
  append: z.boolean().default(false).describe("Append to existing file instead of overwriting"),
});

export type FileWriteToolInput = z.infer<typeof FileWriteToolSchema>;

const FileWriteToolDef = buildTool({
  name: "Write",
  description: "Write content to a file.",
  inputSchema: FileWriteToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => false,
  isDestructive: (input: FileWriteToolInput) => !input.append,

  async call(
    input: FileWriteToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { path, content, createDirs, append } = input;

    try {
      if (createDirs) {
        const dir = dirname(path);
        await mkdir(dir, { recursive: true });
      }

      const flag = append ? "a" : "w";
      await writeFile(path, content, { flag, encoding: "utf-8" });

      return successResult({
        path,
        bytesWritten: Buffer.byteLength(content, "utf-8"),
        linesWritten: content.split("\n").length,
        mode: append ? "appended" : "written",
      });

    } catch (err: any) {
      return errorResult(err.message);
    }
  },
});

export const FileWriteTool = FileWriteToolDef;

// ============================================================================
// File Edit Tool
// ============================================================================

const EditToolSchema = z.object({
  path: z.string().describe("Path to the file to edit"),
  oldString: z.string().describe("String to replace (exact match)"),
  newString: z.string().describe("Replacement string"),
});

export type EditToolInput = z.infer<typeof EditToolSchema>;

const EditToolDef = buildTool({
  name: "Edit",
  description: "Edit a file by replacing a specific string.",
  inputSchema: EditToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => false,
  isDestructive: () => false,

  async call(
    input: EditToolInput,
    _options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { path, oldString, newString } = input;

    try {
      const { readFile, writeFile } = await import("node:fs/promises");
      const content = await readFile(path, "utf-8");

      if (!content.includes(oldString)) {
        return errorResult(`String not found in file: ${oldString.slice(0, 50)}...`);
      }

      const newContent = content.replace(oldString, newString);
      await writeFile(path, newContent, "utf-8");

      return successResult({
        path,
        replacements: 1,
        oldLength: oldString.length,
        newLength: newString.length,
      });

    } catch (err: any) {
      return errorResult(err.message);
    }
  },
});

export const EditTool = EditToolDef;
