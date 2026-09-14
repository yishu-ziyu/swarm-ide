import assert from "node:assert/strict";
import { test } from "node:test";
import {
  claimStatusForEvidenceCount,
  isCurrentConclusion,
  partitionClaims,
} from "./claim-policy.ts";

test("claims without evidence are unverified; old-plan claims stay out of current conclusions", () => {
  assert.equal(claimStatusForEvidenceCount(0), "unverified");
  assert.equal(claimStatusForEvidenceCount(2), "supported");

  const claims = [
    { id: "c1", planVersion: 2, status: "supported" as const },
    { id: "c2", planVersion: 2, status: "unverified" as const },
    { id: "c3", planVersion: 1, status: "supported" as const },
    { id: "c4", planVersion: 2, status: "needs_reverify" as const },
    { id: "c5", planVersion: 2, status: "superseded" as const },
  ];

  assert.equal(isCurrentConclusion(claims[0]!, 2), true);
  assert.equal(isCurrentConclusion(claims[2]!, 2), false);
  assert.equal(isCurrentConclusion(claims[3]!, 2), false);

  const parts = partitionClaims(claims, 2);
  assert.deepEqual(
    parts.current.map((c) => c.id),
    ["c1"]
  );
  assert.deepEqual(
    parts.unverified.map((c) => c.id),
    ["c2"]
  );
  assert.deepEqual(
    parts.archived.map((c) => c.id),
    ["c3", "c4", "c5"]
  );
});
