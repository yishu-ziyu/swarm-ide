import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boardVisibleTo,
  createTaskSpecComplete,
  effortBudget,
  groupSendAllowed,
  isFinalConclusion,
  nextResearchPhase,
  peerMessageAllowed,
  unusedEvidenceDisagreements,
} from "./protocol.ts";

test("workers cannot message peers or the human during isolate", () => {
  const peer = peerMessageAllowed({
    phase: "isolate",
    senderRole: "worker",
    targetRole: "worker",
    targetIsHuman: false,
  });
  assert.equal(peer.allowed, false);

  const human = peerMessageAllowed({
    phase: "isolate",
    senderRole: "worker",
    targetRole: null,
    targetIsHuman: true,
  });
  assert.equal(human.allowed, false);

  const toLead = peerMessageAllowed({
    phase: "isolate",
    senderRole: "worker",
    targetRole: "lead",
    targetIsHuman: false,
  });
  assert.equal(toLead.allowed, true);

  const leadToWorker = peerMessageAllowed({
    phase: "isolate",
    senderRole: "lead",
    targetRole: "worker",
    targetIsHuman: false,
  });
  assert.equal(leadToWorker.allowed, true);
});

test("lead cannot broadcast a final answer to the human before commit", () => {
  const early = peerMessageAllowed({
    phase: "isolate",
    senderRole: "lead",
    targetRole: null,
    targetIsHuman: true,
  });
  assert.equal(early.allowed, false);

  const done = peerMessageAllowed({
    phase: "commit",
    senderRole: "lead",
    targetRole: null,
    targetIsHuman: true,
  });
  assert.equal(done.allowed, true);
});

test("group send is blocked when a worker's group includes other workers", () => {
  const blocked = groupSendAllowed({
    phase: "isolate",
    senderRole: "worker",
    memberRoles: ["worker", "worker", "human"],
  });
  assert.equal(blocked.allowed, false);
});

test("create during research requires a full task spec", () => {
  assert.equal(createTaskSpecComplete({ objective: "find papers" }), false);
  assert.equal(
    createTaskSpecComplete({
      objective: "compare methods in peer-reviewed papers",
      outputFormat: "claims with evidenceIds",
      sources: "peer-reviewed only",
      boundaries: "no news, no duplicate queries",
    }),
    true
  );
});

test("only verified supported claims in commit enter the final report", () => {
  assert.equal(
    isFinalConclusion({
      planVersion: 1,
      currentPlanVersion: 1,
      status: "supported",
      latestVerdict: "VERIFIED",
      phase: "isolate",
    }),
    false
  );
  assert.equal(
    isFinalConclusion({
      planVersion: 1,
      currentPlanVersion: 1,
      status: "supported",
      latestVerdict: "CHALLENGE",
      phase: "commit",
    }),
    false
  );
  assert.equal(
    isFinalConclusion({
      planVersion: 1,
      currentPlanVersion: 1,
      status: "supported",
      latestVerdict: "VERIFIED",
      phase: "commit",
    }),
    true
  );
});

test("unused evidence becomes disagreements; isolate workers only see their own board", () => {
  const unused = unusedEvidenceDisagreements([
    { claimId: null, excerpt: "a", sourceTitle: "A" },
    { claimId: "c1", excerpt: "b", sourceTitle: "B" },
  ]);
  assert.equal(unused.length, 1);
  assert.equal(boardVisibleTo({ phase: "isolate", viewerRole: "worker" }), "own");
  assert.equal(boardVisibleTo({ phase: "review", viewerRole: "worker" }), "all");
  assert.equal(nextResearchPhase("isolate"), "review");
  assert.equal(nextResearchPhase("commit"), null);
  assert.equal(effortBudget("What is X?").maxWorkers, 1);
  assert.ok(effortBudget("Compare methods in transformers vs RNNs").maxWorkers >= 2);
});
