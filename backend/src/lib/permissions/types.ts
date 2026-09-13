// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission modes that control how tools request and obtain permissions
 */
export type PermissionMode =
  | "default"   // Ask user for each dangerous operation
  | "bypass"   // Auto-allow all operations (no prompts)
  | "acceptEdits" // Auto-accept destructive edits without prompts
  | "dontAsk"  // Silent auto-deny dangerous operations
  | "plan"     // Plan mode - restrict non-read-only tools
  | "auto"     // Use classifier for auto-decisions
  | "bubble";  // Bubble permission requests to parent agent

/**
 * Result of a permission check
 */
export interface PermissionDecision {
  behavior: "allow" | "deny" | "ask" | "passthrough";
  updatedInput?: unknown;
  message?: string;
  reason?: string;
}

/**
 * Permission request for tracking
 */
export interface PermissionRequest {
  id: string;
  toolName: string;
  toolInput: unknown;
  context: PermissionContext;
  timestamp: Date;
  status: "pending" | "approved" | "denied" | "expired";
  response?: PermissionDecision;
}

/**
 * Context for permission checking
 */
export interface PermissionContext {
  workspaceId: string;
  agentId: string;
  agentType?: string;
  parentAgentId?: string;
  permissionMode: PermissionMode;
  dangerousOpsWhitelist?: string[];
  classifierConfig?: ClassifierConfig;
}

/**
 * Classifier configuration for auto mode
 */
export interface ClassifierConfig {
  enabled: boolean;
  model?: string;
  confidenceThreshold?: number;
}

/**
 * Tool permission requirements
 */
export interface ToolPermissionRequirement {
  toolName: string;
  dangerLevel: "none" | "low" | "medium" | "high" | "critical";
  requiresConfirmation: boolean;
  canAutoApprove: boolean;
  description: string;
}

// ============================================================================
// Permission Mode Descriptions
// ============================================================================

export const PERMISSION_MODE_DESCRIPTIONS: Record<PermissionMode, string> = {
  default: "询问模式 - 对危险操作弹出确认对话框",
  bypass: "绕过模式 - 自动允许所有操作，不弹窗",
  acceptEdits: "接受编辑模式 - 自动接受文件编辑操作",
  dontAsk: "静默拒绝模式 - 静默拒绝所有危险操作",
  plan: "计划模式 - 仅允许只读操作",
  auto: "自动模式 - 使用分类器自动决策",
  bubble: "冒泡模式 - 将权限请求发送给父Agent处理",
};

// ============================================================================
// Tool Danger Classifications
// ============================================================================

export const TOOL_DANGER_LEVELS: Record<string, ToolPermissionRequirement> = {
  Bash: {
    toolName: "Bash",
    dangerLevel: "high",
    requiresConfirmation: true,
    canAutoApprove: false,
    description: "执行Shell命令，可能造成系统级更改",
  },
  Write: {
    toolName: "Write",
    dangerLevel: "medium",
    requiresConfirmation: true,
    canAutoApprove: true,
    description: "写入文件，可能覆盖现有内容",
  },
  Edit: {
    toolName: "Edit",
    dangerLevel: "medium",
    requiresConfirmation: true,
    canAutoApprove: true,
    description: "编辑文件，修改现有内容",
  },
  Delete: {
    toolName: "Delete",
    dangerLevel: "high",
    requiresConfirmation: true,
    canAutoApprove: false,
    description: "删除文件，无法恢复",
  },
  Agent: {
    toolName: "Agent",
    dangerLevel: "medium",
    requiresConfirmation: true,
    canAutoApprove: true,
    description: "创建子Agent，可能产生副作用",
  },
  Read: {
    toolName: "Read",
    dangerLevel: "none",
    requiresConfirmation: false,
    canAutoApprove: true,
    description: "读取文件，安全操作",
  },
  Glob: {
    toolName: "Glob",
    dangerLevel: "none",
    requiresConfirmation: false,
    canAutoApprove: true,
    description: "查找文件，安全操作",
  },
  Search: {
    toolName: "Search",
    dangerLevel: "none",
    requiresConfirmation: false,
    canAutoApprove: true,
    description: "搜索内容，安全操作",
  },
  Task: {
    toolName: "Task",
    dangerLevel: "low",
    requiresConfirmation: false,
    canAutoApprove: true,
    description: "任务管理，低风险操作",
  },
};
