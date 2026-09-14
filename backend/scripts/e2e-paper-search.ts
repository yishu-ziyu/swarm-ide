/**
 * Hard bar: Semantic Scholar returns a real paper with authors, year, and abstract.
 * This is the literature path the product uses — not Tavily.
 */
import assert from "node:assert/strict";
import { searchPapers } from "../src/research/paper-search.ts";

const found = await searchPapers({
  query: "Attention Is All You Need Vaswani",
  maxResults: 5,
});

if (!found.ok) {
  console.error(`FAIL  Semantic Scholar: ${found.error}`);
  process.exit(1);
}

const titled = found.papers.filter((paper) => /attention is all you need/i.test(paper.title));
const hit =
  titled.find((paper) => paper.year === 2017 && paper.authors.some((name) => /vaswani/i.test(name))) ??
  titled.find((paper) => paper.authors.some((name) => /vaswani/i.test(name))) ??
  found.papers.find((paper) => paper.authors.some((name) => /vaswani/i.test(name)));
if (!hit) {
  console.error("FAIL  no Vaswani paper in results", found.papers.map((p) => `${p.year} ${p.title}`));
  process.exit(1);
}

assert.ok(
  hit.authors.some((name) => /vaswani/i.test(name)),
  `authors should include Vaswani, got ${hit.authors.join(", ")}`
);
if (titled.some((paper) => paper.year === 2017)) {
  assert.equal(hit.year, 2017, `canonical year should be 2017, got ${hit.year}`);
}
assert.ok(hit.excerpt.length > 40, "abstract excerpt missing");
assert.ok(hit.url.startsWith("http"), "paper URL missing");
assert.notEqual(hit.authors[0], new URL(hit.url).hostname);

console.log("PASS  live academic paper search");
console.log(`      ${hit.title} (${hit.year}) ${hit.authors.slice(0, 3).join(", ")}`);
console.log(`      excerpt: ${hit.excerpt.slice(0, 160)}…`);
