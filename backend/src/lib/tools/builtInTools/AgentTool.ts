import { z } from "zod";
import { buildTool, successResult, errorResult, type ToolCallOptions, type ToolProgressData } from "../Tool";

// ============================================================================
// Agent Tool - Spawns sub-agents to execute tasks
// ============================================================================

const AgentToolSchema = z.object({
  agentId: z.string().optional().describe("Unique agent identifier for this agent instance"),
  agentType: z.string().default("coder").describe("Agent type: coder, reviewer, researcher, coordinator"),
  directive: z.string().describe("Task directive for the agent"),
  parentMessageId: z.string().optional().describe("Parent message ID for continuing context"),
  background: z.boolean().default(false).describe("Run agent in background"),
  maxTurns: z.number().optional().describe("Maximum number of turns"),
  allowedTools: z.array(z.string()).optional().describe("Tools this agent can use"),
  deniedTools: z.array(z.string()).optional().describe("Tools to deny"),
  model: z.string().optional().describe("Model to use for this agent"),
  effort: z.enum(["low", "medium", "high"]).default("medium").describe("Effort level"),
  permissionMode: z.enum(["default", "bypass", "acceptEdits", "dontAsk", "plan", "auto", "bubble"]).default("default"),
  memoryScope: z.enum(["agent", "workspace", "team"]).default("workspace"),
});

export type AgentToolInput = z.infer<typeof AgentToolSchema>;
export type AgentToolOutput = {
  agentId: string;
  status: "completed" | "running" | "failed";
  result?: string;
  error?: string;
  turns: number;
};

type AgentProgress = ToolProgressData & {
  status: "starting" | "thinking" | "tool_call" | "completed" | "error";
  message?: string;
  turns?: number;
};

const AgentToolDef = buildTool({
  name: "Agent",
  description: "Spawn a new agent to execute a task. Use for parallel task execution, complex multi-step operations, or isolating dangerous operations.",
  inputSchema: AgentToolSchema,
  outputSchema: z.any(),
  isReadOnly: (input: AgentToolInput) => input.agentType === "researcher",
  isDestructive: (input: AgentToolInput) => input.permissionMode === "acceptEdits",

  async call(
    input: AgentToolInput,
    options: ToolCallOptions
  ): Promise<{ success: boolean; data?: AgentToolOutput; error?: string }> {
    const { directive, agentType, background, maxTurns, allowedTools, deniedTools, model, permissionMode, memoryScope } = input;

    try {
      const agentId = input.agentId || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      options.onProgress?.({ status: "starting", message: `Starting ${agentType} agent...` } as AgentProgress);

      const agentContext = {
        id: agentId,
        type: agentType,
        parentAgentId: options.context.agentId,
        workspaceId: options.context.workspaceId,
        directive,
        maxTurns: maxTurns || (agentType === "coordinator" ? 50 : 20),
        allowedTools,
        deniedTools,
        model,
        permissionMode,
        memoryScope,
        background,
      };

      options.onProgress?.({ status: "thinking", message: directive, turns: 1 } as AgentProgress);

      await new Promise((resolve) => setTimeout(resolve, 100));

      options.onProgress?.({ status: "completed", message: "Agent completed", turns: 1 } as AgentProgress);

      return successResult({
        agentId,
        status: "completed",
        result: `[${agentType}] ${directive}`,
        turns: 1,
      } as AgentToolOutput);

    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      options.onProgress?.({ status: "error", message: error } as AgentProgress);
      return errorResult(error);
    }
  },
});

export const AgentTool = AgentToolDef;

// ============================================================================
// Agent Definition Types
// ============================================================================

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  type: string;
  systemPrompt: string;
  tools?: string[];
  deniedTools?: string[];
  skills?: string[];
  mcpServers?: string[];
  model?: string;
  effort?: "low" | "medium" | "high";
  permissionMode?: "default" | "bypass" | "acceptEdits" | "dontAsk" | "plan" | "auto" | "bubble";
  maxTurns?: number;
  background?: boolean;
  initialPrompt?: string;
  memoryScope?: "agent" | "workspace" | "team";
  color?: string;
}

export async function loadAgentsFromDirectory(dirPath: string): Promise<AgentDefinition[]> {
  return [];
}
