/**
 * Demo-path hard bar. Talks to a live server + Postgres.
 *
 * 1. Ask a research question
 * 2. Steer mid-run
 * 3. Failed processing does not drop the task; retry does not duplicate a send
 * 4. Isolated workers cannot message each other
 * 5. Final conclusions have source excerpts; unused evidence is a disagreement
 */
import assert from "node:assert/strict";
import postgres from "postgres";
import {
  isFinalConclusion,
  peerMessageAllowed,
} from "../src/research/protocol.ts";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3017";
const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgres://postgres:postgres@127.0.0.1:5433/agent_wechat";

const QUESTION =
  "Compare the research methods used in transformer vs RNN sequence models. Prefer peer-reviewed papers.";
const STEER =
  "Stop collecting news. Only use peer-reviewed papers, and focus on comparing research methods.";

type Json = Record<string, unknown>;

async function api(path: string, init?: RequestInit): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let body: Json = {};
  try {
    body = text ? (JSON.parse(text) as Json) : {};
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function main() {
  const sql = postgres(databaseUrl, { max: 1 });
  const failures: string[] = [];
  const ok = (name: string) => console.log(`PASS  ${name}`);
  const fail = (name: string, detail: string) => {
    failures.push(`${name}: ${detail}`);
    console.log(`FAIL  ${name}: ${detail}`);
  };

  try {
    const health = await api("/api/health");
    if (health.status !== 200) throw new Error(`server not up: ${health.status}`);

    const init = await api("/api/admin/init-db", { method: "POST" });
    if (init.status !== 200 || init.body.ok !== true) {
      throw new Error(`init-db failed: ${JSON.stringify(init.body)}`);
    }
    ok("schema ready");

    const created = await api("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name: `e2e-demo-${Date.now()}` }),
    });
    if (created.status !== 201) throw new Error(`workspace: ${JSON.stringify(created.body)}`);
    const workspaceId = asString(created.body.workspaceId);
    const humanAgentId = asString(created.body.humanAgentId);
    const assistantAgentId = asString(created.body.assistantAgentId);
    const groupId = asString(created.body.defaultGroupId);
    assert.ok(workspaceId && humanAgentId && groupId);

    const asked = await api(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        senderId: humanAgentId,
        content: QUESTION,
        contentType: "text",
      }),
    });
    if (asked.status !== 201) throw new Error(`ask: ${JSON.stringify(asked.body)}`);

    const afterAsk = await api(`/api/research/runs?groupId=${groupId}`);
    const run = (afterAsk.body.run ?? afterAsk.body) as Json;
    const runId = asString((run as Json).id);
    if (afterAsk.status !== 200 || asString((run as Json).question) !== QUESTION) {
      fail("1 ask question", `briefing=${JSON.stringify(afterAsk.body).slice(0, 400)}`);
    } else if (asString((run as Json).phase) !== "isolate") {
      fail("1 ask question", `phase=${String((run as Json).phase)}`);
    } else {
      ok("1 ask question → isolate run + question stored");
    }

    const leadRows = await sql<{ lead_agent_id: string | null }[]>`
      select lead_agent_id from research_runs where id = ${runId}::uuid
    `;
    if (leadRows[0]?.lead_agent_id === assistantAgentId) ok("1 lead assigned");
    else fail("1 lead assigned", `lead=${leadRows[0]?.lead_agent_id}`);

    const steered = await api(`/api/groups/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        senderId: humanAgentId,
        content: STEER,
        contentType: "text",
      }),
    });
    if (steered.status !== 201) throw new Error(`steer: ${JSON.stringify(steered.body)}`);

    const afterSteer = await api(`/api/research/runs?groupId=${groupId}`);
    const steeredRun = (afterSteer.body.run ?? {}) as Json;
    const plan = (afterSteer.body.plan ?? {}) as Json;
    if (Number(steeredRun.planVersion) !== 2) {
      fail("2 steer", `planVersion=${String(steeredRun.planVersion)}`);
    } else if (!asString(plan.constraints).includes("peer-reviewed")) {
      fail("2 steer", `constraints=${asString(plan.constraints)}`);
    } else if (asString(steeredRun.phase) !== "isolate") {
      fail("2 steer", `phase reset expected isolate, got ${String(steeredRun.phase)}`);
    } else {
      ok("2 steer → plan v2, peer-reviewed constraint, phase back to isolate");
    }

    const now = new Date();
    const workerA = crypto.randomUUID();
    const workerB = crypto.randomUUID();
    await sql`insert into agents (id, workspace_id, role, parent_id, llm_history, created_at) values
      (${workerA}, ${workspaceId}::uuid, ${"researcher"}, ${assistantAgentId}::uuid, ${"[]"}, ${now}),
      (${workerB}, ${workspaceId}::uuid, ${"researcher"}, ${assistantAgentId}::uuid, ${"[]"}, ${now})`;
    await sql`insert into research_participants (run_id, agent_id, role, task_spec, created_at) values
      (${runId}::uuid, ${workerA}::uuid, ${"worker"}, ${"Objective: methods in transformers"}, ${now}),
      (${runId}::uuid, ${workerB}::uuid, ${"worker"}, ${"Objective: methods in RNNs"}, ${now})`;

    const peer = peerMessageAllowed({
      phase: "isolate",
      senderRole: "worker",
      targetRole: "worker",
      targetIsHuman: false,
    });
    const toHuman = peerMessageAllowed({
      phase: "isolate",
      senderRole: "worker",
      targetRole: null,
      targetIsHuman: true,
    });
    const toLead = peerMessageAllowed({
      phase: "isolate",
      senderRole: "worker",
      targetRole: "lead",
      targetIsHuman: false,
    });
    if (!peer.allowed && !toHuman.allowed && toLead.allowed) {
      ok("4 isolate: workers cannot message peers or human; can report to lead");
    } else {
      fail("4 isolate", JSON.stringify({ peer, toHuman, toLead }));
    }

    const timeoutMsg = crypto.randomUUID();
    await sql`insert into messages (id, workspace_id, group_id, sender_id, content_type, content, send_time)
      values (${timeoutMsg}::uuid, ${workspaceId}::uuid, ${groupId}::uuid, ${humanAgentId}::uuid, ${"text"}, ${"timeout-probe"}, ${now})`;
    const procId = crypto.randomUUID();
    await sql`insert into agent_processing_runs (
      id, agent_id, group_id, workspace_id, last_message_id, message_ids, status, did_send, error, created_at, updated_at
    ) values (
      ${procId}::uuid, ${assistantAgentId}::uuid, ${groupId}::uuid, ${workspaceId}::uuid,
      ${timeoutMsg}::uuid, ${JSON.stringify([timeoutMsg])}, ${"failed"}, ${0}, ${"simulated timeout"}, ${now}, ${now}
    )`;
    const unread = await sql<{ id: string }[]>`
      select m.id from messages m
      join group_members gm on gm.group_id = m.group_id and gm.user_id = ${assistantAgentId}::uuid
      where m.group_id = ${groupId}::uuid
        and m.sender_id <> ${assistantAgentId}::uuid
        and (
          gm.last_processed_message_id is null
          or m.send_time > (select send_time from messages where id = gm.last_processed_message_id)
        )
    `;
    if (unread.some((row) => row.id === timeoutMsg)) ok("3 fail: unprocessed messages remain after timeout");
    else fail("3 fail: unprocessed messages remain", "last_processed advanced or no unread");

    const key = `${procId}:send_group_message:${groupId}`;
    const outbound = crypto.randomUUID();
    await sql`insert into messages (id, workspace_id, group_id, sender_id, content_type, content, send_time)
      values (${outbound}::uuid, ${workspaceId}::uuid, ${groupId}::uuid, ${assistantAgentId}::uuid, ${"text"}, ${"first delivery"}, ${now})`;
    await sql`insert into agent_deliveries (
      id, run_id, agent_id, group_id, idempotency_key, outbound_message_id, tool_name, created_at
    ) values (
      ${crypto.randomUUID()}::uuid, ${procId}::uuid, ${assistantAgentId}::uuid, ${groupId}::uuid,
      ${key}, ${outbound}::uuid, ${"send_group_message"}, ${now}
    )`;
    let dupBlocked = false;
    try {
      await sql`insert into agent_deliveries (
        id, run_id, agent_id, group_id, idempotency_key, outbound_message_id, tool_name, created_at
      ) values (
        ${crypto.randomUUID()}::uuid, ${procId}::uuid, ${assistantAgentId}::uuid, ${groupId}::uuid,
        ${key}, ${crypto.randomUUID()}::uuid, ${"send_group_message"}, ${now}
      )`;
    } catch {
      dupBlocked = true;
    }
    if (dupBlocked) ok("3 retry does not duplicate a successful delivery");
    else fail("3 retry duplicate", "second insert succeeded");

    const evidenceUsed = crypto.randomUUID();
    const evidenceUnused = crypto.randomUUID();
    const claimId = crypto.randomUUID();
    const excerpt =
      "We propose the Transformer, a model architecture eschewing recurrence and instead relying entirely on an attention mechanism.";
    await sql`insert into research_evidence (
      id, run_id, excerpt, source_url, source_title, authors, published_year, retrieved_at, agent_id, query
    ) values (
      ${evidenceUsed}::uuid, ${runId}::uuid, ${excerpt},
      ${"https://arxiv.org/abs/1706.03762"}, ${"Attention Is All You Need"},
      ${"[]"}, ${null}, ${now}, ${workerA}::uuid, ${"transformer methods"}
    )`;
    await sql`insert into research_evidence (
      id, run_id, excerpt, source_url, source_title, authors, published_year, retrieved_at, agent_id, query
    ) values (
      ${evidenceUnused}::uuid, ${runId}::uuid, ${"A news blog summary of AI hype."},
      ${"https://example.com/news"}, ${"AI Weekly"},
      ${"[]"}, ${null}, ${now}, ${workerB}::uuid, ${"transformer news"}
    )`;
    await sql`insert into research_claims (id, run_id, plan_version, statement, status, agent_id, created_at)
      values (
        ${claimId}::uuid, ${runId}::uuid, ${2},
        ${"Self-attention replaces recurrence in sequence modeling."},
        ${"supported"}, ${workerA}::uuid, ${now}
      )`;
    await sql`update research_evidence set claim_id = ${claimId}::uuid where id = ${evidenceUsed}::uuid`;
    await sql`insert into research_reviews (id, run_id, claim_id, reviewer_id, verdict, note, created_at)
      values (
        ${crypto.randomUUID()}::uuid, ${runId}::uuid, ${claimId}::uuid, ${assistantAgentId}::uuid,
        ${"VERIFIED"}, ${"Excerpt matches the claim."}, ${now}
      )`;
    await sql`update research_runs set phase = ${"commit"} where id = ${runId}::uuid`;

    const oldClaim = crypto.randomUUID();
    await sql`insert into research_claims (id, run_id, plan_version, statement, status, agent_id, created_at)
      values (
        ${oldClaim}::uuid, ${runId}::uuid, ${1},
        ${"News sources say transformers are popular."},
        ${"needs_reverify"}, ${workerB}::uuid, ${now}
      )`;

    const briefing = await api(`/api/research/runs?groupId=${groupId}`);
    const body = briefing.body;
    const finals = (body.finalConclusions ?? body.currentConclusions ?? []) as Array<Json>;
    const unused = (body.unattachedEvidence ?? body.disagreements ?? []) as Array<Json>;
    const previous = (body.previousPlanClaims ?? []) as Array<Json>;
    const first = finals[0] ?? {};
    const evidenceList = ((first as Json).evidence as Array<Json> | undefined) ?? [];
    const excerptHit = evidenceList.some((item) => asString(item.excerpt).includes("attention mechanism"));

    if (briefing.status !== 200) fail("5 briefing", JSON.stringify(body).slice(0, 300));
    else if (!excerptHit) fail("5 clickable excerpt", `evidence=${JSON.stringify(evidenceList).slice(0, 300)}`);
    else ok("5 final conclusion carries the source excerpt");

    if (unused.some((item) => asString(item.sourceTitle).includes("AI Weekly"))) {
      ok("5 unused evidence listed as disagreement");
    } else {
      fail("5 unused evidence", JSON.stringify(unused).slice(0, 300));
    }

    if (previous.some((item) => asString(item.status) === "needs_reverify")) {
      ok("5 old-plan claim stays out of current conclusions");
    } else if (finals.some((item) => asString(item.statement).includes("News sources"))) {
      fail("5 old-plan claim mixed into final", JSON.stringify(finals).slice(0, 300));
    } else {
      ok("5 old-plan news claim is not in final conclusions");
    }

    const claimGet = await api(`/api/research/claims/${claimId}`);
    const claim = ((claimGet.body.claim ?? {}) as Json);
    const claimEvidence = (claim.evidence as Array<Json> | undefined) ?? [];
    if (
      claimGet.status === 200 &&
      claimEvidence.some((item) => asString(item.excerpt).includes("attention mechanism"))
    ) {
      ok("5 GET claim returns excerpt, not just a homepage");
    } else {
      fail("5 GET claim", JSON.stringify(claimGet.body).slice(0, 300));
    }

    const eligible = isFinalConclusion({
      planVersion: 2,
      currentPlanVersion: 2,
      status: "supported",
      latestVerdict: "VERIFIED",
      phase: "commit",
    });
    if (eligible) ok("5 commit eligibility matches protocol");
    else fail("5 commit eligibility", "VERIFIED+supported+commit should pass");

    const livePapers = await api("/api/research/papers", {
      method: "POST",
      body: JSON.stringify({
        query: "Attention Is All You Need Vaswani",
        groupId,
        workspaceId,
        agentId: humanAgentId,
        maxResults: 3,
      }),
    });
    const paperRows = ((livePapers.body.papers ?? []) as Array<Json>);
    const vaswani = paperRows.find((row) =>
      (Array.isArray(row.authors) ? (row.authors as string[]) : []).some((name) => /vaswani/i.test(name))
    );
    if (livePapers.status >= 400 || !vaswani) {
      fail("papers API", JSON.stringify(livePapers.body).slice(0, 400));
    } else {
      ok("papers POST records a real paper with authors");
    }

    const afterPapers = await api(`/api/research/runs?groupId=${groupId}`);
    const listed = ((afterPapers.body.papers ?? []) as Array<Json>);
    if (listed.some((row) => asString(row.sourceTitle).toLowerCase().includes("attention"))) {
      ok("briefing papers list includes the retrieved paper");
    } else {
      fail("briefing papers", JSON.stringify(listed).slice(0, 300));
    }

    console.log(`\nworkspace=${workspaceId} group=${groupId} run=${runId}`);
  } finally {
    await sql.end({ timeout: 2 });
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  console.log("\nHard bar: demo path holds.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
