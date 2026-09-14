export type PaperHit = {
  paperId: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string;
  excerpt: string;
  citationCount: number | null;
};

type ScholarPaper = {
  paperId?: string;
  title?: string;
  year?: number;
  venue?: string;
  url?: string;
  citationCount?: number;
  abstract?: string;
  authors?: Array<{ name?: string }>;
  externalIds?: { DOI?: string; ArXiv?: string };
  openAccessPdf?: { url?: string };
  publicationDate?: string;
};

const SEARCH_FIELDS =
  "paperId,title,year,authors,abstract,url,venue,citationCount,externalIds,openAccessPdf,publicationDate";

function scholarHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "swarm-ide-academic-research",
  };
  const key = process.env.SEMANTIC_SCHOLAR_API_KEY?.trim();
  if (key) headers["x-api-key"] = key;
  return headers;
}

function yearOf(paper: ScholarPaper): number | null {
  if (typeof paper.year === "number" && Number.isFinite(paper.year)) return paper.year;
  const date = paper.publicationDate?.slice(0, 4);
  if (date && /^\d{4}$/.test(date)) return Number(date);
  return null;
}

function urlOf(paper: ScholarPaper): string {
  const pdf = paper.openAccessPdf?.url?.trim();
  if (pdf) return pdf;
  if (paper.url?.trim()) return paper.url.trim();
  if (paper.externalIds?.ArXiv) return `https://arxiv.org/abs/${paper.externalIds.ArXiv}`;
  if (paper.paperId) return `https://www.semanticscholar.org/paper/${paper.paperId}`;
  return "";
}

export function mapScholarPaper(paper: ScholarPaper): PaperHit | null {
  const title = (paper.title ?? "").trim();
  const url = urlOf(paper);
  if (!title || !url) return null;
  const authors = (paper.authors ?? []).map((a) => (a.name ?? "").trim()).filter(Boolean);
  const excerpt = (paper.abstract ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  return {
    paperId: paper.paperId ?? "",
    title,
    authors,
    year: yearOf(paper),
    venue: paper.venue?.trim() || null,
    doi: paper.externalIds?.DOI ?? null,
    url,
    excerpt,
    citationCount: typeof paper.citationCount === "number" ? paper.citationCount : null,
  };
}

async function scholarGet(
  url: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<Response> {
  let last = await fetchImpl(url, { headers: scholarHeaders(), signal });
  for (let attempt = 0; attempt < 1 && last.status === 429; attempt += 1) {
    const retryAfter = Number(last.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 800 * (attempt + 1);
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 4000)));
    last = await fetchImpl(url, { headers: scholarHeaders(), signal });
  }
  return last;
}

function tag(xml: string, name: string): string[] {
  const matches = xml.matchAll(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "gi"));
  return [...matches].map((m) => (m[1] ?? "").replace(/<!\[CDATA\[|\]\]>/g, "").trim());
}

