import assert from "node:assert/strict";
import { test } from "node:test";
import { assertHttpUrl, htmlToExcerpt } from "./fetch-source.ts";

test("fetch_source rejects non-http URLs and strips tags to an excerpt", () => {
  assert.throws(() => assertHttpUrl("file:///etc/passwd"));
  const parsed = htmlToExcerpt(
    "<html><head><title>A Paper</title></head><body><script>x</script><p>Hello evidence.</p></body></html>"
  );
  assert.equal(parsed.title, "A Paper");
  assert.equal(parsed.excerpt.includes("Hello evidence."), true);
  assert.equal(parsed.excerpt.includes("script"), false);
});
