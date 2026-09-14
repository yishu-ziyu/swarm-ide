import assert from "node:assert/strict";
import { test } from "node:test";
import { buildResearchReportMarkdown, formatEvidenceApa } from "./report.ts";

test("report includes verified claims with excerpts and keeps unverified separate", () => {
  const evidence = {
    excerpt: "We propose the Transformer...",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    sourceTitle: "Attention Is All You Need",
    authors: ["Ashish Vaswani"],
    publishedYear: 2017,
    doi: "10.5555/3295222.3295349",
    venue: "NeurIPS",
  };
  const md = buildResearchReportMarkdown({
    question: "Compare methods",
    phase: "commit",
    planVersion: 2,
    constraints: "peer-reviewed only",
    conclusions: [
      {
        statement: "Self-attention replaces recurrence.",
        status: "supported",
        evidence: [evidence],
      },
    ],
    unverified: [
      {
        statement: "RNNs are obsolete.",
        status: "unverified",
        evidence: [],
      },
    ],
    previous: [],
    papers: [evidence],
    unused: [],
  });
  assert.ok(md.includes("Compare methods"));
  assert.ok(md.includes("Self-attention replaces recurrence."));
  assert.ok(md.includes("We propose the Transformer"));
  assert.ok(md.includes("Ashish Vaswani (2017)"));
  assert.ok(md.includes("Unverified"));
  assert.ok(md.includes("RNNs are obsolete."));
  assert.ok(formatEvidenceApa(evidence).includes("NeurIPS"));
  assert.ok(formatEvidenceApa(evidence).includes("10.5555"));
});