export function parseArxivAtom(xml: string): PaperHit[] {
  const entries = xml.split(/<entry[\s>]/i).slice(1);
  const papers: PaperHit[] = [];
  for (const entry of entries) {
    const title = (tag(entry, "title")[0] ?? "").replace(/\s+/g, " ").trim();
    const summary = (tag(entry, "summary")[0] ?? "").replace(/\s+/g, " ").trim();
    const published = tag(entry, "published")[0] ?? "";
    const id = tag(entry, "id")[0] ?? "";
    const authors = tag(entry, "name");
    const abs = id.replace(/^https?:\/\/arxiv\.org\/abs\//i, "").replace(/v\d+$/, "");
    const url = id.includes("arxiv.org") ? id.replace(/v\d+$/, "") : abs ? `https://arxiv.org/abs/${abs}` : "";
    if (!title || !url) continue;
    const year = published.slice(0, 4);
    papers.push({
      paperId: abs || url,
      title,
      authors,
      year: /^\d{4}$/.test(year) ? Number(year) : null,
      venue: "arXiv",
      doi: null,
      url,
      excerpt: summary.slice(0, 1500),
      citationCount: null,
    });
  }
  return papers;
}

type CrossrefWork = {
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts"?: number[][] };
  abstract?: string;
  DOI?: string;
  URL?: string;
  "container-title"?: string[];
  "is-referenced-by-count"?: number;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function mapCrossrefWork(work: CrossrefWork): PaperHit | null {
  const title = (work.title?.[0] ?? "").replace(/\s+/g, " ").trim();
  const doi = work.DOI?.trim() || null;
  const url = (work.URL || (doi ? `https://doi.org/${doi}` : "")).trim();
  if (!title || !url) return null;
  const authors = (work.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(" ").trim())
    .filter(Boolean);
  const year = work.issued?.["date-parts"]?.[0]?.[0];
  return {
    paperId: doi || url,
    title,
    authors,
    year: typeof year === "number" ? year : null,
    venue: work["container-title"]?.[0] ?? null,
    doi,
    url,
    excerpt: work.abstract ? stripTags(work.abstract).slice(0, 1500) : "",
    citationCount: work["is-referenced-by-count"] ?? null,
  };
}

async function searchCrossref(input: {
  query: string;
  maxResults: number;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
}): Promise<PaperHit[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query.bibliographic", input.query);
  url.searchParams.set("rows", String(input.maxResults));
  url.searchParams.set(
    "select",
    "title,author,issued,abstract,DOI,URL,container-title,is-referenced-by-count,type"
  );
  const res = await input.fetchImpl(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "swarm-ide-academic-research (mailto:dev@localhost)",
    },
    signal: input.signal ?? AbortSignal.timeout(12000),
  });
  if (!res.ok) return [];
  const payload = (await res.json()) as { message?: { items?: CrossrefWork[] } };
  return (payload.message?.items ?? [])
    .map(mapCrossrefWork)
    .filter((hit): hit is PaperHit => hit !== null);
}

async function searchArxiv(input: {
  query: string;
  maxResults: number;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
}): Promise<PaperHit[]> {
  const url = new URL("https://export.arxiv.org/api/query");
  url.searchParams.set("search_query", `all:${input.query}`);
  url.searchParams.set("start", "0");
  url.searchParams.set("max_results", String(input.maxResults));
  const res = await input.fetchImpl(url.toString(), {
    headers: { Accept: "application/atom+xml" },
    signal: input.signal ?? AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  return parseArxivAtom(await res.text());
}

/**
 * Search Semantic Scholar for papers. Empty list on transport failure.
 * Does not invent authors, years, or abstracts.
 */
export async function searchPapers(input: {
  query: string;
  maxResults?: number;
  yearFrom?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{ ok: true; papers: PaperHit[] } | { ok: false; error: string; papers: PaperHit[] }> {
  const query = input.query.trim();
  if (!query) return { ok: false, error: "Missing query", papers: [] };

  const fetchImpl = input.fetchImpl ?? fetch;
  const limit = Math.min(20, Math.max(1, input.maxResults ?? 8));
  const url = new URL("https://api.semanticscholar.org/graph/v1/paper/search");
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", SEARCH_FIELDS);
  if (typeof input.yearFrom === "number") {
    url.searchParams.set("year", `${input.yearFrom}-`);
  }

  try {
    const res = await scholarGet(
      url.toString(),
      fetchImpl,
      input.signal ?? AbortSignal.timeout(5000)
    );
    if (res.ok) {
      const payload = (await res.json()) as { data?: ScholarPaper[] };
      const papers = (payload.data ?? [])
        .map(mapScholarPaper)
        .filter((hit): hit is PaperHit => hit !== null);
      if (papers.length > 0) return { ok: true, papers };
    }

    const crossref = await searchCrossref({
      query,
      maxResults: limit,
      fetchImpl,
      signal: input.signal,
    });
    if (crossref.length > 0) return { ok: true, papers: crossref };

    const arxiv = await searchArxiv({
      query,
      maxResults: limit,
      fetchImpl,
      signal: input.signal,
    });
    if (arxiv.length > 0) return { ok: true, papers: arxiv };

    return {
      ok: false,
      error: `Paper search empty (Semantic Scholar ${res.status}, Crossref and arXiv also empty)`,
      papers: [],
    };
  } catch (err) {
    try {
      const crossref = await searchCrossref({
        query,
        maxResults: limit,
        fetchImpl,
        signal: input.signal,
      });
      if (crossref.length > 0) return { ok: true, papers: crossref };
      const arxiv = await searchArxiv({
        query,
        maxResults: limit,
        fetchImpl,
        signal: input.signal,
      });
      if (arxiv.length > 0) return { ok: true, papers: arxiv };
    } catch {
      // all failed
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      papers: [],
    };
  }
}
