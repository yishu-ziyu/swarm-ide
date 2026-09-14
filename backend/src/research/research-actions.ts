import { store } from "@/lib/storage";
import { researchStore } from "./research-store";

export async function onHumanResearchMessage(input: {
  workspaceId: string;
  groupId: string;
  senderId: string;
  content: string;
  memberIds: string[];
}) {
  const { store } = await import("@/lib/storage");
  const run = await researchStore.ensureActiveRun({
    workspaceId: input.workspaceId,
    groupId: input.groupId,
  });
  if (!run.question.trim()) {
    await researchStore.setQuestion(run.id, input.content);
    const firstAgent = input.memberIds.find((id) => id !== input.senderId);
    if (firstAgent) {
      const role = await store.getAgentRole({ agentId: firstAgent }).catch(() => null);
      if (role && role !== "human") {
        await researchStore.ensureLead({ runId: run.id, agentId: firstAgent });
      }
    }
    return { steered: false as const, runId: run.id };
  }
  await researchStore.steer({
    runId: run.id,
    constraints: input.content,
    createdBy: input.senderId,
  });
  return { steered: true as const, runId: run.id };
}

export async function advanceResearchRun(runId: string) {
  const run = await researchStore.getRun(runId);
  if (!run) throw new Error("research run not found");

  if (run.phase === "review") {
    const verdicts = await researchStore.latestVerdicts(run.id);
    const claims = await researchStore.listClaims(run.id);
    const supported = claims.filter((c) => c.status === "supported" && c.planVersion === run.planVersion);
    const missing = supported.filter((c) => !verdicts.has(c.id));
    if (missing.length > 0) {
      throw new Error(`Review incomplete: ${missing.length} supported claims have no verdict.`);
    }
  }
  if (run.phase === "cite") {
    const claims = await researchStore.listClaims(run.id);
    const supported = claims.filter((c) => c.planVersion === run.planVersion && c.status === "supported");
    const verdicts = await researchStore.latestVerdicts(run.id);
    const unverifiedFinal = supported.filter((c) => verdicts.get(c.id)?.verdict !== "VERIFIED");
    if (unverifiedFinal.length === supported.length && supported.length > 0) {
      throw new Error("No VERIFIED claims to commit.");
    }
  }

  const advanced = await researchStore.advancePhase(runId);
  if (advanced.to === "review") {
    await spawnReviewer({
      runId: run.id,
      workspaceId: run.workspaceId,
      creatorId: run.leadAgentId ?? "",
    });
  }
  return advanced;
}

async function spawnReviewer(input: { runId: string; workspaceId: string; creatorId: string }) {
  const people = await researchStore.listParticipants(input.runId);
  if (people.some((p) => p.role === "reviewer")) return;
  if (!input.creatorId) return;

  const created = await store.createSubAgentWithP2P({
    workspaceId: input.workspaceId,
    creatorId: input.creatorId,
    role: "reviewer",
    guidance:
      "You did not search. Read list_research_board. For each claim call review_claim with CHALLENGE, ALTERNATIVE, or VERIFIED. Do not message workers.",
  });
  await researchStore.addParticipant({
    runId: input.runId,
    agentId: created.agentId,
    role: "reviewer",
  });
  await store.sendDirectMessage({
    workspaceId: input.workspaceId,
    fromId: input.creatorId,
    toId: created.agentId,
    content:
      "Review the research board. Call list_research_board, then review_claim on each claim with CHALLENGE, ALTERNATIVE, or VERIFIED. Do not message workers.",
    contentType: "text",
    groupName: null,
  });
  const { getAgentRuntime } = await import("@/runtime/agent-runtime");
  getAgentRuntime().wakeAgent(created.agentId);
}

export async function markdownForRun(runId: string): Promise<string> {
  const run = await researchStore.getRun(runId);
  if (!run) throw new Error("research run not found");
  const briefing = await researchStore.getBriefing({ groupId: run.groupId });
  if (!briefing) throw new Error("research briefing not found");
  const { buildResearchReportMarkdown } = await import("./report");
  return buildResearchReportMarkdown({
    question: briefing.run.question,
    phase: briefing.run.phase,
    planVersion: briefing.run.planVersion,
    constraints: briefing.plan?.constraints ?? "",
    conclusions: briefing.currentConclusions,
    unverified: briefing.unverified,
    previous: briefing.previousPlanClaims,
    papers: briefing.papers,
    unused: briefing.unattachedEvidence,
  });
}
