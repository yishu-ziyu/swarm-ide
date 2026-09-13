import type { Tool, ToolUseContext, PermissionResult } from "./Tool";
import { buildTool, type BaseToolDef } from "./Tool";
import { AgentTool } from "./builtInTools/AgentTool";
import { BashTool } from "./builtInTools/BashTool";
import { FileReadTool, StatsTool } from "./builtInTools/FileReadTool";
import { FileWriteTool, EditTool } from "./builtInTools/FileWriteTool";
import { SearchTool } from "./builtInTools/SearchTool";
import { GlobTool } from "./builtInTools/GlobTool";
import { TaskTool } from "./builtInTools/TaskTool";

// ============================================================================
// Tool Registry
// ============================================================================

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private initialized = false;

  initialize(): void {
    if (this.initialized) return;

    this.register(AgentTool);
    this.register(BashTool);
    this.register(FileReadTool);
    this.register(FileWriteTool);
    this.register(SearchTool);
    this.register(GlobTool);
    this.register(TaskTool);

    this.initialized = true;
  }

  register<D extends BaseToolDef>(def: D): void {
    const tool = buildTool(def);
    this.tools.set(tool.name, tool);
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getEnabled(): Tool[] {
    return this.getAll().filter((tool) => tool.isEnabled());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getToolsForContext(context: ToolUseContext): Tool[] {
    return this.getEnabled().filter((tool) => {
      return true;
    });
  }

  assembleToolPool(
    allowedTools?: string[],
    deniedTools?: string[],
    mcpTools: Tool[] = []
  ): Tool[] {
    let tools = this.getEnabled();

    if (allowedTools && allowedTools.length > 0) {
      tools = tools.filter((t) => allowedTools.includes(t.name));
    }

    if (deniedTools && deniedTools.length > 0) {
      tools = tools.filter((t) => !deniedTools.includes(t.name));
    }

    if (mcpTools.length > 0) {
      const filteredMcpTools = mcpTools.filter((t) => !deniedTools?.includes(t.name));
      tools = [...tools, ...filteredMcpTools];
    }

    const seen = new Set<string>();
    tools = tools.filter((t) => {
      if (seen.has(t.name)) return false;
      seen.add(t.name);
      return true;
    });

    return tools.sort((a, b) => a.name.localeCompare(b.name));
  }

  getToolNames(): string[] {
    return this.getEnabled().map((t) => t.name);
  }

  clear(): void {
    this.tools.clear();
    this.initialized = false;
  }
}

// ============================================================================
// Global Registry Instance
// ============================================================================

export const globalToolRegistry = new ToolRegistry();

export function initializeToolRegistry(): void {
  globalToolRegistry.initialize();
}

export function getToolRegistry(): ToolRegistry {
  return globalToolRegistry;
}

// ============================================================================
// Tool Permission Checking
// ============================================================================

export interface ToolPermissionContext {
  workspaceId: string;
  agentId: string;
  permissionMode: PermissionMode;
  dangerousOpsWhitelist?: string[];
}

export type PermissionMode =
  | "default"
  | "bypass"
  | "acceptEdits"
  | "dontAsk"
  | "plan"
  | "auto"
  | "bubble";

export function toolRequiresPermission(
  tool: Tool,
  input: unknown,
  mode: PermissionMode
): boolean {
  if (mode === "bypass") return false;

  if (tool.isDestructive(input)) {
    if (mode === "dontAsk") return false;
    return true;
  }

  if (tool.isReadOnly(input)) {
    return false;
  }

  return tool.isDestructive(input);
}

export async function getPermissionDecision(
  tool: Tool,
  input: unknown,
  context: ToolPermissionContext
): Promise<PermissionResult> {
  const { permissionMode } = context;

  switch (permissionMode) {
    case "bypass":
      return { behavior: "allow" };

    case "dontAsk":
      if (tool.isDestructive(input)) {
        return { behavior: "deny", message: "Dangerous operation denied in dontAsk mode" };
      }
      return { behavior: "allow" };

    case "acceptEdits":
      return { behavior: "allow" };

    case "plan":
      if (!tool.isReadOnly(input)) {
        return { behavior: "deny", message: "Plan mode: non-read-only tools restricted" };
      }
      return { behavior: "allow" };

    case "bubble":
      return { behavior: "passthrough", message: "Permission request bubbled to parent" };

    case "auto":
      if (tool.isReadOnly(input)) {
        return { behavior: "allow" };
      }
      return { behavior: "ask" };

    case "default":
    default:
      return tool.checkPermissions(input, context as unknown as ToolUseContext);
  }
}

// ============================================================================
// Re-export built-in tools
// ============================================================================

export {
  AgentTool,
  BashTool,
  FileReadTool,
  FileWriteTool,
  EditTool,
  SearchTool,
  GlobTool,
  TaskTool,
  StatsTool,
};
