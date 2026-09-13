// ============================================================================
// Agent Runtime Bridge - Connects new Agent system with existing SSE infrastructure
// ============================================================================

import { getAgentManager, type AgentState } from "../agents/AgentManager";
import { getWorkspaceUIBus, type UIEvent } from "../../runtime/ui-bus";
import type { AgentMessage } from "../agents/AgentRunner";

// ============================================================================
// Types
// ============================================================================

export interface AgentStreamEvent {
  event: "agent.wakeup" | "agent.unread" | "agent.stream" | "agent.done" | "agent.error";
  data: Record<string, unknown>;
}

interface AgentActivity {
  agentId: string;
  workspaceId: string;
  groupId: string;
  round: number;
}

// ============================================================================
// Agent Runtime Bridge
// ============================================================================

class AgentRuntimeBridge {
  private activityStack: Map<string, AgentActivity> = new Map();

  /**
   * Initialize bridge - subscribe to AgentManager events
   */
  start(): void {
    const manager = getAgentManager();

    // Listen to agent state changes
    manager.onAgentStateChange((agentId, state) => {
      this.handleAgentStateChange(agentId, state);
    });
  }

  /**
   * Handle agent state change - emit appropriate UI events
   */
  private handleAgentStateChange(agentId: string, state: AgentState): void {
    const uiBus = getWorkspaceUIBus();

    switch (state.status) {
      case "running":
        // Agent started
        uiBus.emit(state.workspaceId, {
          event: "ui.agent.llm.start",
          data: {
            workspaceId: state.workspaceId,
            agentId,
            groupId: state.groupId || "",
            round: state.round || 0,
          },
        });

        // Track activity
        this.activityStack.set(agentId, {
          agentId,
          workspaceId: state.workspaceId,
          groupId: state.groupId || "",
          round: state.round || 0,
        });
        break;

      case "idle":
        // Agent finished
        const activity = this.activityStack.get(agentId);
        if (activity) {
          uiBus.emit(state.workspaceId, {
            event: "ui.agent.llm.done",
            data: {
              workspaceId: state.workspaceId,
              agentId,
              groupId: activity.groupId,
              round: activity.round,
              finishReason: "stop",
            },
          });
          this.activityStack.delete(agentId);
        }
        break;

      case "error":
        // Agent error
        uiBus.emit(state.workspaceId, {
          event: "ui.agent.error",
          data: {
            workspaceId: state.workspaceId,
            agentId,
            message: state.error || "Unknown error",
          },
        });
        break;
    }
  }

  /**
   * Emit tool call start event
   */
  emitToolCallStart(workspaceId: string, agentId: string, groupId: string, toolName: string): void {
    const uiBus = getWorkspaceUIBus();
    uiBus.emit(workspaceId, {
      event: "ui.agent.tool_call.start",
      data: {
        workspaceId,
        agentId,
        groupId,
        toolName,
      },
    });
  }

  /**
   * Emit tool call done event
   */
  emitToolCallDone(
    workspaceId: string,
    agentId: string,
    groupId: string,
    toolName: string,
    ok: boolean
  ): void {
    const uiBus = getWorkspaceUIBus();
    uiBus.emit(workspaceId, {
      event: "ui.agent.tool_call.done",
      data: {
        workspaceId,
        agentId,
        groupId,
        toolName,
        ok,
      },
    });
  }

  /**
   * Emit stream event for SSE
   */
  emitStreamEvent(agentId: string, event: string, data: Record<string, unknown>): void {
    // Emit to WorkspaceUIBus for local listeners
    const uiBus = getWorkspaceUIBus();
    const activity = this.activityStack.get(agentId);
    if (activity) {
      uiBus.emit(activity.workspaceId, {
        event: event as UIEvent["event"],
        data: {
          workspaceId: activity.workspaceId,
          agentId,
          ...data,
        },
      } as Omit<UIEvent, "id" | "at">);
    }
  }

  /**
   * Create agent via bridge
   */
  async createAgent(options: {
    workspaceId: string;
    creatorId: string;
    role: string;
    parentId?: string;
    groupId?: string;
  }): Promise<{ agentId: string; groupId: string }> {
    const manager = getAgentManager();

    const agent = await manager.createAgent({
      workspaceId: options.workspaceId,
      parentId: options.parentId || options.creatorId,
      role: options.role,
      permissionMode: "default",
    });

    // Emit UI event
    const uiBus = getWorkspaceUIBus();
    uiBus.emit(options.workspaceId, {
      event: "ui.agent.created",
      data: {
        workspaceId: options.workspaceId,
        agent: {
          id: agent.id,
          role: options.role,
          parentId: options.parentId || options.creatorId,
        },
      },
    });

    return {
      agentId: agent.id,
      groupId: agent.groupId || "",
    };
  }

  /**
   * Stop all agents in workspace
   */
  stopAllAgents(workspaceId: string): void {
    const manager = getAgentManager();
    const agents = manager.getAgentsByWorkspace(workspaceId);

    for (const agent of agents) {
      manager.stopAgent(agent.id);
    }

    // Emit interrupt event
    const uiBus = getWorkspaceUIBus();
    uiBus.emit(workspaceId, {
      event: "ui.agent.interrupt_all",
      data: {
        workspaceId,
        interrupted: agents.length,
        agentIds: agents.map((a) => a.id),
      },
    });
  }
}

// ============================================================================
// Singleton
// ============================================================================

let bridgeInstance: AgentRuntimeBridge | null = null;

export function getAgentRuntimeBridge(): AgentRuntimeBridge {
  if (!bridgeInstance) {
    bridgeInstance = new AgentRuntimeBridge();
    bridgeInstance.start();
  }
  return bridgeInstance;
}

export { AgentRuntimeBridge };
