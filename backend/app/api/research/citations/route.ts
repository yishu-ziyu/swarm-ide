export const runtime = "nodejs";

import { listCitations } from "../../../../src/research/citation-store";
import { researchStore } from "../../../../src/research/research-store";

function serialize(citation: {
  id: string;
  type?: string;
  title: string;
  url?: string | null;
  snippet?: string | null;
  excerpt?: string;
  query?: string | null;
  searchedAt?: string;
  retrievedAt?: string;
  authors: string[];
  year?: number | null;
  publishedYear?: number | null;
  doi?: string | null;
}) {
  return {
    id: citation.id,
    type: citation.type ?? "web",
    title: citation.title,
    url: citation.url ?? null,
    snippet: citation.snippet ?? citation.excerpt ?? null,
    query: citation.query ?? null,
    searchedAt: citation.searchedAt ?? citation.retrievedAt ?? null,
    authors: citation.authors,
    year: citation.year ?? citation.publishedYear ?? null,
    doi: citation.doi ?? null,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = (url.searchParams.get("agentId") ?? "").trim();
  const groupId = (url.searchParams.get("groupId") ?? "").trim();

  if (groupId) {
    const briefing = await researchStore.getBriefing({ groupId });
    const rows = briefing?.evidence ?? [];
    return Response.json({
      groupId,
      total: rows.length,
      citations: rows.map((row) =>
        serialize({
          id: row.id,
          type: row.kind,
          title: row.sourceTitle,
          url: row.sourceUrl,
          excerpt: row.excerpt,
          query: row.query,
          retrievedAt: row.retrievedAt,
          authors: row.authors,
          publishedYear: row.publishedYear,
          doi: row.doi,
        })
      ),
    });
  }

  if (!agentId) {
    return Response.json({ error: "Missing agentId or groupId" }, { status: 400 });
  }

  const citations = await listCitations(agentId);
  return Response.json({
    agentId,
    total: citations.length,
    citations: citations.map(serialize),
  });
}
