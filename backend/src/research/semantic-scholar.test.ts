import assert from "node:assert/strict";
import { test } from "node:test";
import { lookupSemanticScholar } from "./semantic-scholar.ts";

test("semantic scholar lookup does not invent metadata when the API is empty or fails", async () => {
  const empty = await lookupSemanticScholar({
    title: "Attention Is All You Need",
    url: "https://arxiv.org/abs/1706.03762",
    fetchImpl: async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  assert.equal(empty, null);

  const failed = await lookupSemanticScholar({
    title: "Anything",
    url: "https://arxiv.org/abs/1",
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.equal(failed, null);

  const news = await lookupSemanticScholar({
    title: "Breaking: market rally",
    url: "https://cnn.com/story",
    fetchImpl: async () => {
      throw new Error("should not be called for non-academic hosts");
    },
  });
  assert.equal(news, null);
});
