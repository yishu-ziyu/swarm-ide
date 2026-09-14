import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveResearchNotePath } from "./notes.ts";

test("research notes cannot escape the workspace output directory", () => {
  assert.throws(() => resolveResearchNotePath("ws1", "../secret.md"));
  assert.throws(() => resolveResearchNotePath("ws1", "note.txt"));
  const resolved = resolveResearchNotePath("ws1", "report.md");
  assert.ok(resolved.endsWith(`${"ws1"}/report.md`) || resolved.endsWith(`${"ws1"}\\report.md`));
});
