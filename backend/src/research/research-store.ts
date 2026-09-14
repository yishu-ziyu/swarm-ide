import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  researchClaims,
  researchEvidence,
  researchParticipants,
  researchPlanRevisions,
  researchReviews,
  researchRuns,
} from "@/db/schema";
import { claimStatusForEvidenceCount, partitionClaims, type ClaimStatus } from "./claim-policy";
import {
  boardVisibleTo,
  effortBudget,
  isFinalConclusion,
  isResearchPhase,
  nextResearchPhase,
  unusedEvidenceDisagreements,
  type ParticipantRole,
  type ResearchPhase,
  type ReviewVerdict,
} from "./protocol";
import { lookupSemanticScholar } from "./semantic-scholar";
import { getWorkspaceUIBus } from "@/runtime/ui-bus";

type UUID = string;

function now() {
  return new Date();
}

function uuid(): UUID {
  return crypto.randomUUID();
}

export type ResearchRunRecord = {
  id: UUID;
  workspaceId: UUID;
  groupId: UUID;
  question: string;
  status: string;
  planVersion: number;
  phase: ResearchPhase;
  leadAgentId: UUID | null;
  createdAt: string;
  updatedAt: string;
};

export type ResearchParticipantRecord = {
  runId: UUID;
  agentId: UUID;
  role: ParticipantRole;
  taskSpec: string | null;
};

export type ResearchReviewRecord = {
  id: UUID;
  runId: UUID;
  claimId: UUID;
  reviewerId: UUID;
  verdict: ReviewVerdict;
  note: string;
  createdAt: string;
};

export type ResearchEvidenceRecord = {
  id: UUID;
  runId: UUID;
  claimId: UUID | null;
  excerpt: string;
  sourceUrl: string;
  sourceTitle: string;
  authors: string[];
  publishedYear: number | null;
  doi: string | null;
  locator: string | null;
  kind: "paper" | "web";
  venue: string | null;
  retrievedAt: string;
  agentId: UUID | null;
  query: string | null;
};

export type ResearchClaimRecord = {
  id: UUID;
  runId: UUID;
  planVersion: number;
  statement: string;
  status: ClaimStatus;
  agentId: UUID | null;
  createdAt: string;
  evidence: ResearchEvidenceRecord[];
};

export type ResearchPlanRevisionRecord = {
  id: UUID;
  runId: UUID;
  version: number;
  constraints: string;
  createdBy: UUID | null;
  createdAt: string;
};

function parseAuthors(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // ignore
  }
  return [];
}

function mapRun(row: typeof researchRuns.$inferSelect): ResearchRunRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    groupId: row.groupId,
    question: row.question,
    status: row.status,
    planVersion: row.planVersion,
    phase: isResearchPhase(row.phase) ? row.phase : "isolate",
    leadAgentId: row.leadAgentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEvidence(row: typeof researchEvidence.$inferSelect): ResearchEvidenceRecord {
  return {
    id: row.id,
    runId: row.runId,
    claimId: row.claimId,
    excerpt: row.excerpt,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    authors: parseAuthors(row.authors),
    publishedYear: row.publishedYear,
    doi: row.doi,
    locator: row.locator,
    kind: row.kind === "paper" ? "paper" : "web",
    venue: row.venue,
    retrievedAt: row.retrievedAt.toISOString(),
    agentId: row.agentId,
    query: row.query,
  };
}

function mapClaim(row: typeof researchClaims.$inferSelect, evidence: ResearchEvidenceRecord[]): ResearchClaimRecord {
  return {
    id: row.id,
    runId: row.runId,
    planVersion: row.planVersion,
    statement: row.statement,
    status: row.status as ClaimStatus,
    agentId: row.agentId,
    createdAt: row.createdAt.toISOString(),
    evidence,
  };
}

