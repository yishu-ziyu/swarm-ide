import assert from "node:assert/strict";
import { test } from "node:test";
import { mapCrossrefWork, mapScholarPaper, parseArxivAtom, searchPapers } from "./paper-search.ts";

test("mapScholarPaper keeps real authors and year, never fills hostname or current year", () => {
  const hit = mapScholarPaper({
    paperId: "abc",
    title: "Attention Is All You Need",
    year: 2017,
    authors: [{ name: "Ashish Vaswani" }, { name: "Noam Shazeer" }],
    abstract: "The dominant sequence transduction models are based on complex recurrent...",
    url: "https://www.semanticscholar.org/paper/abc",
    externalIds: { DOI: "10.48550/arXiv.1706.03762", ArXiv: "1706.03762" },
    venue: "NeurIPS",
  });
  assert.ok(hit);
  assert.equal(hit.year, 2017);
  assert.ok(hit.authors.includes("Ashish Vaswani"));
  assert.notEqual(hit.year, new Date().getFullYear());
  assert.equal(hit.authors.includes("arxiv.org"), false);
  assert.ok(hit.excerpt.includes("recurrent"));
});

test("searchPapers maps Scholar payload and reports API errors", async () => {
  const ok = await searchPapers({
    query: "attention is all you need",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              paperId: "1",
              title: "Attention Is All You Need",
              year: 2017,
              authors: [{ name: "Ashish Vaswani" }],
              abstract: "We propose the Transformer.",
              url: "https://www.semanticscholar.org/paper/1",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.papers[0]?.year, 2017);
  assert.equal(ok.papers[0]?.authors[0], "Ashish Vaswani");

  const failed = await searchPapers({
    query: "anything",
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("semanticscholar")) {
        return new Response("quota", { status: 429 });
      }
      if (href.includes("crossref.org")) {
        return new Response(JSON.stringify({ message: { items: [] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        `<feed><entry>
          <id>http://arxiv.org/abs/1706.03762</id>
          <published>2017-06-12T00:00:00Z</published>
          <title>Attention Is All You Need</title>
          <summary>The Transformer architecture.</summary>
          <author><name>Ashish Vaswani</name></author>
        </entry></feed>`,
        { status: 200 }
      );
    },
  });
  assert.equal(failed.ok, true);
  assert.equal(failed.papers[0]?.year, 2017);
  assert.ok(failed.papers[0]?.authors.includes("Ashish Vaswani"));
});

test("arxiv atom parse keeps authors, year, and abstract", () => {
  const papers = parseArxivAtom(`<?xml version="1.0"?>
<feed>
<entry>
  <id>http://arxiv.org/abs/1706.03762v7</id>
  <published>2017-06-12T17:57:34Z</published>
  <title>Attention Is All You Need</title>
  <summary>We propose a new simple network architecture, the Transformer.</summary>
  <author><name>Ashish Vaswani</name></author>
  <author><name>Noam Shazeer</name></author>
</entry>
</feed>`);
  assert.equal(papers.length, 1);
  assert.equal(papers[0]?.year, 2017);
  assert.ok(papers[0]?.authors.includes("Ashish Vaswani"));
  assert.ok(papers[0]?.excerpt.includes("Transformer"));
  assert.ok(papers[0]?.url.includes("1706.03762"));
});

test("crossref mapper keeps Vaswani and the abstract, not the hostname as author", () => {
  const hit = mapCrossrefWork({
    title: ["Attention Is All You Need"],
    author: [
      { given: "Ashish", family: "Vaswani" },
      { given: "Noam", family: "Shazeer" },
    ],
    issued: { "date-parts": [[2017]] },
    abstract: "<jats:p>The dominant sequence transduction models are based on complex recurrent</jats:p>",
    DOI: "10.5555/3295222.3295349",
    URL: "https://doi.org/10.5555/3295222.3295349",
    "container-title": ["NeurIPS"],
  });
  assert.ok(hit);
  assert.equal(hit.year, 2017);
  assert.ok(hit.authors.includes("Ashish Vaswani"));
  assert.ok(hit.excerpt.includes("recurrent"));
  assert.equal(hit.excerpt.includes("<jats"), false);
});
