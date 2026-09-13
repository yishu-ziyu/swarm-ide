// ============================================================================
// Tool System - Main Export
// ============================================================================

// Core types
export {
  buildTool,
  successResult,
  errorResult,
  type Tool,
  type ToolResult,
  type ToolProgressData,
  type ToolUseContext,
  type CanUseToolFn,
  type ToolCallOptions,
  type PermissionResult,
  type BaseToolDef,
  type BuiltTool,
} from "./Tool";

// Registry
export {
  globalToolRegistry,
  initializeToolRegistry,
  getToolRegistry,
  toolRequiresPermission,
  getPermissionDecision,
  type ToolPermissionContext,
  type PermissionMode,
} from "./registry";

// Built-in tools
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
  type AgentToolInput,
  type AgentToolOutput,
  type AgentDefinition,
  type BashToolInput,
  type BashToolOutput,
  type FileReadToolInput,
  type FileWriteToolInput,
  type EditToolInput,
  type SearchToolInput,
  type GlobToolInput,
  type TaskToolInput,
} from "./builtInTools";

// Initialize registry on module load - call this before using tools
let initialized = false;
export function initTools(): void {
  if (!initialized) {
    // Lazy initialization - registry will self-initialize on first use
    initialized = true;
  }
}
