import { store } from "@/lib/storage";
import { OpenAIStreamAssembler } from "@/lib/openai-stream";

import { AgentEventBus } from "./event-bus";
import { createDeferred, safeJsonParse } from "./utils";
import { getWorkspaceUIBus } from "./ui-bus";
import { getMcpRegistry } from "./mcp";
import { appendAgentHistorySnapshot, appendAgentLlmRequestRaw, appendAgentStreamEvent } from "./agent-logger";
import { formatSkillPrompt, getSkillLoader } from "./skill-loader";
import { getConfig, isHostBashAllowed } from "@/lib/config";
import { didSendSucceed } from "./delivery";
import { builtinToolHandlers } from "./builtin-tools";
import { processingStore } from "./processing-store";
import { formatResearchContext, researchStore } from "../research/research-store";
import {
  groupSendAllowed,
  peerMessageAllowed,
  type ParticipantRole,
} from "../research/protocol";

async function* parseSSEJsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB limit
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_BUFFER_SIZE) {
        throw new Error("SSE buffer exceeded 10MB limit");
      }

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            return;
          }
          try {
            yield JSON.parse(data);
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

type UUID = string;

type HistoryMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string;
      tool_calls?: unknown;
      reasoning_content?: string;
    }
  | { role: "tool"; content: string; tool_call_id?: string; name?: string };

type ToolCall = {
  index: number;
  id?: string;
  name?: string;
  argumentsText: string;
};

const SKILLS_MARKER = "[skills:loaded]";

async function buildSkillsBlock(): Promise<string> {
  try {
    const loader = await getSkillLoader();
    const skillsMetadata = await loader.getSkillsMetadataPrompt();
    const autoSkills = await loader.listAutoLoadSkills();
    const autoBlocks = autoSkills.map((skill) => formatSkillPrompt(skill)).join("\n\n");
    const skillsParts = [skillsMetadata, autoBlocks].filter((part) => part && part.trim());
    if (skillsParts.length === 0) return "";
    return `${SKILLS_MARKER}\n\n${skillsParts.join("\n\n")}`;
  } catch {
    return "";
  }
}

function historyHasSkills(history: HistoryMessage[]) {
  return history.some(
    (msg) =>
      msg.role === "system" && typeof msg.content === "string" && msg.content.includes(SKILLS_MARKER)
  );
}

function mapOpenRouterMessages(history: HistoryMessage[]): Array<Record<string, unknown>> {
  return history.map((msg) => {
    if (msg.role === "tool") return msg;

    const { reasoning_content, ...rest } = msg as Exclude<HistoryMessage, { role: "tool" }>;
    const mapped: Record<string, unknown> = { ...rest };

    if (msg.role === "assistant" && reasoning_content) {
      mapped.reasoning = reasoning_content;
    }

    return mapped;
  });
}

