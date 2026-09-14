export type SemanticScholarMatch = {
  authors: string[];
  year: number | null;
  doi: string | null;
  title: string;
  url: string | null;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function looksAcademic(url: string, title: string): boolean {
  const host = hostOf(url).toLowerCase();
  const academicHosts = [
    "arxiv.org",
    "semanticscholar.org",
    "acm.org",
    "ieee.org",
    "nature.com",
    "sciencedirect.com",
    "springer.com",
    "nih.gov",
    "wiley.com",
  ];
  if (academicHosts.some((item) => host.includes(item))) return true;
  return /\b(proceedings|journal|arxiv|doi)\b/i.test(title);
}

/**
 * Best-effort paper metadata. Returns null when unknown — never invents fields.
 */
export async function lookupSemanticScholar(input: {
  title: string;
  url?: string;
  fetchImpl?: typeof fetch;
}): Promise<SemanticScholarMatch | null> {
  const title = input.title.trim();
  if (!title) return null;
  if (input.url && !looksAcademic(input.url, title)) return null;

  const fetchFn = input.fetchImpl ?? fetch;
  const query = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  query.searchParams.set("query", title);
  query.searchParams.set("limit", "1");
  query.searchParams.set("fields", "title,year,authors,url,externalIds");

  try {
    const res = await fetchFn(query.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{
        title?: string;
        year?: number;
        url?: string;
        authors?: Array<{ name?: string }>;
        externalIds?: { DOI?: string };
      }>;
    };
    const paper = body.data?.[0];
    if (!paper) return null;
    const authors = (paper.authors ?? []).map((a) => (a.name ?? "").trim()).filter(Boolean);
    const year = typeof paper.year === "number" ? paper.year : null;
    if (authors.length === 0 && year == null) return null;
    return {
      authors,
      year,
      doi: paper.externalIds?.DOI ?? null,
      title: paper.title ?? title,
      url: paper.url ?? null,
    };
  } catch {
    return null;
  }
}
