/**
 * Citation Store
 *
 * Search hits become evidence on a ResearchRun (Postgres).
 * Authors/year stay unknown unless Semantic Scholar (or the caller) provides them.
 */

import { citationDraftFromSearchHit } from "./citation-metadata";
import { researchStore, type ResearchEvidenceRecord } from "./research-store";
import type { Citation } from "./research-runtime";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function evidenceToCitation(row: ResearchEvidenceRecord): Citation {
  return {
    id: row.id,
    type: "web",
    authors: row.authors,
    year: row.publishedYear,
    title: row.sourceTitle,
    url: row.sourceUrl,
    snippet: row.excerpt,
    query: row.query ?? undefined,
    searchedAt: row.retrievedAt,
    doi: row.doi ?? undefined,
  };
}

export async function recordSearchCitations(
  agentId: string,
  query: string,
  results: WebSearchResult[],
  ctx?: { workspaceId?: string; groupId?: string }
): Promise<Citation[]> {
  if (results.length === 0) return [];
  const searchedAt = new Date().toISOString();
  const stamp = Date.now().toString(36);

  let runId: string | null = null;
  if (ctx?.workspaceId && ctx?.groupId) {
    const run = await researchStore.ensureActiveRun({
      workspaceId: ctx.workspaceId,
      groupId: ctx.groupId,
    });
    runId = run.id;
  } else if (ctx?.groupId) {
    const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
    runId = run?.id ?? null;
  }

  const added: Citation[] = [];
  for (const [index, result] of results.entries()) {
    const draft = citationDraftFromSearchHit(result, {
      id: `WB-${stamp}-${index + 1}`,
      query,
      searchedAt,
    });
    if (runId) {
      const evidence = await researchStore.recordEvidence({
        runId,
        agentId,
        sourceUrl: draft.url,
        sourceTitle: draft.title,
        excerpt: draft.snippet,
        query,
        enrich: true,
      });
      added.push(evidenceToCitation(evidence));
    } else {
      added.push({
        id: draft.id,
        type: "web",
        authors: draft.authors,
        year: draft.year,
        title: draft.title,
        url: draft.url,
        snippet: draft.snippet,
        query: draft.query,
        searchedAt: draft.searchedAt,
        doi: draft.doi,
      });
    }
  }
  return added;
}

export async function recordPaperCitations(
  agentId: string,
  query: string,
  papers: Array<{
    title: string;
    url: string;
    excerpt: string;
    authors: string[];
    year: number | null;
    doi: string | null;
    paperId?: string;
    venue?: string | null;
  }>,
  ctx?: { workspaceId?: string; groupId?: string }
): Promise<Citation[]> {
  if (papers.length === 0) return [];

  let runId: string | null = null;
  if (ctx?.workspaceId && ctx?.groupId) {
    const run = await researchStore.ensureActiveRun({
      workspaceId: ctx.workspaceId,
      groupId: ctx.groupId,
    });
    runId = run.id;
  } else if (ctx?.groupId) {
    const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
    runId = run?.id ?? null;
  }

  const added: Citation[] = [];
  const existing = runId ? await researchStore.listEvidence({ runId }) : [];
  for (const paper of papers) {
    const duplicate = existing.find(
      (row) => row.sourceUrl === paper.url || (paper.doi && row.doi && row.doi === paper.doi)
    );
    if (duplicate) {
      added.push(evidenceToCitation(duplicate));
      continue;
    }
    if (runId) {
      const evidence = await researchStore.recordEvidence({
        runId,
        agentId,
        sourceUrl: paper.url,
        sourceTitle: paper.title,
        excerpt: paper.excerpt,
        query,
        authors: paper.authors,
        publishedYear: paper.year,
        doi: paper.doi,
        locator: paper.paperId ?? null,
        kind: "paper",
        venue: paper.venue ?? null,
        enrich: false,
      });
      added.push({
        ...evidenceToCitation(evidence),
        type: paper.venue ? "journal" : "web",
      });
      existing.push(evidence);
    } else {
      added.push({
        id: paper.paperId || paper.url,
        type: paper.venue ? "journal" : "web",
        authors: paper.authors,
        year: paper.year,
        title: paper.title,
        url: paper.url,
        snippet: paper.excerpt,
        query,
        searchedAt: new Date().toISOString(),
        doi: paper.doi ?? undefined,
      });
    }
  }
  return added;
}

export async function listCitations(agentId: string): Promise<Citation[]> {
  const rows = await researchStore.listEvidenceByAgent(agentId);
  return rows.map(evidenceToCitation);
}
