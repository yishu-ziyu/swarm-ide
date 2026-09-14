export const RESEARCH_PHASES = ["isolate", "review", "cite", "commit"] as const;
export type ResearchPhase = (typeof RESEARCH_PHASES)[number];

export const PARTICIPANT_ROLES = ["lead", "worker", "reviewer", "citation"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export const REVIEW_VERDICTS = ["CHALLENGE", "ALTERNATIVE", "VERIFIED"] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export function isResearchPhase(value: string | null | undefined): value is ResearchPhase {
  return RESEARCH_PHASES.includes(value as ResearchPhase);
}

export function nextResearchPhase(phase: ResearchPhase): ResearchPhase | null {
  const index = RESEARCH_PHASES.indexOf(phase);
  if (index < 0 || index >= RESEARCH_PHASES.length - 1) return null;
  return RESEARCH_PHASES[index + 1]!;
}

export type IsolationDecision = { allowed: true } | { allowed: false; reason: string };

/**
 * ArcticSwarm-style isolation: workers cannot talk to peers or the human
 * until commit. The shared board is the evidence store, not group chat.
 */
export function peerMessageAllowed(input: {
  phase: ResearchPhase;
  senderRole: ParticipantRole | null;
  targetRole: ParticipantRole | null;
  targetIsHuman: boolean;
}): IsolationDecision {
  if (input.senderRole === null) return { allowed: true };
  if (input.phase === "commit" && input.senderRole === "lead") return { allowed: true };
  if (input.senderRole === "lead" && !input.targetIsHuman) return { allowed: true };
  if (input.senderRole === "lead" && input.targetIsHuman && input.phase === "commit") {
    return { allowed: true };
  }
  if (input.senderRole === "lead" && input.targetIsHuman) {
    return {
      allowed: false,
      reason: "Lead can message the human only after the report passes review and citation alignment (commit phase).",
    };
  }

  if (input.senderRole === "worker") {
    if (input.targetIsHuman) {
      return { allowed: false, reason: "Isolation: workers report to the lead, not to the human." };
    }
    if (input.targetRole === "lead") return { allowed: true };
    return { allowed: false, reason: "Isolation: workers cannot message peers. Write evidence with web_search / record_claim." };
  }

  if (input.senderRole === "reviewer" || input.senderRole === "citation") {
    if (input.targetRole === "lead") return { allowed: true };
    return {
      allowed: false,
      reason: "Review and citation agents post verdicts with tools, they do not chat with workers.",
    };
  }

  return { allowed: true };
}

export function groupSendAllowed(input: {
  phase: ResearchPhase;
  senderRole: ParticipantRole | null;
  memberRoles: Array<ParticipantRole | "human" | null>;
}): IsolationDecision {
  if (input.senderRole === null || input.senderRole === "lead") {
    if (input.senderRole === "lead" && input.phase !== "commit") {
      const hasHuman = input.memberRoles.includes("human");
      const hasWorker = input.memberRoles.includes("worker");
      if (hasHuman && hasWorker) {
        return {
          allowed: false,
          reason: "Until commit, the lead should not broadcast to a group that includes both workers and the human.",
        };
      }
    }
    if (input.senderRole === "lead") return { allowed: true };
  }
  if (input.senderRole === "worker") {
    const others = input.memberRoles.filter((role) => role && role !== "human" && role !== input.senderRole);
    const peerWorkers = input.memberRoles.filter((role) => role === "worker").length > 1;
    if (peerWorkers || others.includes("worker")) {
      return { allowed: false, reason: "Isolation: workers cannot send to a group that includes other workers." };
    }
  }
  if (input.senderRole === "worker" || input.senderRole === "reviewer" || input.senderRole === "citation") {
    return peerMessageAllowed({
      phase: input.phase,
      senderRole: input.senderRole,
      targetRole: "lead",
      targetIsHuman: input.memberRoles.includes("human"),
    });
  }
  return { allowed: true };
}

export function createTaskSpecComplete(input: {
  objective?: string;
  outputFormat?: string;
  sources?: string;
  boundaries?: string;
}): boolean {
  return Boolean(
    input.objective?.trim() &&
      input.outputFormat?.trim() &&
      input.sources?.trim() &&
      input.boundaries?.trim()
  );
}

export function effortBudget(question: string): { maxWorkers: number; toolCallsHint: string } {
  const text = question.trim();
  const comparison = /compare|vs\.?|versus|对比|比较/i.test(text);
  if (text.length < 40 && !comparison) {
    return { maxWorkers: 1, toolCallsHint: "1 worker, 3-10 tool calls" };
  }
  if (comparison) {
    return { maxWorkers: 3, toolCallsHint: "2-3 workers, 10-15 tool calls each, split by method/paper" };
  }
  return { maxWorkers: 3, toolCallsHint: "up to 3 workers with non-overlapping sources" };
}

export function isFinalConclusion(input: {
  planVersion: number;
  currentPlanVersion: number;
  status: string;
  latestVerdict: ReviewVerdict | null;
  phase: ResearchPhase;
}): boolean {
  if (input.planVersion !== input.currentPlanVersion) return false;
  if (input.status === "needs_reverify" || input.status === "superseded" || input.status === "unverified") {
    return false;
  }
  if (input.status !== "supported") return false;
  if (input.phase !== "commit") return false;
  return input.latestVerdict === "VERIFIED";
}

export function unusedEvidenceDisagreements<T extends { claimId: string | null; excerpt: string; sourceTitle: string }>(
  evidence: T[]
): T[] {
  return evidence.filter((item) => !item.claimId);
}

export function boardVisibleTo(input: {
  phase: ResearchPhase;
  viewerRole: ParticipantRole | null;
}): "own" | "all" {
  if (input.viewerRole === "worker" && input.phase === "isolate") return "own";
  return "all";
}
