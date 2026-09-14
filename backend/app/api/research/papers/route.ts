export const runtime = "nodejs";

import { searchPapers } from "../../../../src/research/paper-search";
import { recordPaperCitations } from "../../../../src/research/citation-store";

async function runSearch(query: string, maxResults: number) {
  return searchPapers({ query, maxResults: Number.isFinite(maxResults) ? maxResults : 8 });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = (url.searchParams.get("query") ?? "").trim();
  const maxResults = Number(url.searchParams.get("maxResults") ?? "8");
  if (!query) return Response.json({ error: "Missing query" }, { status: 400 });

  const found = await runSearch(query, maxResults);
  if (!found.ok) return Response.json({ error: found.error, papers: [] }, { status: 502 });
  return Response.json({ query, totalResults: found.papers.length, papers: found.papers });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    query?: string;
    groupId?: string;
    workspaceId?: string;
    agentId?: string;
    maxResults?: number;
  } | null;
  const query = (body?.query ?? "").trim();
  if (!query) return Response.json({ error: "Missing query" }, { status: 400 });

  const found = await runSearch(query, body?.maxResults ?? 8);
  if (!found.ok) return Response.json({ error: found.error, papers: [] }, { status: 502 });

  const groupId = body?.groupId?.trim() || undefined;
  const workspaceId = body?.workspaceId?.trim() || undefined;
  const citations = await recordPaperCitations(body?.agentId?.trim() || "human", query, found.papers, {
    groupId,
    workspaceId,
  });

  return Response.json({
    query,
    totalResults: found.papers.length,
    recorded: citations.length,
    papers: found.papers.map((paper, index) => ({
      ...paper,
      evidenceId: citations[index]?.id ?? null,
    })),
  });
}
