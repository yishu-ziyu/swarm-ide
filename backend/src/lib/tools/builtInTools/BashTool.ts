import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions, type ToolProgressData } from "../Tool";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ============================================================================
// Bash Tool - Execute shell commands
// ============================================================================

const BashToolSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  cwd: z.string().optional().describe("Working directory for command execution"),
  timeout: z.number().default(60000).describe("Timeout in milliseconds"),
  env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
  background: z.boolean().default(false).describe("Run command in background"),
});

export type BashToolInput = z.infer<typeof BashToolSchema>;
export type BashToolOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
};

type BashProgress = ToolProgressData & {
  status: "running" | "completed" | "error";
  command?: string;
  duration?: number;
};

const BashToolDef = buildTool({
  name: "Bash",
  description: "Execute shell commands. Use for running build tools, git operations, npm scripts, and system operations.",
  inputSchema: BashToolSchema,
  outputSchema: z.any(),
  isReadOnly: (input: BashToolInput) => {
    const cmd = input.command.toLowerCase().trim();
    const readOnlyPatterns = [
      /^git\s+(status|log|diff|show|branch|tag)/,
      /^ls\b/,
      /^pwd/,
      /^cat\b/,
      /^head\b/,
      /^tail\b/,
      /^grep\b/,
      /^find\b/,
      /^echo\b/,
      /^which\b/,
      /^whoami\b/,
    ];
    return readOnlyPatterns.some((pattern) => pattern.test(cmd));
  },
  isDestructive: (input: BashToolInput) => {
    const cmd = input.command.toLowerCase().trim();
    const destructivePatterns = [
      /^rm\s+/,
      /^rmdir\b/,
      /^dd\b/,
      /^mkfs\b/,
      /^fdisk\b/,
      /^docker\s+rm/,
      /^kill\s+/,
      /^pkill\b/,
      /^killall\b/,
    ];
    return destructivePatterns.some((pattern) => pattern.test(cmd));
  },
  isConcurrencySafe: () => false,

  async call(
    input: BashToolInput,
    options: ToolCallOptions
  ): Promise<{ success: boolean; data?: BashToolOutput; error?: string }> {
    const { command, cwd, timeout = 60000, env } = input;
    const startTime = Date.now();

    try {
      options.onProgress?.({
        status: "running",
        command,
      } as BashProgress);

      const { stdout, stderr } = await execAsync(command, {
        cwd: cwd || process.cwd(),
        timeout,
        env: { ...process.env, ...env } as NodeJS.ProcessEnv,
        signal: options.signal as AbortSignal,
      });

      const duration = Date.now() - startTime;

      options.onProgress?.({
        status: "completed",
        command,
        duration,
      } as BashProgress);

      return successResult({
        stdout,
        stderr,
        exitCode: 0,
        duration,
      } as BashToolOutput);

    } catch (err: any) {
      const duration = Date.now() - startTime;
      const exitCode = err.exitCode || 1;
      const stdout = err.stdout || "";
      const stderr = err.stderr || err.message || "Unknown error";

      options.onProgress?.({
        status: "error",
        command,
        duration,
      } as BashProgress);

      return successResult({
        stdout,
        stderr,
        exitCode,
        duration,
      } as BashToolOutput);
    }
  },
});

export const BashTool = BashToolDef;
