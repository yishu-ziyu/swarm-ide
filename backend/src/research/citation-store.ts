/**
 * Citation Store
 *
 * 把 WebSearch 的结果落进 CitationManager（research-runtime），按 agentId 隔离，
 * 供 /api/research/citations 查询。挂在 globalThis 上以 survive Next.js dev 的 HMR。
 */

import { CitationManager, type Citation } from "./research-runtime";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type CitationStore = Map<string, CitationManager>;

const globalStore = globalThis as unknown as { __researchCitationStore?: CitationStore };
const store: CitationStore = globalStore.__researchCitationStore ?? new Map();
globalStore.__researchCitationStore = store;

export function getCitationManager(agentId: string): CitationManager {
  let manager = store.get(agentId);
  if (!manager) {
    manager = new CitationManager();
    store.set(agentId, manager);
  }
  return manager;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/**
 * 每次成功搜索后调用：把 {title,url,snippet} + 查询词 + 时间写成引文条目。
 * 返回本次新增的引文。
 */
export function recordSearchCitations(
  agentId: string,
  query: string,
  results: WebSearchResult[]
): Citation[] {
  if (results.length === 0) return [];
  const manager = getCitationManager(agentId);
  const searchedAt = new Date().toISOString();
  const stamp = Date.now().toString(36);

  const added: Citation[] = [];
  results.forEach((result, index) => {
    const citation: Citation = {
      id: `WB-${stamp}-${index + 1}`,
      type: "web",
      authors: [hostOf(result.url)],
      year: new Date().getFullYear(),
      title: result.title,
      url: result.url,
      snippet: result.snippet,
      query,
      searchedAt,
    };
    manager.add(citation);
    added.push(citation);
  });
  return added;
}

export function listCitations(agentId: string): Citation[] {
  return getCitationManager(agentId).getAll();
}