const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "create",
      description:
        "Create a sub-agent. In research mode this is orchestrator-worker: researchers need objective, outputFormat, sources, and boundaries so they do not duplicate search. Use role=reviewer or role=citation for the later phases.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: {
            type: "string",
            description: "Role name, e.g. researcher/reviewer/citation",
          },
          guidance: {
            type: "string",
            description: "Extra system guidance to seed the new agent.",
          },
          objective: {
            type: "string",
            description: "Research workers: the exact question this worker owns.",
          },
          outputFormat: {
            type: "string",
            description: "Research workers: required output shape, e.g. claims with evidenceIds.",
          },
          sources: {
            type: "string",
            description: "Research workers: allowed sources, e.g. peer-reviewed only.",
          },
          boundaries: {
            type: "string",
            description: "Research workers: what not to do, e.g. no news, no overlapping queries.",
          },
        },
        required: ["role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "self",
      description: "Return the current agent's identity (agent_id, workspace_id, role).",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_skill",
      description:
        "Load the full content of a specific skill by name (use when the skill metadata indicates relevance).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          skill_name: { type: "string", description: "Skill name to retrieve" },
        },
        required: ["skill_name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_agents",
      description: "List all agents in the current workspace (ids + roles).",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send",
      description:
        "Send a direct message to another agent_id. The IM storage (group) is created/selected automatically.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          to: { type: "string", description: "Target agent_id" },
          content: { type: "string", description: "Message content" },
        },
        required: ["to", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_groups",
      description: "List visible groups for this agent.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_group_members",
      description: "List member ids for a group.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          groupId: { type: "string", description: "Target group id" },
        },
        required: ["groupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_group",
      description: "Create a group with the given member ids.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          memberIds: { type: "array", items: { type: "string" } },
          name: { type: "string" },
        },
        required: ["memberIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_group_message",
      description: "Send a message to a group.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          groupId: { type: "string" },
          content: { type: "string" },
          contentType: { type: "string" },
        },
        required: ["groupId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_direct_message",
      description:
        "Send a direct message to another agent. Creates or reuses a P2P group and returns the channel type.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          toAgentId: { type: "string" },
          content: { type: "string" },
          contentType: { type: "string" },
        },
        required: ["toAgentId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_group_messages",
      description: "Fetch full message history for a group.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          groupId: { type: "string" },
        },
        required: ["groupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bash",
      description:
        "Run a shell command on the server. Returns stdout/stderr/exitCode. Use for debugging or file operations.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          cwd: { type: "string", description: "Working directory (relative to workspace root or absolute)" },
          timeoutMs: { type: "number", description: "Timeout in milliseconds (default 120000)" },
          maxOutputKB: { type: "number", description: "Maximum combined output size in KB (default 1024)" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_papers",
      description:
        "Search academic papers via Semantic Scholar. Default literature tool. Returns authors, year, abstract excerpt, URL, and evidence IDs. Use this for papers, methods, and citations. Do not use web_search for papers.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description: "Paper title, authors, methods, or research question.",
          },
          maxResults: {
            type: "number",
            description: "Maximum papers to return (default 8, max 20)",
          },
          yearFrom: {
            type: "number",
            description: "Only papers published this year or later",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the open web via Tavily (MCP). For news and non-academic pages only. For papers, use search_papers.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: {
            type: "string",
            description:
              "Search query (natural language or keywords; may include paper title, author, or DOI)",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results to return (default 8, max 20)",
          },
          topic: {
            type: "string",
            enum: ["general", "news"],
            description: "'general' for literature/web search, 'news' for recent events",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_claim",
      description:
        "Record a research conclusion and attach evidence IDs from search_papers (preferred) or web_search. Claims without evidence stay unverified and cannot enter the final report.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          statement: { type: "string", description: "The conclusion in one or two sentences." },
          evidenceIds: {
            type: "array",
            items: { type: "string" },
            description: "Evidence / citation IDs that support this conclusion.",
          },
        },
        required: ["statement"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_research_board",
      description:
        "Read the shared research board: question, phase, claims, evidence, unused excerpts, reviews. During isolate, workers only see their own writes.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "review_claim",
      description:
        "Reviewer-only. Post CHALLENGE, ALTERNATIVE, or VERIFIED on a claim. Reviewers should not have searched that claim themselves.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimId: { type: "string" },
          verdict: { type: "string", enum: ["CHALLENGE", "ALTERNATIVE", "VERIFIED"] },
          note: { type: "string", description: "Why, citing evidence IDs when possible." },
        },
        required: ["claimId", "verdict", "note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "align_claim_evidence",
      description:
        "Citation phase. Attach evidence IDs (source excerpts) to a claim. Claims with no excerpt stay unverified.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          claimId: { type: "string" },
          evidenceIds: { type: "array", items: { type: "string" } },
        },
        required: ["claimId", "evidenceIds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "advance_research_phase",
      description:
        "Lead-only. Move isolate → review → cite → commit. Commit is allowed only after review and citation alignment. Then the lead may message the human.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "fetch_source",
      description:
        "Fetch a paper or web page and store an excerpt as evidence. Use after search_papers when you need more text from a specific URL.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string", description: "http(s) URL to fetch" },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_research_note",
      description:
        "Save a markdown note into this workspace's research-output folder. Filename must end with .md.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          filename: { type: "string" },
          content: { type: "string" },
        },
        required: ["filename", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "export_report",
      description:
        "Build the current research report markdown from verified claims, papers, and unused evidence.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
] as const;

const BUILTIN_TOOL_NAMES = new Set(AGENT_TOOLS.map((tool) => tool.function.name));

// 工具缓存，避免每次请求重新加载MCP
let cachedTools: Array<{ type: string; function: Record<string, unknown> }> | null = null;
let toolsCacheTime = 0;
const TOOLS_CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

async function getAgentTools() {
  const now = Date.now();
  if (cachedTools && now - toolsCacheTime < TOOLS_CACHE_TTL) {
    return cachedTools;
  }

  const loadTimeoutMs =
    Number(process.env.MCP_LOAD_TIMEOUT_MS) > 0 ? Number(process.env.MCP_LOAD_TIMEOUT_MS) : 2000;
  const mcp = await getMcpRegistry(BUILTIN_TOOL_NAMES, { loadTimeoutMs });
  const mcpTools = mcp.getToolDefinitions();
  cachedTools = [...AGENT_TOOLS, ...mcpTools];
  toolsCacheTime = now;
  return isHostBashAllowed()
    ? cachedTools
    : cachedTools.filter((tool) => tool.function.name !== "bash");
}

// 主动刷新工具缓存（当MCP配置变更时调用）
export function invalidateToolsCache() {
  cachedTools = null;
  toolsCacheTime = 0;
}

type LlmProvider = "openrouter" | "ark" | "minimax";

function getLlmProvider(): LlmProvider {
  const config = getConfig();
  const raw = (config.llmProvider ?? process.env.LLM_PROVIDER ?? "minimax").toLowerCase();
  if (raw === "openrouter" || raw === "open-router" || raw === "or") return "openrouter";
  if (raw === "minimax") return "minimax";
  return "ark";
}

function normalizeOpenRouterUrl(value: string) {
  if (!value) return "https://openrouter.ai/api/v1/chat/completions";
  if (value.endsWith("/chat/completions")) return value;
  if (value.endsWith("/api/v1")) return `${value}/chat/completions`;
  if (value.endsWith("/v1")) return `${value}/chat/completions`;
  return value;
}

function isValidApiKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return Boolean(trimmed && !trimmed.includes("YOUR_") && !trimmed.includes("your-api-key"));
}