export const researchStore = {
  async ensureActiveRun(input: { workspaceId: UUID; groupId: UUID }): Promise<ResearchRunRecord> {
    const db = getDb();
    const existing = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.groupId, input.groupId), eq(researchRuns.status, "active")))
      .orderBy(desc(researchRuns.updatedAt))
      .limit(1);
    if (existing[0]) return mapRun(existing[0]);

    const stamp = now();
    const row = {
      id: uuid(),
      workspaceId: input.workspaceId,
      groupId: input.groupId,
      question: "",
      status: "active",
      planVersion: 1,
      phase: "isolate",
      leadAgentId: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.insert(researchRuns).values(row);
    await db.insert(researchPlanRevisions).values({
      id: uuid(),
      runId: row.id,
      version: 1,
      constraints: "",
      createdBy: null,
      createdAt: stamp,
    });
    return mapRun(row);
  },

  async getRun(runId: UUID): Promise<ResearchRunRecord | null> {
    const db = getDb();
    const rows = await db.select().from(researchRuns).where(eq(researchRuns.id, runId)).limit(1);
    return rows[0] ? mapRun(rows[0]) : null;
  },

  async getActiveRunForGroup(input: { groupId: UUID }): Promise<ResearchRunRecord | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.groupId, input.groupId), eq(researchRuns.status, "active")))
      .orderBy(desc(researchRuns.updatedAt))
      .limit(1);
    return rows[0] ? mapRun(rows[0]) : null;
  },

  async setQuestion(runId: UUID, question: string): Promise<ResearchRunRecord | null> {
    const db = getDb();
    const stamp = now();
    await db
      .update(researchRuns)
      .set({ question, updatedAt: stamp })
      .where(eq(researchRuns.id, runId));
    return this.getRun(runId);
  },

  async listPlanRevisions(runId: UUID): Promise<ResearchPlanRevisionRecord[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchPlanRevisions)
      .where(eq(researchPlanRevisions.runId, runId))
      .orderBy(desc(researchPlanRevisions.version));
    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      version: row.version,
      constraints: row.constraints,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  async steer(input: {
    runId: UUID;
    constraints: string;
    createdBy?: UUID | null;
  }): Promise<{ run: ResearchRunRecord; planVersion: number }> {
    const run = await this.getRun(input.runId);
    if (!run) throw new Error("research run not found");
    const db = getDb();
    const nextVersion = run.planVersion + 1;
    const stamp = now();
    await db.insert(researchPlanRevisions).values({
      id: uuid(),
      runId: input.runId,
      version: nextVersion,
      constraints: input.constraints,
      createdBy: input.createdBy ?? null,
      createdAt: stamp,
    });
    await db
      .update(researchRuns)
      .set({ planVersion: nextVersion, phase: "isolate", updatedAt: stamp })
      .where(eq(researchRuns.id, input.runId));

    const currentClaims = await db
      .select()
      .from(researchClaims)
      .where(eq(researchClaims.runId, input.runId));
    for (const claim of currentClaims) {
      if (claim.planVersion === run.planVersion && claim.status !== "superseded") {
        await db
          .update(researchClaims)
          .set({ status: "needs_reverify" })
          .where(eq(researchClaims.id, claim.id));
      }
    }

    const updated = await this.getRun(input.runId);
    if (!updated) throw new Error("research run not found");
    return { run: updated, planVersion: nextVersion };
  },

  async recordEvidence(input: {
    runId: UUID;
    agentId?: UUID | null;
    sourceUrl: string;
    sourceTitle: string;
    excerpt: string;
    query?: string | null;
    claimId?: UUID | null;
    authors?: string[];
    publishedYear?: number | null;
    doi?: string | null;
    locator?: string | null;
    kind?: "paper" | "web";
    venue?: string | null;
    enrich?: boolean;
  }): Promise<ResearchEvidenceRecord> {
    let authors = input.authors ?? [];
    let publishedYear = input.publishedYear ?? null;
    let doi = input.doi ?? null;

    if (input.enrich !== false && authors.length === 0 && publishedYear == null) {
      const meta = await lookupSemanticScholar({
        title: input.sourceTitle,
        url: input.sourceUrl,
      });
      if (meta) {
        if (meta.authors.length > 0) authors = meta.authors;
        if (meta.year != null) publishedYear = meta.year;
        if (meta.doi) doi = meta.doi;
      }
    }

    const db = getDb();
    const row = {
      id: uuid(),
      runId: input.runId,
      claimId: input.claimId ?? null,
      excerpt: input.excerpt,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      authors: JSON.stringify(authors),
      publishedYear,
      doi,
      locator: input.locator ?? null,
      kind: input.kind ?? "web",
      venue: input.venue ?? null,
      retrievedAt: now(),
      agentId: input.agentId ?? null,
      query: input.query ?? null,
    };
    await db.insert(researchEvidence).values(row);
    const mapped = mapEvidence(row);
    const run = await this.getRun(input.runId);
    if (run) {
      getWorkspaceUIBus().emit(run.workspaceId, {
        event: "ui.research.updated",
        data: { workspaceId: run.workspaceId, groupId: run.groupId, runId: run.id },
      });
    }
    return mapped;
  },

  async recordClaim(input: {
    runId: UUID;
    statement: string;
    agentId?: UUID | null;
    evidenceIds?: UUID[];
  }): Promise<ResearchClaimRecord> {
    const run = await this.getRun(input.runId);
    if (!run) throw new Error("research run not found");
    const db = getDb();
    const evidenceIds = input.evidenceIds ?? [];
    const status = claimStatusForEvidenceCount(evidenceIds.length);
    const row = {
      id: uuid(),
      runId: input.runId,
      planVersion: run.planVersion,
      statement: input.statement,
      status,
      agentId: input.agentId ?? null,
      createdAt: now(),
    };
    await db.insert(researchClaims).values(row);
    if (evidenceIds.length > 0) {
      for (const evidenceId of evidenceIds) {
        await db
          .update(researchEvidence)
          .set({ claimId: row.id })
          .where(and(eq(researchEvidence.id, evidenceId), eq(researchEvidence.runId, input.runId)));
      }
    }
    const evidence = await this.listEvidence({ runId: input.runId, claimId: row.id });
    return mapClaim(row, evidence);
  },

  async listEvidence(input: { runId: UUID; claimId?: UUID | null; agentId?: UUID }): Promise<ResearchEvidenceRecord[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchEvidence)
      .where(eq(researchEvidence.runId, input.runId))
      .orderBy(desc(researchEvidence.retrievedAt));
    return rows
      .filter((row) => {
        if (input.claimId !== undefined) return row.claimId === input.claimId;
        if (input.agentId) return row.agentId === input.agentId;
        return true;
      })
      .map(mapEvidence);
  },

  async listEvidenceByAgent(agentId: UUID): Promise<ResearchEvidenceRecord[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchEvidence)
      .where(eq(researchEvidence.agentId, agentId))
      .orderBy(desc(researchEvidence.retrievedAt));
    return rows.map(mapEvidence);
  },

  async listClaims(runId: UUID): Promise<ResearchClaimRecord[]> {
    const db = getDb();
    const claimRows = await db
      .select()
      .from(researchClaims)
      .where(eq(researchClaims.runId, runId))
      .orderBy(desc(researchClaims.createdAt));
    const evidenceRows = await db
      .select()
      .from(researchEvidence)
      .where(eq(researchEvidence.runId, runId));
    const byClaim = new Map<string, ResearchEvidenceRecord[]>();
    for (const row of evidenceRows) {
      if (!row.claimId) continue;
      const list = byClaim.get(row.claimId) ?? [];
      list.push(mapEvidence(row));
      byClaim.set(row.claimId, list);
    }
    return claimRows.map((row) => mapClaim(row, byClaim.get(row.id) ?? []));
  },

  async getClaim(claimId: UUID): Promise<ResearchClaimRecord | null> {
    const db = getDb();
    const rows = await db.select().from(researchClaims).where(eq(researchClaims.id, claimId)).limit(1);
    if (!rows[0]) return null;
    const evidence = await db
      .select()
      .from(researchEvidence)
      .where(eq(researchEvidence.claimId, claimId));
    return mapClaim(rows[0], evidence.map(mapEvidence));
  },

  async ensureLead(input: { runId: UUID; agentId: UUID }): Promise<void> {
    const run = await this.getRun(input.runId);
    if (!run) throw new Error("research run not found");
    const db = getDb();
    if (!run.leadAgentId) {
      await db
        .update(researchRuns)
        .set({ leadAgentId: input.agentId, updatedAt: now() })
        .where(eq(researchRuns.id, input.runId));
    }
    await this.addParticipant({
      runId: input.runId,
      agentId: input.agentId,
      role: "lead",
    });
  },

  async addParticipant(input: {
    runId: UUID;
    agentId: UUID;
    role: ParticipantRole;
    taskSpec?: string | null;
  }): Promise<void> {
    const db = getDb();
    const existing = await db
      .select()
      .from(researchParticipants)
      .where(
        and(eq(researchParticipants.runId, input.runId), eq(researchParticipants.agentId, input.agentId))
      )
      .limit(1);
    if (existing[0]) {
      await db
        .update(researchParticipants)
        .set({ role: input.role, taskSpec: input.taskSpec ?? existing[0].taskSpec })
        .where(
          and(eq(researchParticipants.runId, input.runId), eq(researchParticipants.agentId, input.agentId))
        );
      return;
    }
    await db.insert(researchParticipants).values({
      runId: input.runId,
      agentId: input.agentId,
      role: input.role,
      taskSpec: input.taskSpec ?? null,
      createdAt: now(),
    });
  },

  async getParticipant(input: { runId: UUID; agentId: UUID }): Promise<ResearchParticipantRecord | null> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchParticipants)
      .where(and(eq(researchParticipants.runId, input.runId), eq(researchParticipants.agentId, input.agentId)))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      runId: row.runId,
      agentId: row.agentId,
      role: row.role as ParticipantRole,
      taskSpec: row.taskSpec,
    };
  },

  async listParticipants(runId: UUID): Promise<ResearchParticipantRecord[]> {
    const db = getDb();
    const rows = await db.select().from(researchParticipants).where(eq(researchParticipants.runId, runId));
    return rows.map((row) => ({
      runId: row.runId,
      agentId: row.agentId,
      role: row.role as ParticipantRole,
      taskSpec: row.taskSpec,
    }));
  },

  async workerCount(runId: UUID): Promise<number> {
    const people = await this.listParticipants(runId);
    return people.filter((p) => p.role === "worker").length;
  },

  async latestVerdicts(runId: UUID): Promise<Map<string, ResearchReviewRecord>> {
    const db = getDb();
    const rows = await db
      .select()
      .from(researchReviews)
      .where(eq(researchReviews.runId, runId))
      .orderBy(desc(researchReviews.createdAt));
    const map = new Map<string, ResearchReviewRecord>();
    for (const row of rows) {
      if (map.has(row.claimId)) continue;
      map.set(row.claimId, {
        id: row.id,
        runId: row.runId,
        claimId: row.claimId,
        reviewerId: row.reviewerId,
        verdict: row.verdict as ReviewVerdict,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      });
    }
    return map;
  },

  async setPhase(runId: UUID, phase: ResearchPhase): Promise<ResearchRunRecord | null> {
    const db = getDb();
    await db.update(researchRuns).set({ phase, updatedAt: now() }).where(eq(researchRuns.id, runId));
    return this.getRun(runId);
  },

  async advancePhase(runId: UUID): Promise<{ run: ResearchRunRecord; from: ResearchPhase; to: ResearchPhase }> {
    const run = await this.getRun(runId);
    if (!run) throw new Error("research run not found");
    const to = nextResearchPhase(run.phase);
    if (!to) throw new Error("research run is already in commit");
    const updated = await this.setPhase(runId, to);
    if (!updated) throw new Error("research run not found");
    return { run: updated, from: run.phase, to };
  },

  async reviewClaim(input: {
    runId: UUID;
    claimId: UUID;
    reviewerId: UUID;
    verdict: ReviewVerdict;
    note: string;
  }): Promise<ResearchReviewRecord> {
    const db = getDb();
    const row = {
      id: uuid(),
      runId: input.runId,
      claimId: input.claimId,
      reviewerId: input.reviewerId,
      verdict: input.verdict,
      note: input.note,
      createdAt: now(),
    };
    await db.insert(researchReviews).values(row);
    return {
      id: row.id,
      runId: row.runId,
      claimId: row.claimId,
      reviewerId: row.reviewerId,
      verdict: input.verdict,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    };
  },

  async alignClaimEvidence(input: {
    runId: UUID;
    claimId: UUID;
    evidenceIds: UUID[];
  }): Promise<ResearchClaimRecord | null> {
    const db = getDb();
    for (const evidenceId of input.evidenceIds) {
      await db
        .update(researchEvidence)
        .set({ claimId: input.claimId })
        .where(and(eq(researchEvidence.id, evidenceId), eq(researchEvidence.runId, input.runId)));
    }
    const evidence = await this.listEvidence({ runId: input.runId, claimId: input.claimId });
    const status = claimStatusForEvidenceCount(evidence.length);
    await db.update(researchClaims).set({ status }).where(eq(researchClaims.id, input.claimId));
    return this.getClaim(input.claimId);
  },

  async getBriefing(input: { groupId: UUID }) {
    const run = await this.getActiveRunForGroup(input);
    if (!run) return null;
    const [claims, evidence, revisions, participants, verdicts] = await Promise.all([
      this.listClaims(run.id),
      this.listEvidence({ runId: run.id }),
      this.listPlanRevisions(run.id),
      this.listParticipants(run.id),
      this.latestVerdicts(run.id),
    ]);
    const currentPlan = revisions.find((r) => r.version === run.planVersion) ?? revisions[0] ?? null;
    const parts = partitionClaims(claims, run.planVersion);
    const unattachedEvidence = unusedEvidenceDisagreements(evidence);
    const challenged = parts.current.filter((claim) => verdicts.get(claim.id)?.verdict === "CHALLENGE");
    const drafts = parts.current.filter((claim) => verdicts.get(claim.id)?.verdict !== "CHALLENGE");
    const finalConclusions = parts.current.filter((claim) =>
      isFinalConclusion({
        planVersion: claim.planVersion,
        currentPlanVersion: run.planVersion,
        status: claim.status,
        latestVerdict: verdicts.get(claim.id)?.verdict ?? null,
        phase: run.phase,
      })
    );
    return {
      run,
      plan: currentPlan,
      revisions,
      participants,
      currentConclusions: run.phase === "commit" ? finalConclusions : drafts,
      finalConclusions,
      unverified: parts.unverified,
      challenged,
      previousPlanClaims: parts.archived,
      evidence,
      unattachedEvidence,
      disagreements: unattachedEvidence,
      reviews: [...verdicts.values()],
      papers: evidence.filter((item) => item.kind === "paper"),
    };
  },
};

