import { AgentContext, type AgentContextOptions } from "./AgentContext";
import { AgentRunner, type AgentRunnerOptions, type AgentMessage, type AgentMessageHandler } from "./AgentRunner";

// ============================================================================
// Agent Manager - Factory and lifecycle management for agents
// ============================================================================

export type AgentStatus = "idle" | "starting" | "running" | "completed" | "failed" | "stopped";

export interface AgentState {
  id: string;
  type: string;
  status: AgentStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  context: AgentContext;
  error?: string;
  messageCount: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  type: string;
  description: string;
  systemPrompt?: string;
  tools?: string[];
  deniedTools?: string[];
  skills?: string[];
  model?: string;
  effort?: "low" | "medium" | "high";
  permissionMode?: PermissionMode;
  maxTurns?: number;
  background?: boolean;
  memoryScope?: "agent" | "workspace" | "team";
  color?: string;
}

export type PermissionMode = "default" | "bypass" | "acceptEdits" | "dontAsk" | "plan" | "auto" | "bubble";

export interface CreateAgentOptions {
  type: string;
  directive?: string;
  parentAgentId?: string;
  workspaceId?: string;
  systemPrompt?: string;
  tools?: string[];
  deniedTools?: string[];
  model?: string;
  permissionMode?: PermissionMode;
  maxTurns?: number;
  background?: boolean;
  memoryScope?: "agent" | "workspace" | "team";
  onMessage?: (message: AgentMessage) => void;
}

type AgentEventHandler = (agentId: string, event: AgentMessage) => void;

/**
 * AgentManager - Manages agent lifecycle, registry, and coordination
 */
export class AgentManager {
  private agents: Map<string, AgentState> = new Map();
  private agentDefinitions: Map<string, AgentDefinition> = new Map();
  private eventHandlers: Set<AgentEventHandler> = new Set();
  private activeRunners: Map<string, AgentRunner> = new Map();

  // Singleton instance
  private static instance?: AgentManager;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  // ============================================================================
  // Agent Definitions
  // ============================================================================

  /**
   * Register an agent definition
   */
  registerAgentDefinition(definition: AgentDefinition): void {
    this.agentDefinitions.set(definition.id, definition);
  }

  /**
   * Get agent definition by type
   */
  getAgentDefinition(type: string): AgentDefinition | undefined {
    return this.agentDefinitions.get(type);
  }

  /**
   * Load built-in agent definitions
   */
  loadBuiltInAgents(): void {
    const builtInAgents: AgentDefinition[] = [
      {
        id: "coder",
        name: "Coder",
        type: "coder",
        description: "Coding assistant for implementing features and fixes",
        systemPrompt: "You are a coding assistant. Write clean, efficient code following best practices.",
        tools: ["Read", "Write", "Edit", "Glob", "Search", "Bash", "Task"],
        effort: "medium",
        permissionMode: "acceptEdits",
        maxTurns: 20,
        background: false,
      },
      {
        id: "reviewer",
        name: "Reviewer",
        type: "reviewer",
        description: "Code review agent for providing feedback",
        systemPrompt: "You are a code reviewer. Provide thorough but constructive feedback.",
        tools: ["Read", "Search", "Glob"],
        effort: "medium",
        permissionMode: "default",
        maxTurns: 15,
        background: false,
      },
      {
        id: "researcher",
        name: "Researcher",
        type: "researcher",
        description: "Research agent for gathering information",
        systemPrompt: "You are a research assistant. Gather accurate information and cite sources.",
        tools: ["Read", "Search", "Glob", "Bash"],
        effort: "high",
        permissionMode: "bypass",
        maxTurns: 30,
        background: true,
      },
      {
        id: "coordinator",
        name: "Coordinator",
        type: "coordinator",
        description: "Coordinator agent for managing multi-agent workflows",
        systemPrompt: `You are a coordinator. Your job is to:
- Break down complex tasks into subtasks
- Spawn specialized agents to handle subtasks
- Monitor progress and synthesize results
- Report completion to the user`,
        tools: ["Agent", "Task", "Read", "Bash"],
        effort: "high",
        permissionMode: "default",
        maxTurns: 50,
        background: false,
      },
    ];

    for (const agent of builtInAgents) {
      this.registerAgentDefinition(agent);
    }
  }

  // ============================================================================
  // Agent Lifecycle
  // ============================================================================