function getOpenRouterConfig() {
  const config = getConfig();
  const apiKey = (isValidApiKey(config.openRouterApiKey) ? config.openRouterApiKey : null) ?? process.env.OPENROUTER_API_KEY ?? "";
  const baseUrl = normalizeOpenRouterUrl(
    config.openRouterBaseUrl ?? process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1/chat/completions"
  );
  const model = config.openRouterModel ?? process.env.OPENROUTER_MODEL ?? "";
  const httpReferer = process.env.OPENROUTER_HTTP_REFERER ?? "";
  const appTitle = process.env.OPENROUTER_APP_TITLE ?? "";

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  return { apiKey, baseUrl, model, httpReferer, appTitle };
}

function getArkConfig() {
  const config = getConfig();
  const apiKey = (isValidApiKey(config.arkApiKey) ? config.arkApiKey : null) ?? process.env.ARK_API_KEY ?? "";
  const baseUrl = config.arkBaseUrl ?? process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/coding/v3";
  const model = config.arkModel ?? process.env.ARK_MODEL ?? "kimi-k2.5";

  if (!apiKey) {
    throw new Error("Missing ARK API key (set ARK_API_KEY)");
  }

  return { apiKey, baseUrl, model };
}

class AgentRunner {
  private wake = createDeferred<void>();
  private started = false;
  private running = false;
  private stopped = false;
  private interruptRequested = false;
  private workAbort: AbortController | null = null;

  constructor(
    private readonly agentId: UUID,
    private readonly bus: AgentEventBus,
    private readonly ensureRunner: (agentId: UUID) => void,
    private readonly wakeAgent: (agentId: UUID) => void
  ) {}

  start() {
    if (this.started) return;
    this.started = true;
    void this.ensureSkillsLoaded();
    void this.loop();
  }

  stop(): void {
    this.stopped = true;
    this.requestInterrupt();
  }

  private async ensureSkillsLoaded() {
    try {
      const agent = await store.getAgent({ agentId: this.agentId });
      const parsed = safeJsonParse<unknown>(agent.llmHistory, {});
      const history = Array.isArray(parsed) ? (parsed as HistoryMessage[]) : [];
      if (historyHasSkills(history)) return;
      const skillsBlock = await buildSkillsBlock();
      if (!skillsBlock) return;
      history.push({ role: "system", content: skillsBlock });
      await store.setAgentHistory({
        agentId: this.agentId,
        llmHistory: JSON.stringify(history),
      });
    } catch {
      // best-effort only
    }
  }

  wakeup(reason: "manual" | "group_message" | "direct_message" | "context_stream" = "manual") {
    this.wake.resolve();
    this.wake = createDeferred<void>();
    this.bus.emit(this.agentId, {
      event: "agent.wakeup",
      data: { agentId: this.agentId, reason },
    });
  }

  requestInterrupt() {
    this.interruptRequested = true;
    this.workAbort?.abort();
    this.wake.resolve();
    this.wake = createDeferred<void>();
  }

  private consumeInterruptRequest() {
    if (!this.interruptRequested) return false;
    this.interruptRequested = false;
    return true;
  }

