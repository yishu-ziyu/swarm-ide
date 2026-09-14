export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type CitationDraft = {
  id: string;
  type: "web";
  authors: string[];
  year: number | null;
  title: string;
  url: string;
  snippet: string;
  query: string;
  searchedAt: string;
  doi?: string;
};

/**
 * Build a citation from a web/search hit.
 * Do not invent academic metadata: unknown authors stay empty,
 * unknown publication year stays null. retrieved/searched time is separate.
 */
export function citationDraftFromSearchHit(
  hit: SearchHit,
  extra: { id: string; query: string; searchedAt: string }
): CitationDraft {
  return {
    id: extra.id,
    type: "web",
    authors: [],
    year: null,
    title: hit.title || hit.url,
    url: hit.url,
    snippet: hit.snippet,
    query: extra.query,
    searchedAt: extra.searchedAt,
  };
}

export function formatUnknownYear(year: number | null | undefined): string {
  return typeof year === "number" && Number.isFinite(year) ? String(year) : "n.d.";
}

export function formatUnknownAuthors(authors: string[] | undefined): string {
  const cleaned = (authors ?? []).map((a) => a.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned.join(", ") : "Unknown";
}