  /**
   * Create a new agent
   */
  createAgent(options: CreateAgentOptions): AgentState {
    const definition = this.getAgentDefinition(options.type);
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const contextOptions: AgentContextOptions = {
      id: agentId,
      type: options.type,
      parentAgentId: options.parentAgentId,
      workspaceId: options.workspaceId || "default",
      directive: options.directive,
      maxTurns: options.maxTurns || definition?.maxTurns || 20,
      allowedTools: options.tools || definition?.tools,
      deniedTools: options.deniedTools || definition?.deniedTools,
      model: options.model || definition?.model,
      permissionMode: options.permissionMode || definition?.permissionMode || "default",
      background: options.background ?? definition?.background ?? false,
      memoryScope: options.memoryScope || definition?.memoryScope || "workspace",
    };

    const context = new AgentContext(contextOptions);

    const state: AgentState = {
      id: agentId,
      type: options.type,
      status: "idle",
      createdAt: new Date(),
      context,
      messageCount: 0,
    };

    this.agents.set(agentId, state);

    return state;
  }

  /**
   * Start an agent
   */
  async startAgent(
    agentId: string,
    options?: { systemPrompt?: string; onMessage?: AgentMessageHandler }
  ): Promise<AsyncGenerator<AgentMessage, void, unknown>> {
    const state = this.agents.get(agentId);

    if (!state) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (state.status === "running") {
      throw new Error(`Agent already running: ${agentId}`);
    }

    state.status = "starting";
    state.startedAt = new Date();
    this.emitEvent(agentId, {
      type: "message",
      role: "system",
      content: `Starting agent ${agentId}`,
    });

    const runnerOptions: AgentRunnerOptions = {
      context: state.context,
      systemPrompt: options?.systemPrompt,
      onMessage: (msg) => {
        state.messageCount++;
        this.emitEvent(agentId, msg);
        options?.onMessage?.(msg);
      },
    };

    const runner = new AgentRunner(runnerOptions);
    this.activeRunners.set(agentId, runner);
    state.status = "running";

    // Wrap the generator to update state on completion
    const generator = runner.run();

    // Monitor for completion
    (async () => {
      try {
        for await (const _message of generator) {
          // Messages are already emitted via onMessage
        }
        state.status = "completed";
        state.completedAt = new Date();
      } catch (error) {
        state.status = "failed";
        state.error = error instanceof Error ? error.message : "Unknown error";
        state.completedAt = new Date();
      } finally {
        this.activeRunners.delete(agentId);
      }
    })();

    return runner.run();
  }

  /**
   * Stop an agent
   */
  stopAgent(agentId: string): void {
    const state = this.agents.get(agentId);
    const runner = this.activeRunners.get(agentId);

    if (runner) {
      runner.stop();
      this.activeRunners.delete(agentId);
    }

    if (state) {
      state.status = "stopped";
      state.completedAt = new Date();
    }
  }

  /**
   * Get agent state
   */
  getAgent(agentId: string): AgentState | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by workspace
   */
  getAgentsByWorkspace(workspaceId: string): AgentState[] {
    return this.getAllAgents().filter((a) => a.context.workspaceId === workspaceId);
  }

  /**
   * Get running agents
   */
  getRunningAgents(): AgentState[] {
    return this.getAllAgents().filter((a) => a.status === "running");
  }

  /**
   * Remove an agent
   */
  removeAgent(agentId: string): boolean {
    const runner = this.activeRunners.get(agentId);
    if (runner) {
      runner.stop();
      this.activeRunners.delete(agentId);
    }
    return this.agents.delete(agentId);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to agent events
   */
  onAgentEvent(handler: AgentEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit event to handlers
   */
  private emitEvent(agentId: string, event: AgentMessage): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(agentId, event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clear all agents
   */
  clear(): void {
    for (const [id] of this.activeRunners) {
      this.stopAgent(id);
    }
    this.agents.clear();
  }

  /**
   * Remove completed/stopped agents older than given date
   */
  pruneAgents(olderThan: Date): void {
    for (const [id, state] of this.agents) {
      if (state.completedAt && state.completedAt < olderThan) {
        this.agents.delete(id);
      }
    }
  }
}

// Export singleton getter
export function getAgentManager(): AgentManager {
  return AgentManager.getInstance();
}

export default AgentManager;