  private async loop() {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.stopped) return;
      await this.wake.promise;
      if (this.stopped) return;
      if (this.running) continue;
      this.running = true;
      this.workAbort = new AbortController();
      try {
        await this.processUntilIdle();
      } catch (err) {
        const aborted =
          this.interruptRequested || (err instanceof Error && err.name === "AbortError");
        if (!aborted) {
          this.bus.emit(this.agentId, {
            event: "agent.error",
            data: { message: err instanceof Error ? err.message : String(err) },
          });
          const message = err instanceof Error ? err.message : String(err);
          void appendAgentStreamEvent({
            agentId: this.agentId,
            kind: "error",
            error: message,
          });
        }
      } finally {
        this.running = false;
        this.workAbort = null;
      }
    }
  }

  private async processUntilIdle() {
    const role = await store.getAgentRole({ agentId: this.agentId }).catch(() => null);
    if (role === "human" || role === null) return;
    if (this.consumeInterruptRequest()) return;

    // 轮询间隔配置，默认200ms，避免过度占用CPU
    const POLL_INTERVAL_MS = Number(process.env.AGENT_POLL_INTERVAL_MS) || 200;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.consumeInterruptRequest()) return;
      const batches = await store.listUnreadByGroup({ agentId: this.agentId });
      if (batches.length === 0) return;

      this.bus.emit(this.agentId, {
        event: "agent.unread",
        data: {
          agentId: this.agentId,
          batches: batches.map((batch) => ({
            groupId: batch.groupId,
            messageIds: batch.messages.map((m) => m.id),
          })),
        },
      });

      for (const batch of batches) {
        if (this.consumeInterruptRequest()) return;
        await this.processGroupUnread(batch.groupId, batch.messages);
        if (this.consumeInterruptRequest()) return;
      }

      // 处理完一批后等待，避免过度占用CPU
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  private async processGroupUnread(
    groupId: UUID,
    unreadMessages: Array<{
      id: UUID;
      senderId: UUID;
      content: string;
      contentType: string;
      sendTime: string;
    }>
  ) {
    const workspaceId = await store.getGroupWorkspaceId({ groupId });
    const lastId = unreadMessages[unreadMessages.length - 1]?.id;
    if (!lastId) return;

    const processing = await processingStore.beginRun({
      agentId: this.agentId,
      groupId,
      workspaceId,
      lastMessageId: lastId,
      messageIds: unreadMessages.map((m) => m.id),
    });

    if (processing.status === "completed") {
      await processingStore.markProcessedToMessage({
        groupId,
        readerId: this.agentId,
        messageId: lastId,
      });
      return;
    }

    try {
      const agent = await store.getAgent({ agentId: this.agentId });
      const parsed = safeJsonParse<unknown>(agent.llmHistory, {});
      const history = Array.isArray(parsed) ? (parsed as HistoryMessage[]) : [];
      const skillsBlock = await buildSkillsBlock();
      const hasSkills = historyHasSkills(history);
      const allowBash = isHostBashAllowed();

      if (history.length === 0) {
        const role = agent.role;
        history.push({
          role: "system",
          content:
            `You are an agent in an IM system.\n` +
            `Your agent_id is: ${this.agentId}.\n` +
            `Your workspace_id is: ${workspaceId}.\n` +
            `Your role is: ${role}.\n` +
            `Act strictly as this role when replying. Be concise and helpful.\n` +
            `Your replies are NOT automatically delivered to humans.\n` +
            `To send messages, you MUST call tools like send_group_message or send_direct_message.\n` +
            `If you need to coordinate with other agents, you may use tools like self, list_agents, create, send, list_groups, list_group_members, create_group, send_group_message, send_direct_message, and get_group_messages.\n` +
            (allowBash
              ? `If you need to run shell commands, use the bash tool.`
              : `Host shell (bash) is disabled unless the operator enables allowHostBash.`) +
            (skillsBlock ? `\n\n${skillsBlock}` : ""),
        });
      } else if (skillsBlock && !hasSkills) {
        history.push({ role: "system", content: skillsBlock });
      }

      const userContent = unreadMessages
        .map((m) => `[group:${groupId}] ${m.senderId}: ${m.content}`)
        .join("\n");
      history.push({ role: "user", content: userContent });

      const research = await researchStore.getActiveRunForGroup({ groupId });
      if (research) {
        const revisions = await researchStore.listPlanRevisions(research.id);
        const plan = revisions.find((item) => item.version === research.planVersion) ?? revisions[0] ?? null;
        const participant = await researchStore.getParticipant({ runId: research.id, agentId: this.agentId });
        const unused = (await researchStore.listEvidence({ runId: research.id })).filter((item) => !item.claimId);
        history.push({
          role: "system",
          content: formatResearchContext({
            run: research,
            plan,
            role: participant?.role ?? null,
            unusedCount: unused.length,
          }),
        });
      }

      const { assistantText, assistantThinking, didSend: firstDidSend } = await this.runWithTools({
        groupId,
        workspaceId,
        history,
        processingRunId: processing.id,
      });

      history.push({
        role: "assistant",
        content: assistantText,
        reasoning_content: assistantThinking || undefined,
      });

      let didSend = firstDidSend || processing.didSend;

      if (!didSend && !this.interruptRequested) {
        history.push({
          role: "user",
          content:
            "Reminder: 本轮未调用 send_*。先判断是否需要对外可见；需要时使用 send_group_message 或 send_direct_message，无需时可不发送。",
        });

        const followup = await this.runWithTools({
          groupId,
          workspaceId,
          history,
          processingRunId: processing.id,
        });

        if (followup.didSend) {
          didSend = true;
        }

        history.push({
          role: "assistant",
          content: followup.assistantText,
          reasoning_content: followup.assistantThinking || undefined,
        });

        if (!didSend && !this.interruptRequested) {
          const fallbackText = (followup.assistantText || assistantText || "").trim();
          if (fallbackText && fallbackText !== "无需发送") {
            const members = await store.listGroupMemberIds({ groupId });
            const blocked = await this.researchSendGate({ groupId, memberIds: members });
            if (!blocked) {
              const delivered = await processingStore.sendIdempotent({
                runId: processing.id,
                agentId: this.agentId,
                groupId,
                toolName: "fallback_send",
                target: groupId,
                send: () =>
                  store.sendMessage({
                    groupId,
                    senderId: this.agentId,
                    content: fallbackText,
                    contentType: "text",
                  }),
              });
              if (!delivered.reused) {
                const result = delivered.result as { id: string; sendTime?: string };
                getWorkspaceUIBus().emit(workspaceId, {
                  event: "ui.message.created",
                  data: {
                    workspaceId,
                    groupId,
                    memberIds: members,
                    message: {
                      id: result.id,
                      senderId: this.agentId,
                      sendTime: result.sendTime ?? new Date().toISOString(),
                    },
                  },
                });
              }
              didSend = true;
            }
          }
        }
      }

      if (this.interruptRequested) {
        await processingStore.failRun(processing.id, "interrupted");
        return;
      }

      await store.setAgentHistory({
        agentId: this.agentId,
        llmHistory: JSON.stringify(history),
        workspaceId,
      });
      try {
        await appendAgentHistorySnapshot({
          agentId: this.agentId,
          workspaceId,
          groupId,
          history,
        });
      } catch {
        // best-effort logging
      }
      getWorkspaceUIBus().emit(workspaceId, {
        event: "ui.agent.history.persisted",
        data: { workspaceId, agentId: this.agentId, groupId, historyLength: history.length },
      });
      await processingStore.completeRun(processing.id, didSend);
      await processingStore.markProcessedToMessage({
        groupId,
        readerId: this.agentId,
        messageId: lastId,
      });
    } catch (err) {
      await processingStore.failRun(
        processing.id,
        err instanceof Error ? err.message : String(err)
      );
      throw err;
    }
  }

  private async runWithTools(input: {
    groupId: UUID;
    workspaceId: UUID;
    history: HistoryMessage[];
    processingRunId?: UUID;
  }) {
    const maxToolRounds = 3;
    let assistantText = "";
    let assistantThinking = "";
    let didSend = false;

    for (let round = 0; round < maxToolRounds; round++) {
      const res = await this.callLlmStreaming(input.history, {
        workspaceId: input.workspaceId,
        groupId: input.groupId,
        round,
      });
      assistantText = res.assistantText;
      assistantThinking = res.assistantThinking;

      if (res.toolCalls.length === 0) {
        return { assistantText, assistantThinking, didSend };
      }

      input.history.push({
        role: "assistant",
        content: res.assistantText,
        tool_calls: res.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.argumentsText },
        })),
        reasoning_content: res.assistantThinking || undefined,
      });

      for (const call of res.toolCalls) {
        const result = await this.executeToolCall({
          groupId: input.groupId,
          call,
          processingRunId: input.processingRunId,
        });
        if (didSendSucceed(call.name, result as { ok?: unknown })) {
          didSend = true;
        }
        this.bus.emit(this.agentId, {
          event: "agent.stream",
          data: {
            kind: "tool_result",
            delta: JSON.stringify(result),
            tool_call_id: call.id,
            tool_call_name: call.name,
          },
        });
        void appendAgentStreamEvent({
          agentId: this.agentId,
          round,
          kind: "tool_result",
          delta: JSON.stringify(result),
          tool_call_id: call.id,
          tool_call_name: call.name,
        });
        input.history.push({
          role: "tool",
          content: JSON.stringify(result),
          tool_call_id: call.id,
          name: call.name,
        });
      }

    }

    return { assistantText, assistantThinking, didSend };
  }

  private async researchSendGate(input: {
    groupId: UUID;
    targetId?: string;
    memberIds?: UUID[];
  }): Promise<{ ok: false; error: string } | null> {
    const run = await researchStore.getActiveRunForGroup({ groupId: input.groupId });
    if (!run) return null;
    const sender = await researchStore.getParticipant({ runId: run.id, agentId: this.agentId });
    const senderRole = sender?.role ?? null;

    if (input.targetId) {
      const targetRoleName = await store.getAgentRole({ agentId: input.targetId }).catch(() => null);
      const targetIsHuman = targetRoleName === "human";
      const targetParticipant = targetIsHuman
        ? null
        : await researchStore.getParticipant({ runId: run.id, agentId: input.targetId });
      const decision = peerMessageAllowed({
        phase: run.phase,
        senderRole,
        targetRole: targetParticipant?.role ?? (targetIsHuman ? null : "worker"),
        targetIsHuman,
      });
      if (!decision.allowed) return { ok: false, error: decision.reason };
      return null;
    }

    const memberIds = input.memberIds ?? (await store.listGroupMemberIds({ groupId: input.groupId }));
    const memberRoles: Array<ParticipantRole | "human" | null> = [];
    for (const memberId of memberIds) {
      const roleName = await store.getAgentRole({ agentId: memberId }).catch(() => null);
      if (roleName === "human") {
        memberRoles.push("human");
        continue;
      }
      const part = await researchStore.getParticipant({ runId: run.id, agentId: memberId });
      memberRoles.push(part?.role ?? "worker");
    }
    const decision = groupSendAllowed({
      phase: run.phase,
      senderRole,
      memberRoles,
    });
    if (!decision.allowed) return { ok: false, error: decision.reason };
    return null;
  }

  private async deliverSend<T extends { id: string }>(input: {
    processingRunId?: UUID;
    groupId: UUID;
    toolName: string;
    target: string;
    send: () => Promise<T>;
  }): Promise<{ ok: true; reused: boolean } & T> {
    if (!input.processingRunId) {
      const result = await input.send();
      return { ok: true, reused: false, ...result };
    }
    const delivered = await processingStore.sendIdempotent({
      runId: input.processingRunId,
      agentId: this.agentId,
      groupId: input.groupId,
      toolName: input.toolName,
      target: input.target,
      send: input.send,
    });
    return { ok: true, reused: delivered.reused, ...(delivered.result as T) };
  }

  private async executeToolCall(input: { groupId: UUID; call: ToolCall; processingRunId?: UUID }) {
    const name = input.call.name ?? "";
    const workspaceId = await store.getGroupWorkspaceId({ groupId: input.groupId });
    const toolMeta = { toolCallId: input.call.id, toolName: input.call.name };

    getWorkspaceUIBus().emit(workspaceId, {
      event: "ui.agent.tool_call.start",
      data: {
        workspaceId,
        agentId: this.agentId,
        groupId: input.groupId,
        toolCallId: toolMeta.toolCallId,
        toolName: toolMeta.toolName,
      },
    });

    const emitToolDone = (ok: boolean) => {
      getWorkspaceUIBus().emit(workspaceId, {
        event: "ui.agent.tool_call.done",
        data: {
          workspaceId,
          agentId: this.agentId,
          groupId: input.groupId,
          toolCallId: toolMeta.toolCallId,
          toolName: toolMeta.toolName,
          ok,
        },
      });
    };

    const handler = builtinToolHandlers[name];
    if (handler) {
      return handler({
        agentId: this.agentId,
        workspaceId,
        groupId: input.groupId,
        processingRunId: input.processingRunId,
        argumentsText: input.call.argumentsText,
        emitDone: emitToolDone,
        signal: this.workAbort?.signal,
        ensureRunner: (id) => this.ensureRunner(id),
        wakeAgent: (id) => this.wakeAgent(id),
        researchSendGate: (gate) => this.researchSendGate(gate),
        deliverSend: (sendInput) => this.deliverSend(sendInput),
      });
    }

    const mcp = await getMcpRegistry(BUILTIN_TOOL_NAMES);
    if (mcp.hasTool(name)) {
      const args = safeJsonParse<Record<string, unknown>>(input.call.argumentsText, {});
      const result = await mcp.callTool(name, args);
      emitToolDone(result.ok);
      return result;
    }

    emitToolDone(false);
    return { ok: false, error: `Unknown tool: ${name}` };
  }

  private async consumeChatCompletionsStream(input: {
    body: ReadableStream<Uint8Array>;
    ctx: { workspaceId: UUID; groupId: UUID; round: number };
  }) {
    const assembler = new OpenAIStreamAssembler();
    let prev = assembler.snapshot();
    let assistantText = "";
    let assistantThinking = "";

    for await (const evt of parseSSEJsonLines(input.body)) {
      const state = assembler.push(evt as any);
      const reasoningDelta = state.reasoningContent.slice(prev.reasoningContent.length);
      const contentDelta = state.content.slice(prev.content.length);
      const toolCallDeltas = extractToolCallDeltas(evt as any, prev, state);

      if (reasoningDelta) {
        assistantThinking += reasoningDelta;
        this.bus.emit(this.agentId, {
          event: "agent.stream",
          data: { kind: "reasoning", delta: reasoningDelta },
        });
        void appendAgentStreamEvent({
          agentId: this.agentId,
          round: input.ctx.round,
          kind: "reasoning",
          delta: reasoningDelta,
        });
      }

      if (contentDelta) {
        assistantText += contentDelta;
        this.bus.emit(this.agentId, {
          event: "agent.stream",
          data: { kind: "content", delta: contentDelta },
        });
        void appendAgentStreamEvent({
          agentId: this.agentId,
          round: input.ctx.round,
          kind: "content",
          delta: contentDelta,
        });
      }

      for (const delta of toolCallDeltas) {
        this.bus.emit(this.agentId, {
          event: "agent.stream",
          data: {
            kind: "tool_calls",
            delta: delta.delta,
            tool_call_id: delta.tool_call_id,
            tool_call_name: delta.tool_call_name,
          },
        });
        void appendAgentStreamEvent({
          agentId: this.agentId,
          round: input.ctx.round,
          kind: "tool_calls",
          delta: delta.delta,
          tool_call_id: delta.tool_call_id,
          tool_call_name: delta.tool_call_name,
        });
      }

      prev = state;
    }

    this.bus.emit(this.agentId, {
      event: "agent.done",
      data: { finishReason: prev.finishReason ?? undefined },
    });
    void appendAgentStreamEvent({
      agentId: this.agentId,
      round: input.ctx.round,
      kind: "done",
      finishReason: prev.finishReason ?? null,
    });
    getWorkspaceUIBus().emit(input.ctx.workspaceId, {
      event: "ui.agent.llm.done",
      data: {
        workspaceId: input.ctx.workspaceId,
        agentId: this.agentId,
        groupId: input.ctx.groupId,
        round: input.ctx.round,
        finishReason: prev.finishReason ?? undefined,
      },
    });

    const finalState = assembler.snapshot();
    if (finalState.usage && finalState.usage.totalTokens > 0) {
      try {
        await store.setGroupContextTokens({
          groupId: input.ctx.groupId,
          tokens: finalState.usage.totalTokens,
        });
      } catch {
        // best-effort
      }
    }

    return {
      assistantText,
      assistantThinking,
      toolCalls: (finalState.toolCalls ?? []) as ToolCall[],
      finishReason: finalState.finishReason,
    };
  }

  private async callLlmStreaming(
    history: HistoryMessage[],
    ctx: { workspaceId: UUID; groupId: UUID; round: number }
  ) {
    const provider = getLlmProvider();
    if (provider === "ark") return this.callArkStreaming(history, ctx);
    if (provider === "minimax") return this.callMiniMaxStreaming(history, ctx);
    return this.callOpenRouterStreaming(history, ctx);
  }

  private async callOpenRouterStreaming(
    history: HistoryMessage[],
    ctx: { workspaceId: UUID; groupId: UUID; round: number }
  ) {
    const { apiKey, baseUrl, model, httpReferer, appTitle } = getOpenRouterConfig();

    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.agent.llm.start",
      data: {
        workspaceId: ctx.workspaceId,
        agentId: this.agentId,
        groupId: ctx.groupId,
        round: ctx.round,
      },
    });
    void appendAgentStreamEvent({
      agentId: this.agentId,
      round: ctx.round,
      kind: "start",
    });

    const tools = await getAgentTools();
    const payload: Record<string, unknown> = {
      // Preserve reasoning for OpenRouter using the canonical "reasoning" field.
      messages: mapOpenRouterMessages(history),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (model) payload.model = model;
    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (httpReferer) headers["HTTP-Referer"] = httpReferer;
    if (appTitle) headers["X-Title"] = appTitle;

    const requestBody = JSON.stringify(payload);
    void appendAgentLlmRequestRaw({ agentId: this.agentId, body: requestBody });

    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: this.workAbort?.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`OpenRouter upstream error: ${upstream.status} ${text}`);
    }

    return this.consumeChatCompletionsStream({ body: upstream.body, ctx });
  }

  private async callArkStreaming(
    history: HistoryMessage[],
    ctx: { workspaceId: UUID; groupId: UUID; round: number }
  ) {
    const { apiKey, baseUrl, model } = getArkConfig();

    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.agent.llm.start",
      data: {
        workspaceId: ctx.workspaceId,
        agentId: this.agentId,
        groupId: ctx.groupId,
        round: ctx.round,
      },
    });
    void appendAgentStreamEvent({
      agentId: this.agentId,
      round: ctx.round,
      kind: "start",
    });

    const tools = await getAgentTools();
    const payload: Record<string, unknown> = {
      model,
      messages: mapOpenRouterMessages(history),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const requestBody = JSON.stringify(payload);
    void appendAgentLlmRequestRaw({ agentId: this.agentId, body: requestBody });

    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: this.workAbort?.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`Ark upstream error: ${upstream.status} ${text}`);
    }

    return this.consumeChatCompletionsStream({ body: upstream.body, ctx });
  }


  private async callMiniMaxStreaming(
    history: HistoryMessage[],
    ctx: { workspaceId: UUID; groupId: UUID; round: number }
  ) {
    const { apiKey, baseUrl, model } = (() => {
      const config = getConfig();
      const apiKey = (isValidApiKey(config.minimaxApiKey) ? config.minimaxApiKey : null) ?? process.env.MINIMAX_API_KEY ?? "";
      const baseUrl =
        config.minimaxBaseUrl ??
        process.env.MINIMAX_BASE_URL ??
        process.env.OPENAI_API_BASE ??
        "https://api.minimaxi.com/v1/text/chatcompletion_v2";
      const model =
        config.minimaxModel ?? process.env.MINIMAX_MODEL ?? process.env.LLM_MODEL ?? "MiniMax-M2.1";
      if (!apiKey) throw new Error("Missing MINIMAX_API_KEY");
      return { apiKey, baseUrl, model };
    })();

    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.agent.llm.start",
      data: {
        workspaceId: ctx.workspaceId,
        agentId: this.agentId,
        groupId: ctx.groupId,
        round: ctx.round,
      },
    });
    void appendAgentStreamEvent({ agentId: this.agentId, round: ctx.round, kind: "start" });

    const tools = await getAgentTools();
    const payload: Record<string, unknown> = {
      model,
      messages: mapOpenRouterMessages(history),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    const requestBody = JSON.stringify(payload);
    void appendAgentLlmRequestRaw({ agentId: this.agentId, body: requestBody });

    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: requestBody,
      signal: this.workAbort?.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`MiniMax upstream error: ${upstream.status} ${text}`);
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const errJson = (await upstream.json().catch(() => null)) as any;
      const msg = errJson?.base_resp?.status_msg || errJson?.message || JSON.stringify(errJson);
      throw new Error(`MiniMax upstream error: ${msg}`);
    }

    return this.consumeChatCompletionsStream({ body: upstream.body, ctx });
  }
}

