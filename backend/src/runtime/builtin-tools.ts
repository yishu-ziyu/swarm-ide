import path from "node:path";
import { promisify } from "node:util";
import { exec } from "node:child_process";

import { getConfig, isHostBashAllowed } from "@/lib/config";
import { store } from "@/lib/storage";
import { PaperSearchTool } from "@/lib/tools/builtInTools/PaperSearchTool";
import { SearchTool } from "@/lib/tools/builtInTools/SearchTool";
import { researchStore } from "../research/research-store";
import { advanceResearchRun, markdownForRun } from "../research/research-actions";
import { fetchSourcePage } from "../research/fetch-source";
import { saveResearchNote } from "../research/notes";
import {
  boardVisibleTo,
  createTaskSpecComplete,
  effortBudget,
  REVIEW_VERDICTS,
  type ParticipantRole,
  type ReviewVerdict,
} from "../research/protocol";
import { formatSkillPrompt, getSkillLoader } from "./skill-loader";
import { getWorkspaceUIBus } from "./ui-bus";
import { safeJsonParse } from "./utils";
import type { ToolCtx, ToolResult } from "./tool-ctx";

async function toolSelf(ctx: ToolCtx): Promise<ToolResult> {
  const role = await store.getAgentRole({ agentId: ctx.agentId }).catch(() => null);
  ctx.emitDone(true);
  return { ok: true, agentId: ctx.agentId, workspaceId: ctx.workspaceId, role };
}

async function toolGetSkill(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ skill_name?: string; name?: string }>(ctx.argumentsText, {});
  const skillName = (args.skill_name ?? args.name ?? "").trim();
  if (!skillName) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing skill_name" };
  }
  const loader = await getSkillLoader();
  const skill = await loader.getSkill(skillName);
  if (!skill) {
    ctx.emitDone(false);
    return { ok: false, error: `Unknown skill: ${skillName}`, available: await loader.listSkills() };
  }
  ctx.emitDone(true);
  return { ok: true, content: formatSkillPrompt(skill) };
}

async function toolSearchPapers(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ query?: string; maxResults?: number; yearFrom?: number }>(ctx.argumentsText, {});
  const query = (args.query ?? "").trim();
  if (!query) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing query" };
  }
  const result = await PaperSearchTool.call(
    {
      query,
      maxResults: Number(args.maxResults) > 0 ? Number(args.maxResults) : 8,
      yearFrom: Number(args.yearFrom) > 0 ? Number(args.yearFrom) : undefined,
    },
    {
      context: { workspaceId: ctx.workspaceId, agentId: ctx.agentId, groupId: ctx.groupId, messages: [] },
      canUseTool: () => true,
      signal: ctx.signal,
    }
  );
  ctx.emitDone(result.success);
  if (!result.success) return { ok: false, error: result.error ?? "search_papers failed" };
  return { ok: true, ...(result.data as Record<string, unknown>) };
}

async function toolWebSearch(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ query?: string; maxResults?: number; topic?: string }>(ctx.argumentsText, {});
  const query = (args.query ?? "").trim();
  if (!query) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing query" };
  }
  const result = await SearchTool.call(
    {
      query,
      maxResults: Number(args.maxResults) > 0 ? Number(args.maxResults) : 8,
      topic: args.topic === "news" ? "news" : "general",
    },
    {
      context: { workspaceId: ctx.workspaceId, agentId: ctx.agentId, groupId: ctx.groupId, messages: [] },
      canUseTool: () => true,
      signal: ctx.signal,
    }
  );
  ctx.emitDone(result.success);
  if (!result.success) return { ok: false, error: result.error ?? "web_search failed" };
  return { ok: true, ...(result.data as Record<string, unknown>) };
}