export function formatResearchContext(input: {
  run: ResearchRunRecord;
  plan: ResearchPlanRevisionRecord | null;
  role?: ParticipantRole | null;
  unusedCount?: number;
}): string {
  const constraints = input.plan?.constraints?.trim() || "(none yet)";
  const budget = effortBudget(input.run.question);
  const unused = input.unusedCount ?? 0;
  return [
    `[research-run ${input.run.id}]`,
    `Question: ${input.run.question || "(not set)"}`,
    `Phase: ${input.run.phase} (isolate → review → cite → commit)`,
    `Your research role: ${input.role ?? "unassigned"}`,
    `Plan version: ${input.run.planVersion}`,
    `Current constraints: ${constraints}`,
    `Effort budget: ${budget.toolCallsHint}. Do not exceed ${budget.maxWorkers} workers.`,
    `Default sources: peer-reviewed papers and academic PDFs. News only if the constraints allow it.`,
    `Protocol:`,
    `- isolate: workers search independently. Do not message other workers. Find papers with search_papers, fetch_source for extra text, then record_claim(evidenceIds). web_search is for news/web only.`,
    `- review: a reviewer who did not search uses review_claim with CHALLENGE | ALTERNATIVE | VERIFIED.`,
    `- cite: align_claim_evidence maps each claim to source excerpts. Unmapped claims stay unverified.`,
    `- commit: only VERIFIED claims with evidence may enter the final report. Then the lead may message the human.`,
    `create() in this mode requires objective, outputFormat, sources, and boundaries.`,
    `Use list_research_board to read the evidence board.`,
    unused > 0
      ? `Moderator: ${unused} retrieved excerpts are unused. They are open disagreements — address or explicitly dismiss them before commit.`
      : `No unused evidence yet.`,
    `Claims from earlier plan versions are not current conclusions until re-verified.`,
    `Do not invent author names or publication years.`,
  ].join("\n");
}
