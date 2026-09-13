import type { Tool } from "../tools/Tool";
import type { PermissionMode } from "../tools/registry";

// ============================================================================
// Agent Context - Isolated execution context for an agent
// ============================================================================

export interface AgentContextOptions {
  id: string;
  type: string;
  parentAgentId?: string;
  workspaceId: string;
  directive?: string;
  maxTurns?: number;
  allowedTools?: string[];
  deniedTools?: string[];
  model?: string;
  permissionMode?: PermissionMode;
  memoryScope?: "agent" | "workspace" | "team";
  background?: boolean;
}

export class AgentContext {
  public readonly id: string;
  public readonly type: string;
  public readonly parentAgentId?: string;
  public readonly workspaceId: string;
  public directive: string;
  public maxTurns: number;
  public allowedTools?: string[];
  public deniedTools?: string[];
  public model?: string;
  public permissionMode: PermissionMode;
  public memoryScope: "agent" | "workspace" | "team";
  public background: boolean;

  public messages: Array<{
    role: "user" | "assistant" | "system" | "tool";
    content: string;
  }> = [];

  public turns = 0;
  public continueSignal?: AbortSignal;
  public toolPool: Tool[] = [];

  /**
   * Alias for id to match ToolUseContext interface
   */
  get agentId(): string {
    return this.id;
  }

  /**
   * Convert to ToolUseContext compatible object
   */
  toToolUseContext(): { workspaceId: string; agentId: string; messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }>; continueSignal?: AbortSignal } {
    return {
      workspaceId: this.workspaceId,
      agentId: this.id,
      messages: this.messages,
      continueSignal: this.continueSignal,
    };
  }

  constructor(options: AgentContextOptions) {
    this.id = options.id;
    this.type = options.type;
    this.parentAgentId = options.parentAgentId;
    this.workspaceId = options.workspaceId;
    this.directive = options.directive || "";
    this.maxTurns = options.maxTurns || 20;
    this.allowedTools = options.allowedTools;
    this.deniedTools = options.deniedTools;
    this.model = options.model;
    this.permissionMode = options.permissionMode || "default";
    this.memoryScope = options.memoryScope || "workspace";
    this.background = options.background || false;
  }

  /**
   * Create a sub-agent context by cloning this context
   */
  clone(overrides: Partial<AgentContextOptions> = {}): AgentContext {
    const subContext = new AgentContext({
      id: overrides.id || `${this.id}_sub_${Date.now()}`,
      type: overrides.type || this.type,
      parentAgentId: this.id,
      workspaceId: this.workspaceId,
      directive: overrides.directive,
      maxTurns: overrides.maxTurns || this.maxTurns,
      allowedTools: overrides.allowedTools || this.allowedTools,
      deniedTools: overrides.deniedTools || this.deniedTools,
      model: overrides.model || this.model,
      permissionMode: overrides.permissionMode || this.permissionMode,
      memoryScope: overrides.memoryScope || this.memoryScope,
      background: overrides.background ?? this.background,
    });

    // Copy existing messages for context
    subContext.messages = [...this.messages];
    subContext.toolPool = [...this.toolPool];

    return subContext;
  }

  /**
   * Add a message to the context
   */
  addMessage(role: "user" | "assistant" | "system" | "tool", content: string): void {
    this.messages.push({ role, content });
  }

  /**
   * Increment turn counter
   */
  nextTurn(): number {
    this.turns += 1;
    return this.turns;
  }

  /**
   * Check if agent has exceeded max turns
   */
  hasExceededMaxTurns(): boolean {
    return this.turns >= this.maxTurns;
  }

  /**
   * Set the tool pool for this agent
   */
  setToolPool(tools: Tool[]): void {
    this.toolPool = tools;
  }

  /**
   * Get filtered tool pool based on allowed/denied lists
   */
  getFilteredToolPool(): Tool[] {
    let tools = this.toolPool;

    if (this.allowedTools && this.allowedTools.length > 0) {
      tools = tools.filter((t) => this.allowedTools!.includes(t.name));
    }

    if (this.deniedTools && this.deniedTools.length > 0) {
      tools = tools.filter((t) => !this.deniedTools!.includes(t.name));
    }

    return tools;
  }

  /**
   * Create abort signal for this context
   */
  createAbortSignal(): AbortController {
    const controller = new AbortController();
    this.continueSignal = controller.signal;
    return controller;
  }

  /**
   * Serialize context for storage/transmission
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      parentAgentId: this.parentAgentId,
      workspaceId: this.workspaceId,
      directive: this.directive,
      maxTurns: this.maxTurns,
      turns: this.turns,
      permissionMode: this.permissionMode,
      memoryScope: this.memoryScope,
      background: this.background,
      messageCount: this.messages.length,
    };
  }
}

export default AgentContext;
