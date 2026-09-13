export const runtime = "nodejs";

import { listCitations } from "../../../../src/research/citation-store";

// GET /api/research/citations?agentId=... — 取回某 agent 搜索产生的引文记录
export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = (url.searchParams.get("agentId") ?? "").trim();

  if (!agentId) {
    return Response.json({ error: "Missing agentId" }, { status: 400 });
  }

  const citations = listCitations(agentId);
  return Response.json({
    agentId,
    total: citations.length,
    citations: citations.map((citation) => ({
      id: citation.id,
      type: citation.type,
      title: citation.title,
      url: citation.url ?? null,
      snippet: citation.snippet ?? null,
      query: citation.query ?? null,
      searchedAt: citation.searchedAt ?? null,
      authors: citation.authors,
      year: citation.year,
    })),
  });
}