function extractToolCallDeltas(
  chunk: {
    choices?: Array<{
      delta?: {
        tool_calls?: Array<{
          index?: number;
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    }>;
  },
  prevState: { toolCalls: Array<{ index: number; id?: string; name?: string; argumentsText: string }> },
  nextState: { toolCalls: Array<{ index: number; id?: string; name?: string; argumentsText: string }> }
): Array<{ delta: string; tool_call_id?: string; tool_call_name?: string }> {
  const deltas: Array<{ delta: string; tool_call_id?: string; tool_call_name?: string }> = [];
  const toolCalls = chunk.choices?.[0]?.delta?.tool_calls ?? [];
  if (toolCalls.length === 0) return deltas;

  const prevByIndex = new Map(prevState.toolCalls.map((call) => [call.index, call]));
  const nextByIndex = new Map(nextState.toolCalls.map((call) => [call.index, call]));

  for (const call of toolCalls) {
    const index = call.index ?? 0;
    const prev = prevByIndex.get(index);
    const next = nextByIndex.get(index);
    const name = call.function?.name ?? next?.name;
    const id = call.id ?? next?.id;
    const argsChunk = call.function?.arguments ?? "";

    if (argsChunk) {
      deltas.push({ delta: argsChunk, tool_call_id: id, tool_call_name: name });
      continue;
    }

    if (name && name !== prev?.name) {
      deltas.push({ delta: "", tool_call_id: id, tool_call_name: name });
    }
  }

  return deltas;
}

export class AgentRuntime {
  private readonly runners = new Map<UUID, AgentRunner>();
  public readonly bus = new AgentEventBus();
  private bootstrapped = false;
  static readonly VERSION = 6;

  disposeRunner(agentId: UUID): void {
    const runner = this.runners.get(agentId);
    if (runner) {
      runner.stop?.();
      this.runners.delete(agentId);
      this.bus.disposeChannel(agentId);
    }
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    this.bootstrapped = true;

    const agents = await store.listAgents();
    for (const a of agents) {
      if (a.role === "human") continue;
      this.ensureRunner(a.id);
    }
  }

  ensureRunner(agentId: UUID) {
    const existing = this.runners.get(agentId);
    if (existing) return existing;
    const runner = new AgentRunner(
      agentId,
      this.bus,
      (id) => {
        this.ensureRunner(id);
      },
      (id) => {
        this.ensureRunner(id).wakeup("manual");
      }
    );
    this.runners.set(agentId, runner);
    runner.start();
    return runner;
  }

  async wakeAgentsForGroup(groupId: UUID, senderId: UUID) {
    await this.bootstrap();
    const memberIds = await store.listGroupMemberIds({ groupId });

    for (const memberId of memberIds) {
      if (memberId === senderId) continue;
      const role = await store.getAgentRole({ agentId: memberId }).catch(() => null);
      if (role === "human" || role === null) continue;
      this.ensureRunner(memberId).wakeup("group_message");
    }
  }

  async wakeAgent(agentId: UUID, reason: "direct_message" | "context_stream" = "direct_message") {
    await this.bootstrap();
    const role = await store.getAgentRole({ agentId }).catch(() => null);
    if (role === "human" || role === null) return;
    this.ensureRunner(agentId).wakeup(reason);
  }

  async interruptAll(input?: { workspaceId?: UUID }) {
    await this.bootstrap();
    const workspaceId = input?.workspaceId?.trim();
    const agents = await store.listAgents(workspaceId ? { workspaceId } : undefined);
    const agentIds = agents.filter((agent) => agent.role !== "human").map((agent) => agent.id);

    for (const agentId of agentIds) {
      this.ensureRunner(agentId).requestInterrupt();
    }

    return { interrupted: agentIds.length, agentIds };
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __agentWechatRuntime: AgentRuntime | undefined;
  // eslint-disable-next-line no-var
  var __agentWechatRuntimeVersion: number | undefined;
}

export function getAgentRuntime() {
  if (
    globalThis.__agentWechatRuntime &&
    globalThis.__agentWechatRuntimeVersion === AgentRuntime.VERSION
  ) {
    return globalThis.__agentWechatRuntime;
  }

  globalThis.__agentWechatRuntime = new AgentRuntime();
  globalThis.__agentWechatRuntimeVersion = AgentRuntime.VERSION;
  return globalThis.__agentWechatRuntime;
}