async function toolBash(ctx: ToolCtx): Promise<ToolResult> {
  if (!isHostBashAllowed()) {
    ctx.emitDone(false);
    return { ok: false, error: "Host shell is disabled. Enable allowHostBash in settings to authorize bash." };
  }
  const args = safeJsonParse<{ command?: string; cwd?: string; timeoutMs?: number; maxOutputKB?: number }>(
    ctx.argumentsText,
    {}
  );
  const command = (args.command ?? "").trim();
  if (!command) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing command" };
  }
  const workspaceRoot = process.env.AGENT_WORKDIR ?? process.cwd();
  const requestedCwd = (args.cwd ?? "").trim();
  let finalCwd = workspaceRoot;
  if (requestedCwd) {
    const resolved = path.isAbsolute(requestedCwd)
      ? requestedCwd
      : path.resolve(workspaceRoot, requestedCwd);
    if (!resolved.startsWith(path.resolve(workspaceRoot))) {
      ctx.emitDone(false);
      return { ok: false, error: "cwd must be within workspace root", workspaceRoot };
    }
    finalCwd = resolved;
  }
  const timeoutMs = Number(args.timeoutMs) > 0 ? Number(args.timeoutMs) : 120000;
  const maxOutputKB = Number(args.maxOutputKB) > 0 ? Number(args.maxOutputKB) : 1024;
  try {
    const { stdout, stderr } = await promisify(exec)(command, {
      cwd: finalCwd,
      timeout: timeoutMs,
      maxBuffer: Math.max(64 * 1024, Math.floor(maxOutputKB * 1024)),
      shell: "/bin/bash",
      signal: ctx.signal,
    });
    ctx.emitDone(true);
    return { ok: true, stdout, stderr, exitCode: 0, cwd: finalCwd };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; signal?: string; message?: string };
    ctx.emitDone(false);
    return {
      ok: false,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: typeof e.code === "number" ? e.code : null,
      signal: typeof e.signal === "string" ? e.signal : null,
      cwd: finalCwd,
      error: String(e.message ?? err),
    };
  }
}

async function toolRecordClaim(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ statement?: string; evidenceIds?: string[] }>(ctx.argumentsText, {});
  const statement = (args.statement ?? "").trim();
  if (!statement) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing statement" };
  }
  const run = await researchStore.ensureActiveRun({ workspaceId: ctx.workspaceId, groupId: ctx.groupId });
  const claim = await researchStore.recordClaim({
    runId: run.id,
    statement,
    agentId: ctx.agentId,
    evidenceIds: Array.isArray(args.evidenceIds) ? args.evidenceIds : [],
  });
  ctx.emitDone(true);
  return { ok: true, claim };
}

async function toolListResearchBoard(ctx: ToolCtx): Promise<ToolResult> {
  const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  if (!run) {
    ctx.emitDone(false);
    return { ok: false, error: "No active research run" };
  }
  const participant = await researchStore.getParticipant({ runId: run.id, agentId: ctx.agentId });
  const briefing = await researchStore.getBriefing({ groupId: ctx.groupId });
  const visibility = boardVisibleTo({ phase: run.phase, viewerRole: participant?.role ?? null });
  ctx.emitDone(true);
  if (visibility === "own" && briefing) {
    return {
      ok: true,
      phase: run.phase,
      question: run.question,
      claims: briefing.currentConclusions.concat(briefing.unverified).filter((c) => c.agentId === ctx.agentId),
      evidence: briefing.evidence.filter((item) => item.agentId === ctx.agentId),
      unusedEvidence: briefing.unattachedEvidence.filter((item) => item.agentId === ctx.agentId),
    };
  }
  return { ok: true, ...briefing, phase: run.phase };
}

async function toolReviewClaim(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ claimId?: string; verdict?: string; note?: string }>(ctx.argumentsText, {});
  const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  if (!run) {
    ctx.emitDone(false);
    return { ok: false, error: "No active research run" };
  }
  const participant = await researchStore.getParticipant({ runId: run.id, agentId: ctx.agentId });
  if (participant?.role !== "reviewer") {
    ctx.emitDone(false);
    return { ok: false, error: "Only the reviewer (who did not search) may call review_claim." };
  }
  if (run.phase !== "review") {
    ctx.emitDone(false);
    return { ok: false, error: `review_claim is only valid in review phase (now ${run.phase}).` };
  }
  const verdict = args.verdict as ReviewVerdict;
  if (!REVIEW_VERDICTS.includes(verdict)) {
    ctx.emitDone(false);
    return { ok: false, error: "verdict must be CHALLENGE, ALTERNATIVE, or VERIFIED" };
  }
  const claimId = (args.claimId ?? "").trim();
  const note = (args.note ?? "").trim();
  if (!claimId || !note) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing claimId or note" };
  }
  const posted = await researchStore.reviewClaim({
    runId: run.id,
    claimId,
    reviewerId: ctx.agentId,
    verdict,
    note,
  });
  ctx.emitDone(true);
  return { ok: true, review: posted };
}

