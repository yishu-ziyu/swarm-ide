// ============================================================================
// Query Engine - AsyncGenerator for streaming message responses
// ============================================================================

import type { AgentContext } from "../agents/AgentContext";
import { getToolRegistry, type PermissionHandler, type PermissionContext } from "../permissions";
import { createPermissionHandler } from "../permissions/PermissionHandler";
import type { Tool } from "../tools/Tool";

// ============================================================================
// Types
// ============================================================================

export interface QueryMessage {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  role?: "user" | "assistant" | "system" | "tool";
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface QueryOptions {
  systemPrompt?: string;
  maxTurns?: number;
  temperature?: number;
  maxTokens?: number;
  tools?: Tool[];
  permissionContext?: PermissionContext;
  onToolCall?: (toolName: string, input: unknown) => void;
  onToolResult?: (toolName: string, result: unknown) => void;
  onToken?: (token: string) => void;
}

// ============================================================================
// Query Engine
// ============================================================================

export class QueryEngine {
  private context: AgentContext;
  private options: QueryOptions;
  private permissionHandler?: PermissionHandler;
  private toolRegistry = getToolRegistry();
  private abortController?: AbortController;

  constructor(context: AgentContext, options: QueryOptions = {}) {
    this.context = context;
    this.options = options;

    if (options.permissionContext) {
      this.permissionHandler = createPermissionHandler(options.permissionContext);
    }

    if (options.tools) {
      context.setToolPool(options.tools);
    }
  }

  /**
   * Main query loop - async generator
   */
  async *query(): AsyncGenerator<QueryMessage, void, unknown> {
    this.abortController = new AbortController();

    let turn = 0;
    const maxTurns = this.options.maxTurns || 20;

    // Build initial messages
    const messages = this.buildMessages();

    while (turn < maxTurns && !this.abortController.signal.aborted) {
      turn++;
      this.context.nextTurn();

      yield {
        type: "text",
        role: "system",
        content: `Turn ${turn}/${maxTurns}`,
        metadata: { turn },
      };

      // Simulate LLM response (mock implementation)
      const response = await this.generateResponse(messages);

      if (response.content) {
        yield {
          type: "text",
          role: "assistant",
          content: response.content,
        };
        messages.push({ role: "assistant", content: response.content });
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const toolCall of response.toolCalls) {
          yield {
            type: "tool_call",
            toolName: toolCall.name,
            toolInput: toolCall.input,
          };

          this.options.onToolCall?.(toolCall.name, toolCall.input);

          // Check permission if handler exists
          if (this.permissionHandler) {
            const decision = await this.permissionHandler.decide(toolCall.name, toolCall.input);

            if (decision.behavior === "deny") {
              yield {
                type: "tool_result",
                toolName: toolCall.name,
                toolResult: { success: false, error: decision.message || "Permission denied" },
                error: decision.message,
              };
              continue;
            }

            if (decision.behavior === "ask") {
              yield {
                type: "tool_result",
                toolName: toolCall.name,
                toolResult: { success: false, error: "Awaiting permission..." },
              };
              // In real impl, would wait for user response
              continue;
            }
          }

          // Execute tool
          const tool = this.toolRegistry.get(toolCall.name);
          if (!tool) {
            yield {
              type: "tool_result",
              toolName: toolCall.name,
              toolResult: { success: false, error: `Tool not found: ${toolCall.name}` },
              error: `Tool not found: ${toolCall.name}`,
            };
            continue;
          }

          try {
            const result = await tool.call(toolCall.input, {
              context: this.context.toToolUseContext(),
              canUseTool: (name) => this.context.getFilteredToolPool().some((t) => t.name === name),
              signal: this.abortController.signal,
            });

            yield {
              type: "tool_result",
              toolName: toolCall.name,
              toolInput: toolCall.input,
              toolResult: result,
            };

            this.options.onToolResult?.(toolCall.name, result);

            messages.push({
              role: "tool",
              content: JSON.stringify(result),
            });

          } catch (error) {
            yield {
              type: "error",
              error: error instanceof Error ? error.message : "Tool execution failed",
            };
          }
        }
      }

      if (response.done) {
        break;
      }
    }

    yield { type: "done" };
  }

  /**
   * Build messages array
   */
  private buildMessages(): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    // System prompt
    if (this.options.systemPrompt) {
      messages.push({ role: "system", content: this.options.systemPrompt });
    } else {
      messages.push({ role: "system", content: this.getDefaultSystemPrompt() });
    }

    // Context messages
    messages.push(...this.context.messages);

    return messages;
  }

  /**
   * Get default system prompt based on agent type
   */
  private getDefaultSystemPrompt(): string {
    const prompts: Record<string, string> = {
      coder: `You are a coding assistant. Write clean, efficient code following best practices.`,
      reviewer: `You are a code reviewer. Provide thorough but constructive feedback.`,
      researcher: `You are a research assistant. Gather accurate information.`,
      coordinator: `You are a coordinator. Orchestrate multiple agents to accomplish tasks.`,
    };

    return prompts[this.context.type] || prompts.coder;
  }

  /**
   * Generate LLM response (mock)
   */
  private async generateResponse(
    _messages: Array<{ role: string; content: string }>
  ): Promise<{
    content?: string;
    toolCalls?: Array<{ name: string; input: unknown }>;
    done?: boolean;
  }> {
    // Mock implementation - in production, call actual LLM
    const lastMessage = _messages[_messages.length - 1];
    const content = lastMessage?.content?.toLowerCase() || "";

    if (content.includes("hello") || content.includes("hi")) {
      return { content: "Hello! How can I help you?", done: true };
    }

    if (content.includes("exit") || content.includes("done")) {
      return { content: "Understood. Goodbye!", done: true };
    }

    return { content: `Processed: ${content.slice(0, 50)}...`, done: true };
  }

  /**
   * Stop the query
   */
  stop(): void {
    this.abortController?.abort();
  }

  /**
   * Get the context
   */
  getContext(): AgentContext {
    return this.context;
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createQueryEngine(
  context: AgentContext,
  options?: QueryOptions
): QueryEngine {
  return new QueryEngine(context, options);
}
