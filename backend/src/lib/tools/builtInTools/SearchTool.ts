import { z } from "zod";
import { buildTool, successResult, type ToolCallOptions } from "../Tool";
import { getMcpRegistry } from "../../../runtime/mcp";
import {
  recordSearchCitations,
  type WebSearchResult,
} from "../../../research/citation-store";

// ============================================================================
// Search Tool (web / academic search via MCP, e.g. Tavily)
// ============================================================================

const SearchToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe(
      "Search query. Natural language or keywords; can be used to find academic papers, references, or web pages."
    ),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(8)
    .describe("Maximum number of results to return (default 8)"),
  topic: z
    .enum(["general", "news"])
    .default("general")
    .describe("'general' for literature/web search, 'news' for recent events"),
});

export type SearchToolInput = z.infer<typeof SearchToolSchema>;

/** 在 MCP registry 里定位 tavily 的搜索工具（tavily-mcp 暴露名为 tavily-search）。 */
async function resolveTavilySearchTool(
  registry: Awaited<ReturnType<typeof getMcpRegistry>>
): Promise<string | null> {
  const preferred = "tavily-search";
  if (registry.hasTool(preferred)) return preferred;

  const definitions = registry.getToolDefinitions();
  const candidate = definitions.find((def) => {
    const name = def.function.name.toLowerCase();
    return name.includes("tavily") && name.includes("search");
  });
  return candidate?.function.name ?? null;
}

type RawHit = { title?: unknown; url?: unknown; content?: unknown; snippet?: unknown };

/** 从 MCP 工具返回的文本中解析出 {title,url,snippet}[]。 */
function parseSearchResults(content: string): WebSearchResult[] {
  const text = (content ?? "").trim();
  if (!text) return [];

  // tavily-mcp 返回 JSON 数组或 {results: [...]}，也可能夹在普通文本里
  const jsonCandidates: string[] = [text];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) jsonCandidates.push(fenced[1].trim());
  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    jsonCandidates.push(text.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      const hits: RawHit[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.results)
          ? parsed.results
          : [];
      const mapped = hits
        .map((hit) => ({
          title: typeof hit?.title === "string" ? hit.title : "",
          url: typeof hit?.url === "string" ? hit.url : "",
          snippet:
            typeof hit?.content === "string"
              ? hit.content
              : typeof hit?.snippet === "string"
                ? hit.snippet
                : "",
        }))
        .filter((item) => item.url);
      if (mapped.length > 0) return mapped;
    } catch {
      // try next candidate
    }
  }

  // 兜底：从纯文本中抽取 URL
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s"'<>)]+/g) ?? []));
  return urls.map((url) => ({ title: url, url, snippet: "" }));
}

const SearchToolDef = buildTool({
  name: "web_search",
  description:
    "Search the open web via Tavily (MCP). For news and non-academic pages. For papers use search_papers.",
  inputSchema: SearchToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,
  isConcurrencySafe: () => true,

  async call(
    input: SearchToolInput,
    options: ToolCallOptions
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const { query, maxResults, topic } = input;

    try {
      const registry = await getMcpRegistry();
      const toolName = await resolveTavilySearchTool(registry);
      if (!toolName) {
        return {
          success: false,
          error:
            "No tavily search tool available via MCP. Ensure backend/mcp.json has the tavily server enabled (disabled:false) and TAVILY_API_KEY set.",
        };
      }

      const callResult = await registry.callTool(toolName, {
        query,
        max_results: maxResults,
        topic,
        include_answer: false,
      });
      if (!callResult.ok) {
        return { success: false, error: callResult.error ?? "MCP tavily search failed" };
      }

      const results = parseSearchResults(callResult.content ?? "").slice(0, maxResults);
      const agentId = options?.context?.agentId || "anonymous";
      const citations = await recordSearchCitations(agentId, query, results, {
        workspaceId: options?.context?.workspaceId,
        groupId: (options?.context as { groupId?: string } | undefined)?.groupId,
      });

      return successResult({
        query,
        results,
        totalResults: results.length,
        citationsRecorded: citations.length,
        citationIds: citations.map((citation) => citation.id),
        source: toolName,
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
});

export const SearchTool = SearchToolDef;