async function toolAlignClaimEvidence(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ claimId?: string; evidenceIds?: string[] }>(ctx.argumentsText, {});
  const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  if (!run) {
    ctx.emitDone(false);
    return { ok: false, error: "No active research run" };
  }
  if (run.phase !== "cite" && run.phase !== "review") {
    ctx.emitDone(false);
    return { ok: false, error: `align_claim_evidence is for cite (now ${run.phase}).` };
  }
  const claimId = (args.claimId ?? "").trim();
  const evidenceIds = Array.isArray(args.evidenceIds) ? args.evidenceIds : [];
  if (!claimId || evidenceIds.length === 0) {
    ctx.emitDone(false);
    return { ok: false, error: "Need claimId and evidenceIds" };
  }
  const aligned = await researchStore.alignClaimEvidence({ runId: run.id, claimId, evidenceIds });
  ctx.emitDone(true);
  return { ok: true, claim: aligned };
}

async function toolAdvanceResearchPhase(ctx: ToolCtx): Promise<ToolResult> {
  const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  if (!run) {
    ctx.emitDone(false);
    return { ok: false, error: "No active research run" };
  }
  const participant = await researchStore.getParticipant({ runId: run.id, agentId: ctx.agentId });
  if (participant?.role !== "lead" && run.leadAgentId !== ctx.agentId) {
    ctx.emitDone(false);
    return { ok: false, error: "Only the lead may advance the research phase." };
  }
  try {
    const advanced = await advanceResearchRun(run.id);
    ctx.emitDone(true);
    return { ok: true, ...advanced };
  } catch (err) {
    ctx.emitDone(false);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function toolFetchSource(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ url?: string }>(ctx.argumentsText, {});
  const url = (args.url ?? "").trim();
  if (!url) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing url" };
  }
  try {
    const page = await fetchSourcePage({ url, signal: ctx.signal });
    const run = await researchStore.ensureActiveRun({ workspaceId: ctx.workspaceId, groupId: ctx.groupId });
    const evidence = await researchStore.recordEvidence({
      runId: run.id,
      agentId: ctx.agentId,
      sourceUrl: page.url,
      sourceTitle: page.title,
      excerpt: page.excerpt,
      kind: "web",
      enrich: false,
    });
    ctx.emitDone(true);
    return { ok: true, evidenceId: evidence.id, title: page.title, excerpt: page.excerpt };
  } catch (err) {
    ctx.emitDone(false);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function toolSaveResearchNote(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ filename?: string; content?: string }>(ctx.argumentsText, {});
  try {
    const saved = await saveResearchNote({
      workspaceId: ctx.workspaceId,
      filename: args.filename ?? "notes.md",
      content: args.content ?? "",
    });
    ctx.emitDone(true);
    return { ok: true, ...saved };
  } catch (err) {
    ctx.emitDone(false);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function toolExportReport(ctx: ToolCtx): Promise<ToolResult> {
  const run = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  if (!run) {
    ctx.emitDone(false);
    return { ok: false, error: "No active research run" };
  }
  try {
    const markdown = await markdownForRun(run.id);
    const saved = await saveResearchNote({
      workspaceId: ctx.workspaceId,
      filename: `report-${run.id.slice(0, 8)}.md`,
      content: markdown,
    });
    ctx.emitDone(true);
    return { ok: true, markdown, ...saved };
  } catch (err) {
    ctx.emitDone(false);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function toolCreate(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{
    role?: string;
    guidance?: string;
    objective?: string;
    outputFormat?: string;
    sources?: string;
    boundaries?: string;
  }>(ctx.argumentsText, {});
  const role = (args.role ?? "").trim();
  const guidance = (args.guidance ?? "").trim();
  if (!role) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing role" };
  }
  const research = await researchStore.getActiveRunForGroup({ groupId: ctx.groupId });
  const normalizedRole = role.toLowerCase();
  const participantRole: ParticipantRole =
    normalizedRole === "reviewer"
      ? "reviewer"
      : normalizedRole === "citation" || normalizedRole === "citation-agent"
        ? "citation"
        : "worker";
  if (research && participantRole === "worker") {
    if (
      !createTaskSpecComplete({
        objective: args.objective,
        outputFormat: args.outputFormat,
        sources: args.sources,
        boundaries: args.boundaries,
      })
    ) {
      ctx.emitDone(false);
      return {
        ok: false,
        error: "Research workers need objective, outputFormat, sources, and boundaries so they do not duplicate search.",
      };
    }
    const budget = effortBudget(research.question);
    const workers = await researchStore.workerCount(research.id);
    if (workers >= budget.maxWorkers) {
      ctx.emitDone(false);
      return {
        ok: false,
        error: `Effort budget is ${budget.maxWorkers} workers for this question (${budget.toolCallsHint}).`,
      };
    }
  }
  const maxAgents = getConfig().researchMaxAgents ?? 6;
  const existingAgents = await store.listAgentsMeta({ workspaceId: ctx.workspaceId });
  if (existingAgents.filter((agent) => agent.role !== "human").length >= maxAgents) {
    ctx.emitDone(false);
    return {
      ok: false,
      error: `Agent limit reached (${maxAgents}). Raise researchMaxAgents to expand the swarm.`,
    };
  }
  const taskSpec = research
    ? [
        args.objective ? `Objective: ${args.objective}` : "",
        args.outputFormat ? `Output format: ${args.outputFormat}` : "",
        args.sources ? `Sources: ${args.sources}` : "",
        args.boundaries ? `Boundaries: ${args.boundaries}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const created = await store.createSubAgentWithP2P({
    workspaceId: ctx.workspaceId,
    creatorId: ctx.agentId,
    role,
    guidance: [guidance, taskSpec].filter(Boolean).join("\n\n"),
  });
  ctx.ensureRunner(created.agentId);
  if (research) {
    await researchStore.addParticipant({
      runId: research.id,
      agentId: created.agentId,
      role: participantRole,
      taskSpec: taskSpec || null,
    });
  }
  getWorkspaceUIBus().emit(ctx.workspaceId, {
    event: "ui.agent.created",
    data: { workspaceId: ctx.workspaceId, agent: { id: created.agentId, role, parentId: ctx.agentId } },
  });
  ctx.emitDone(true);
  return { ok: true, agentId: created.agentId, role, groupId: created.groupId };
}

async function toolListAgents(ctx: ToolCtx): Promise<ToolResult> {
  const agents = await store.listAgentsMeta({ workspaceId: ctx.workspaceId });
  ctx.emitDone(true);
  return { ok: true, agents };
}

async function toolSend(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ to?: string; content?: string }>(ctx.argumentsText, {});
  const to = (args.to ?? "").trim();
  const content = (args.content ?? "").trim();
  if (!to || !content) {
    ctx.emitDone(false);
    return { ok: false, error: !to ? "Missing to" : "Missing content" };
  }
  const blocked = await ctx.researchSendGate({ groupId: ctx.groupId, targetId: to });
  if (blocked) {
    ctx.emitDone(false);
    return blocked;
  }
  const outbound = await ctx.deliverSend({
    processingRunId: ctx.processingRunId,
    groupId: ctx.groupId,
    toolName: "send",
    target: to,
    send: async () => {
      const delivered = await store.sendDirectMessage({
        workspaceId: ctx.workspaceId,
        fromId: ctx.agentId,
        toId: to,
        content,
        contentType: "text",
        groupName: null,
      });
      return { id: delivered.messageId, ...delivered };
    },
  });
  if (!outbound.reused && "groupId" in outbound && outbound.groupId) {
    const deliveredGroupId = String(outbound.groupId);
    const directMembers = await store.listGroupMemberIds({ groupId: deliveredGroupId });
    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.message.created",
      data: {
        workspaceId: ctx.workspaceId,
        groupId: deliveredGroupId,
        memberIds: directMembers,
        message: {
          id: outbound.id,
          senderId: ctx.agentId,
          sendTime:
            "sendTime" in outbound && typeof outbound.sendTime === "string"
              ? outbound.sendTime
              : new Date().toISOString(),
        },
      },
    });
    const toRole = await store.getAgentRole({ agentId: to }).catch(() => null);
    if (toRole && toRole !== "human") {
      ctx.ensureRunner(to);
      ctx.wakeAgent(to);
    }
  }
  ctx.emitDone(true);
  return outbound;
}

async function toolListGroups(ctx: ToolCtx): Promise<ToolResult> {
  const groups = await store.listGroups({ workspaceId: ctx.workspaceId, agentId: ctx.agentId });
  ctx.emitDone(true);
  return { ok: true, groups };
}

async function toolListGroupMembers(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ groupId?: string }>(ctx.argumentsText, {});
  const groupId = (args.groupId ?? "").trim();
  if (!groupId) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing groupId" };
  }
  const members = await store.listGroupMemberIds({ groupId });
  if (!members.includes(ctx.agentId)) {
    ctx.emitDone(false);
    return { ok: false, error: "Access denied" };
  }
  ctx.emitDone(true);
  return { ok: true, members };
}

async function toolCreateGroup(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ memberIds?: string[]; name?: string }>(ctx.argumentsText, {});
  const memberIds = (args.memberIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (memberIds.length < 2) {
    ctx.emitDone(false);
    return { ok: false, error: "memberIds must have >= 2 members" };
  }
  if (!memberIds.includes(ctx.agentId)) memberIds.push(ctx.agentId);
  let groupId = "";
  let groupName: string | null = args.name ?? null;
  if (memberIds.length === 2) {
    const existing = await store.findLatestExactP2PGroupId({
      workspaceId: ctx.workspaceId,
      memberA: memberIds[0]!,
      memberB: memberIds[1]!,
      preferredName: args.name ?? null,
    });
    groupId =
      (await store.mergeDuplicateExactP2PGroups({
        workspaceId: ctx.workspaceId,
        memberA: memberIds[0]!,
        memberB: memberIds[1]!,
        preferredName: args.name ?? null,
      })) ??
      (
        await store.createGroup({
          workspaceId: ctx.workspaceId,
          memberIds,
          name: args.name ?? undefined,
        })
      ).id;
    if (!existing) {
      getWorkspaceUIBus().emit(ctx.workspaceId, {
        event: "ui.group.created",
        data: { workspaceId: ctx.workspaceId, group: { id: groupId, name: groupName, memberIds } },
      });
    }
  } else {
    const created = await store.createGroup({
      workspaceId: ctx.workspaceId,
      memberIds,
      name: args.name ?? undefined,
    });
    groupId = created.id;
    groupName = created.name;
    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.group.created",
      data: { workspaceId: ctx.workspaceId, group: { id: groupId, name: groupName, memberIds } },
    });
  }
  ctx.emitDone(true);
  return { ok: true, groupId, name: groupName };
}

async function toolSendGroupMessage(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ groupId?: string; content?: string; contentType?: string }>(ctx.argumentsText, {});
  const groupId = (args.groupId ?? "").trim();
  const content = (args.content ?? "").trim();
  if (!groupId || !content) {
    ctx.emitDone(false);
    return { ok: false, error: !groupId ? "Missing groupId" : "Missing content" };
  }
  const members = await store.listGroupMemberIds({ groupId });
  if (!members.includes(ctx.agentId)) {
    ctx.emitDone(false);
    return { ok: false, error: "Access denied" };
  }
  const blockedGroup = await ctx.researchSendGate({ groupId: ctx.groupId, memberIds: members });
  if (blockedGroup) {
    ctx.emitDone(false);
    return blockedGroup;
  }
  const outbound = await ctx.deliverSend({
    processingRunId: ctx.processingRunId,
    groupId: ctx.groupId,
    toolName: "send_group_message",
    target: groupId,
    send: () =>
      store.sendMessage({
        groupId,
        senderId: ctx.agentId,
        content,
        contentType: args.contentType ?? "text",
      }),
  });
  if (!outbound.reused) {
    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.message.created",
      data: {
        workspaceId: ctx.workspaceId,
        groupId,
        memberIds: members,
        message: {
          id: outbound.id,
          senderId: ctx.agentId,
          sendTime:
            "sendTime" in outbound && typeof outbound.sendTime === "string"
              ? outbound.sendTime
              : new Date().toISOString(),
        },
      },
    });
    for (const memberId of members) {
      if (memberId === ctx.agentId) continue;
      const role = await store.getAgentRole({ agentId: memberId }).catch(() => null);
      if (role === "human" || role === null) continue;
      ctx.ensureRunner(memberId);
      ctx.wakeAgent(memberId);
    }
  }
  ctx.emitDone(true);
  return outbound;
}

async function toolSendDirectMessage(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ toAgentId?: string; content?: string; contentType?: string }>(ctx.argumentsText, {});
  const toAgentId = (args.toAgentId ?? "").trim();
  const content = (args.content ?? "").trim();
  if (!toAgentId || !content) {
    ctx.emitDone(false);
    return { ok: false, error: !toAgentId ? "Missing toAgentId" : "Missing content" };
  }
  const blockedDirect = await ctx.researchSendGate({ groupId: ctx.groupId, targetId: toAgentId });
  if (blockedDirect) {
    ctx.emitDone(false);
    return blockedDirect;
  }
  const outbound = await ctx.deliverSend({
    processingRunId: ctx.processingRunId,
    groupId: ctx.groupId,
    toolName: "send_direct_message",
    target: toAgentId,
    send: async () => {
      const delivered = await store.sendDirectMessage({
        workspaceId: ctx.workspaceId,
        fromId: ctx.agentId,
        toId: toAgentId,
        content,
        contentType: args.contentType ?? "text",
        groupName: null,
      });
      return { id: delivered.messageId, ...delivered };
    },
  });
  if (!outbound.reused && "groupId" in outbound && outbound.groupId) {
    const groupId = String(outbound.groupId);
    const directMembers = await store.listGroupMemberIds({ groupId });
    getWorkspaceUIBus().emit(ctx.workspaceId, {
      event: "ui.message.created",
      data: {
        workspaceId: ctx.workspaceId,
        groupId,
        memberIds: directMembers,
        message: {
          id: outbound.id,
          senderId: ctx.agentId,
          sendTime:
            "sendTime" in outbound && typeof outbound.sendTime === "string"
              ? outbound.sendTime
              : new Date().toISOString(),
        },
      },
    });
    ctx.ensureRunner(toAgentId);
    ctx.wakeAgent(toAgentId);
  }
  ctx.emitDone(true);
  return {
    ok: true,
    reused: outbound.reused,
    channel: "channel" in outbound ? outbound.channel : undefined,
    groupId: "groupId" in outbound ? outbound.groupId : undefined,
    messageId: outbound.id,
    sendTime: "sendTime" in outbound ? outbound.sendTime : undefined,
  };
}

async function toolGetGroupMessages(ctx: ToolCtx): Promise<ToolResult> {
  const args = safeJsonParse<{ groupId?: string }>(ctx.argumentsText, {});
  const groupId = (args.groupId ?? "").trim();
  if (!groupId) {
    ctx.emitDone(false);
    return { ok: false, error: "Missing groupId" };
  }
  const members = await store.listGroupMemberIds({ groupId });
  if (!members.includes(ctx.agentId)) {
    ctx.emitDone(false);
    return { ok: false, error: "Access denied" };
  }
  const messages = await store.listMessages({ groupId });
  ctx.emitDone(true);
  return { ok: true, messages };
}

export const builtinToolHandlers: Record<string, (ctx: ToolCtx) => Promise<ToolResult>> = {
  self: toolSelf,
  get_skill: toolGetSkill,
  search_papers: toolSearchPapers,
  web_search: toolWebSearch,
  bash: toolBash,
  record_claim: toolRecordClaim,
  list_research_board: toolListResearchBoard,
  review_claim: toolReviewClaim,
  align_claim_evidence: toolAlignClaimEvidence,
  advance_research_phase: toolAdvanceResearchPhase,
  fetch_source: toolFetchSource,
  save_research_note: toolSaveResearchNote,
  export_report: toolExportReport,
  create: toolCreate,
  list_agents: toolListAgents,
  send: toolSend,
  list_groups: toolListGroups,
  list_group_members: toolListGroupMembers,
  create_group: toolCreateGroup,
  send_group_message: toolSendGroupMessage,
  send_direct_message: toolSendDirectMessage,
  get_group_messages: toolGetGroupMessages,
};
