import type { AgentContext } from "./AgentContext";
import { getToolRegistry, type PermissionMode } from "../tools/registry";
import type { Tool, ToolResult } from "../tools/Tool";

// ============================================================================
// Agent Runner - Async generator for agent execution
// ============================================================================

export interface AgentMessage {
  type: "message" | "tool_call" | "tool_result" | "error" | "done";
  role?: "user" | "assistant" | "system" | "tool";
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: ToolResult;
  error?: string;
  agentId?: string;
}

export interface AgentRunnerOptions {
  context: AgentContext;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, result: ToolResult) => void;
  onMessage?: (message: AgentMessage) => void;
}

export type AgentMessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * AgentRunner - Core async generator for running an agent
 *
 * Usage:
 *   const runner = new AgentRunner(context);
 *   for await (const message of runner.run()) {
 *     console.log(message);
 *   }
 */
export class AgentRunner {
  private context: AgentContext;
  private systemPrompt?: string;
  private maxTokens: number;
  private temperature: number;
  private toolRegistry = getToolRegistry();

  // Callbacks
  private onToolCall?: (toolName: string, input: unknown) => void;
  private onToolResult?: (toolName: string, result: ToolResult) => void;
  private onMessage?: AgentMessageHandler;

  // State
  private abortController?: AbortController;
  private isRunning = false;

  constructor(options: AgentRunnerOptions) {
    this.context = options.context;
    this.systemPrompt = options.systemPrompt;
    this.maxTokens = options.maxTokens || 4096;
    this.temperature = options.temperature || 0.7;
    this.onToolCall = options.onToolCall;
    this.onToolResult = options.onToolResult;
    this.onMessage = options.onMessage;
  }

  /**
   * Run the agent - async generator
   */
  async *run(): AsyncGenerator<AgentMessage, void, unknown> {
    if (this.isRunning) {
      yield { type: "error", error: "Agent already running" };
      return;
    }

    this.isRunning = true;
    this.abortController = this.context.createAbortSignal();

    try {
      // Initialize tool pool
      const tools = this.context.getFilteredToolPool();
      this.context.setToolPool(tools);

      // Yield initial status
      yield {
        type: "message",
        role: "system",
        content: `Starting agent ${this.context.id} (${this.context.type})`,
        agentId: this.context.id,
      };

      // Build messages array
      const messages = this.buildMessages();

      // Main agent loop
      while (!this.context.hasExceededMaxTurns() && !this.abortController.signal.aborted) {
        const turn = this.context.nextTurn();

        // Generate response (mock implementation)
        const response = await this.generateResponse(messages);

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Handle tool calls
          for (const toolCall of response.toolCalls) {
            yield {
              type: "tool_call",
              toolName: toolCall.name,
              toolInput: toolCall.input,
              agentId: this.context.id,
            };

            this.onToolCall?.(toolCall.name, toolCall.input);

            // Execute tool
            const result = await this.executeTool(toolCall.name, toolCall.input);

            yield {
              type: "tool_result",
              toolName: toolCall.name,
              toolInput: toolCall.input,
              toolResult: result,
              agentId: this.context.id,
            };

            this.onToolResult?.(toolCall.name, result);

            // Add tool result to messages
            messages.push({
              role: "tool" as const,
              content: JSON.stringify(result),
            });
          }
        }

        if (response.message) {
          yield {
            type: "message",
            role: "assistant",
            content: response.message,
            agentId: this.context.id,
          };

          this.onMessage?.({
            type: "message",
            role: "assistant",
            content: response.message,
            agentId: this.context.id,
          });

          messages.push({
            role: "assistant" as const,
            content: response.message,
          });
        }

        // Check for completion
        if (response.done) {
          break;
        }
      }

      yield {
        type: "done",
        agentId: this.context.id,
      };

    } catch (error) {
      yield {
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: this.context.id,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Build messages array for LLM
   */
  private buildMessages(): Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }> {
    const messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }> = [];

    // System prompt
    if (this.systemPrompt) {
      messages.push({ role: "system", content: this.systemPrompt });
    } else {
      messages.push({
        role: "system",
        content: this.getDefaultSystemPrompt(),
      });
    }

    // Add existing context messages
    messages.push(...this.context.messages);

    // Add directive as user message if provided
    if (this.context.directive) {
      messages.push({ role: "user", content: this.context.directive });
    }

    return messages;
  }

  /**
   * Get default system prompt based on agent type
   */
  private getDefaultSystemPrompt(): string {
    const prompts: Record<string, string> = {
      coder: `You are a coding assistant agent. Your role is to help with programming tasks.

Available tools:
- Read: Read file contents
- Write: Write/create files
- Edit: Edit existing files
- Glob: Find files by pattern
- Search: Search in files
- Bash: Execute shell commands
- Task: Create and manage tasks

Write clean, well-documented code. Follow best practices.`,
      reviewer: `You are a code review agent. Your role is to review code changes and provide feedback.

Available tools:
- Read: Read file contents
- Search: Search in files
- Glob: Find files by pattern
- Bash: Execute commands for testing

Be thorough but constructive. Focus on:
- Code quality and readability
- Potential bugs or issues
- Security concerns
- Performance implications
- Best practices`,
      researcher: `You are a research agent. Your role is to gather information and analyze topics.

Available tools:
- Search: Search for patterns in files
- Glob: Find relevant files
- Read: Read file contents
- Bash: Execute research commands

Be thorough and accurate. Cite your sources.`,
      coordinator: `You are a coordinator agent. Your role is to orchestrate multiple agents working on complex tasks.

Available tools:
- Agent: Spawn sub-agents to handle subtasks
- Task: Create and track tasks
- Read: Read files for context
- Bash: Execute commands

Direct workers effectively. Synthesize results. Report progress clearly.`,
    };

    return prompts[this.context.type] || prompts.coder;
  }

  /**
   * Generate response from LLM (mock implementation)
   */
  private async generateResponse(
    _messages: Array<{ role: "user" | "assistant" | "system" | "tool"; content: string }>
  ): Promise<{
    message?: string;
    toolCalls?: Array<{ name: string; input: unknown }>;
    done?: boolean;
  }> {
    // Mock implementation - in real code, this would call an LLM
    // For now, we simulate simple responses

    const lastMessage = _messages[_messages.length - 1];

    if (!lastMessage) {
      return { message: "Hello! How can I help you?", done: true };
    }

    const content = lastMessage.content.toLowerCase();

    // Simple keyword-based responses for demo
    if (content.includes("hello") || content.includes("hi")) {
      return { message: "Hello! I'm ready to help. What would you like me to do?", done: true };
    }

    if (content.includes("exit") || content.includes("quit") || content.includes("done")) {
      return { message: "Understood. Finishing up.", done: true };
    }

    // Default: acknowledge and complete
    return {
      message: `Agent ${this.context.type} processed your request. Task completed.`,
      done: true,
    };
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(toolName: string, input: unknown): Promise<ToolResult> {
    const tool = this.toolRegistry.get(toolName);

    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    try {
      const result = await tool.call(input, {
        context: this.context.toToolUseContext(),
        canUseTool: (name: string) => {
          const filteredTools = this.context.getFilteredToolPool();
          return filteredTools.some((t) => t.name === name);
        },
        signal: this.abortController?.signal,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }
  }

  /**
   * Stop the agent
   */
  stop(): void {
    this.abortController?.abort();
  }

  /**
   * Check if agent is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Get agent context
   */
  get agentContext(): AgentContext {
    return this.context;
  }
}

export default AgentRunner;
