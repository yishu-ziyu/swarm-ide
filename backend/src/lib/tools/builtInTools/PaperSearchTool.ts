import { z } from "zod";
import { buildTool, successResult, type ToolCallOptions } from "../Tool";
import { searchPapers } from "../../../research/paper-search";
import { recordPaperCitations } from "../../../research/citation-store";

const PaperSearchToolSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe("Academic search query: paper title, authors, methods, or research question."),
  maxResults: z.number().int().min(1).max(20).default(8),
  yearFrom: z.number().int().optional().describe("Only papers published this year or later."),
});

const PaperSearchToolDef = buildTool({
  name: "search_papers",
  description:
    "Search peer-reviewed and academic papers via Semantic Scholar. Use this for literature, methods, and citations — not news. Returns papers with authors, year, abstract excerpt, URL, and evidence IDs.",
  inputSchema: PaperSearchToolSchema,
  outputSchema: z.any(),
  isReadOnly: () => true,
  isDestructive: () => false,
  isConcurrencySafe: () => true,

  async call(input, options: ToolCallOptions) {
    const found = await searchPapers({
      query: input.query,
      maxResults: input.maxResults,
      yearFrom: input.yearFrom,
      signal: options.signal,
    });
    if (!found.ok) {
      return { success: false, error: found.error };
    }

    const agentId = options.context?.agentId || "anonymous";
    const citations = await recordPaperCitations(agentId, input.query, found.papers, {
      workspaceId: options.context?.workspaceId,
      groupId: options.context?.groupId,
    });

    return successResult({
      query: input.query,
      source: "semantic-scholar",
      totalResults: found.papers.length,
      papers: found.papers.map((paper, index) => ({
        ...paper,
        evidenceId: citations[index]?.id ?? null,
      })),
      citationIds: citations.map((c) => c.id),
    });
  },
});

export const PaperSearchTool = PaperSearchToolDef;
