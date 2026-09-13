// ============================================================================
// System Context - System-level information for prompts
// ============================================================================

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface SystemContext {
  gitStatus?: GitStatus;
  currentDate: string;
  currentTime: string;
  currentDirectory: string;
  hostname: string;
  user: string;
  cacheBreaker: string;
}

export interface GitStatus {
  branch: string;
  isClean: boolean;
  hasChanges: boolean;
  staged: number;
  modified: number;
  untracked: number;
  commitsAhead: number;
  commitsBehind: number;
}

export interface UserContext {
  claudeMdFiles: string[];
  workingDirectory: string;
  projectType?: string;
}

// ============================================================================
// System Context Builder
// ============================================================================

class SystemContextBuilder {
  private cache: SystemContext | null = null;
  private cacheTime: number = 0;
  private cacheTimeout: number = 5000; // 5 seconds

  /**
   * Get system context
   */
  async getSystemContext(): Promise<SystemContext> {
    const now = Date.now();

    if (this.cache && now - this.cacheTime < this.cacheTimeout) {
      return this.cache;
    }

    const context: SystemContext = {
      currentDate: this.getCurrentDate(),
      currentTime: this.getCurrentTime(),
      currentDirectory: process.cwd(),
      hostname: await this.getHostname(),
      user: await this.getUser(),
      cacheBreaker: now.toString(),
    };

    // Git status (non-blocking)
    this.getGitStatus().then((gitStatus) => {
      context.gitStatus = gitStatus;
    });

    this.cache = context;
    this.cacheTime = now;

    return context;
  }

  /**
   * Get current date formatted
   */
  private getCurrentDate(): string {
    const now = new Date();
    return now.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  /**
   * Get current time formatted
   */
  private getCurrentTime(): string {
    const now = new Date();
    return now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  /**
   * Get hostname
   */
  private async getHostname(): Promise<string> {
    try {
      return require("node:os").hostname();
    } catch {
      return "unknown";
    }
  }

  /**
   * Get current user
   */
  private async getUser(): Promise<string> {
    try {
      const os = require("node:os");
      return os.userInfo().username;
    } catch {
      return "unknown";
    }
  }

  /**
   * Get git status
   */
  async getGitStatus(): Promise<GitStatus | undefined> {
    try {
      const { stdout } = await execAsync("git status --porcelain", {
        cwd: process.cwd(),
        timeout: 5000,
      });

      const { stdout: branchStdout } = await execAsync("git rev-parse --abbrev-ref HEAD", {
        cwd: process.cwd(),
        timeout: 5000,
      });

      const { stdout: diffStdout } = await execAsync("git diff --stat", {
        cwd: process.cwd(),
        timeout: 5000,
      });

      const lines = stdout.trim().split("\n").filter(Boolean);
      const staged = lines.filter((l) => l.startsWith("M") || l.startsWith("A")).length;
      const modified = lines.filter((l) => l.startsWith(" M") || l.startsWith("??")).length;
      const untracked = lines.filter((l) => l.startsWith("??")).length;

      return {
        branch: branchStdout.trim(),
        isClean: lines.length === 0,
        hasChanges: lines.length > 0,
        staged,
        modified,
        untracked,
        commitsAhead: 0,
        commitsBehind: 0,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Detect project type
   */
  async detectProjectType(dir: string): Promise<string | undefined> {
    try {
      const files = await readdir(dir);

      if (files.includes("package.json")) return "node";
      if (files.includes("Cargo.toml")) return "rust";
      if (files.includes("go.mod")) return "go";
      if (files.includes("requirements.txt") || files.includes("setup.py")) return "python";
      if (files.includes("pom.xml") || files.includes("build.gradle")) return "java";
      if (files.includes("Makefile")) return "c";
      if (files.includes("*.csproj")) return "csharp";

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Format system context for prompt
   */
  formatForPrompt(context: SystemContext): string {
    let prompt = `Current Date: ${context.currentDate}
Current Time: ${context.currentTime}
Current Directory: ${context.currentDirectory}
Hostname: ${context.hostname}
User: ${context.user}`;

    if (context.gitStatus) {
      const git = context.gitStatus;
      prompt += `\n\nGit Status:
  Branch: ${git.branch}
  Status: ${git.isClean ? "Clean" : "Has changes"}
  Staged: ${git.staged}
  Modified: ${git.modified}
  Untracked: ${git.untracked}`;
    }

    return prompt;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTime = 0;
  }
}

// ============================================================================
// User Context Builder
// ============================================================================

class UserContextBuilder {
  /**
   * Find Claude.md files in directory tree
   */
  async findClaudeMdFiles(dir: string, maxDepth: number = 3): Promise<string[]> {
    const results: string[] = [];

    async function search(currentDir: string, depth: number): Promise<void> {
      if (depth > maxDepth) return;

      try {
        const entries = await readdir(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(currentDir, entry.name);

          if (entry.name === "claude.md" || entry.name === ".claude.md") {
            results.push(fullPath);
          }

          if (entry.isDirectory() &&
              !entry.name.startsWith(".") &&
              entry.name !== "node_modules" &&
              entry.name !== ".git") {
            await search(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await search(dir, 0);
    return results;
  }

  /**
   * Get user context
   */
  async getUserContext(dir: string): Promise<UserContext> {
    const claudeMdFiles = await this.findClaudeMdFiles(dir);

    return {
      claudeMdFiles,
      workingDirectory: dir,
    };
  }

  /**
   * Format user context for prompt
   */
  formatForPrompt(context: UserContext): string {
    let prompt = "";

    if (context.claudeMdFiles.length > 0) {
      prompt += `\nClaude.md Files Found:\n`;
      for (const file of context.claudeMdFiles) {
        prompt += `  - ${file}\n`;
      }
    }

    if (context.projectType) {
      prompt += `\nProject Type: ${context.projectType}\n`;
    }

    return prompt;
  }
}

// ============================================================================
// Singleton instances
// ============================================================================

export const systemContextBuilder = new SystemContextBuilder();
export const userContextBuilder = new UserContextBuilder();

// ============================================================================
// Convenience exports
// ============================================================================

export async function getSystemContext(): Promise<SystemContext> {
  return systemContextBuilder.getSystemContext();
}

export async function getUserContext(dir: string): Promise<UserContext> {
  return userContextBuilder.getUserContext(dir);
}

export function formatSystemPrompt(): Promise<string> {
  return systemContextBuilder.getSystemContext().then((ctx) => systemContextBuilder.formatForPrompt(ctx));
}
