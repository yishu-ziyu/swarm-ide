export function assertHttpUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs can be fetched");
  }
  return url;
}

export function htmlToExcerpt(html: string, maxChars = 1500): { title: string; excerpt: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");
  const excerpt = withoutScripts.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, maxChars);
  return { title, excerpt };
}

export async function fetchSourcePage(input: {
  url: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<{ url: string; title: string; excerpt: string }> {
  const parsed = assertHttpUrl(input.url);
  const res = await (input.fetchImpl ?? fetch)(parsed.toString(), {
    headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9", "User-Agent": "swarm-ide-research" },
    signal: input.signal ?? AbortSignal.timeout(10000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const text = await res.text();
  const { title, excerpt } = htmlToExcerpt(text);
  return { url: parsed.toString(), title: title || parsed.hostname, excerpt };
}
