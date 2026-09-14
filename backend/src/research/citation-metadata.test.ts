import assert from "node:assert/strict";
import { test } from "node:test";
import {
  citationDraftFromSearchHit,
  formatUnknownAuthors,
  formatUnknownYear,
} from "./citation-metadata.ts";

test("search hits do not invent authors or publication year", () => {
  const draft = citationDraftFromSearchHit(
    {
      title: "Attention Is All You Need",
      url: "https://arxiv.org/abs/1706.03762",
      snippet: "We propose a new simple network architecture...",
    },
    { id: "ev-1", query: "transformer", searchedAt: "2026-09-14T00:00:00.000Z" }
  );

  assert.deepEqual(draft.authors, []);
  assert.equal(draft.year, null);
  assert.equal(draft.url, "https://arxiv.org/abs/1706.03762");
  assert.equal(draft.searchedAt, "2026-09-14T00:00:00.000Z");
  assert.equal(formatUnknownYear(draft.year), "n.d.");
  assert.equal(formatUnknownAuthors(draft.authors), "Unknown");
  assert.notEqual(draft.year, new Date().getFullYear());
});
