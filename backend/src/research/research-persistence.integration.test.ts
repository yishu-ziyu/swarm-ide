import assert from "node:assert/strict";
import { test } from "node:test";
import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  "postgres://postgres:postgres@127.0.0.1:5433/agent_wechat";

async function canConnect(): Promise<boolean> {
  try {
    const sql = postgres(databaseUrl, { max: 1, connect_timeout: 3 });
    await sql`select 1`;
    await sql.end({ timeout: 1 });
    return true;
  } catch {
    return false;
  }
}

test("processing cursor, idempotent send, evidence persist, and steer", async (t) => {
  if (!(await canConnect())) {
    t.skip("postgres is not reachable");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const workspaceId = crypto.randomUUID();
  const agentId = crypto.randomUUID();
  const humanId = crypto.randomUUID();
  const groupId = crypto.randomUUID();
  const msg1 = crypto.randomUUID();
  const msg2 = crypto.randomUUID();
  const now = new Date();

  try {
    await sql`
      alter table group_members
        add column if not exists last_processed_message_id uuid null
    `;
    await sql`
      create table if not exists agent_processing_runs (
        id uuid primary key,
        agent_id uuid not null,
        group_id uuid not null,
        workspace_id uuid not null,
        last_message_id uuid not null,
        message_ids text not null,
        status text not null,
        did_send integer not null default 0,
        error text null,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `;
    await sql`
      create unique index if not exists agent_processing_runs_batch_uidx
        on agent_processing_runs (agent_id, group_id, last_message_id)
    `;
    await sql`
      create table if not exists agent_deliveries (
        id uuid primary key,
        run_id uuid not null,
        agent_id uuid not null,
        group_id uuid not null,
        idempotency_key text not null,
        outbound_message_id uuid not null,
        tool_name text not null,
        created_at timestamptz not null
      )
    `;
    await sql`
      create unique index if not exists agent_deliveries_idempotency_uidx
        on agent_deliveries (idempotency_key)
    `;
    await sql`
      create table if not exists research_runs (
        id uuid primary key,
        workspace_id uuid not null,
        group_id uuid not null,
        question text not null default '',
        status text not null,
        plan_version integer not null default 1,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `;
    await sql`
      create table if not exists research_plan_revisions (
        id uuid primary key,
        run_id uuid not null,
        version integer not null,
        constraints text not null,
        created_by uuid null,
        created_at timestamptz not null
      )
    `;
    await sql`
      create table if not exists research_claims (
        id uuid primary key,
        run_id uuid not null,
        plan_version integer not null,
        statement text not null,
        status text not null,
        agent_id uuid null,
        created_at timestamptz not null
      )
    `;
    await sql`
      create table if not exists research_evidence (
        id uuid primary key,
        run_id uuid not null,
        claim_id uuid null,
        excerpt text not null default '',
        source_url text not null,
        source_title text not null default '',
        authors text not null default '[]',
        published_year integer null,
        doi text null,
        locator text null,
        retrieved_at timestamptz not null,
        agent_id uuid null,
        query text null
      )
    `;

    await sql`insert into workspaces (id, name, created_at) values (${workspaceId}, ${"itest"}, ${now})`;
    await sql`insert into agents (id, workspace_id, role, parent_id, llm_history, created_at) values
      (${humanId}, ${workspaceId}, ${"human"}, ${null}, ${"[]"}, ${now}),
      (${agentId}, ${workspaceId}, ${"researcher"}, ${null}, ${"[]"}, ${now})`;
    await sql`insert into groups (id, workspace_id, name, created_at) values (${groupId}, ${workspaceId}, ${"research"}, ${now})`;
    await sql`insert into group_members (group_id, user_id, last_read_message_id, last_processed_message_id, joined_at) values
      (${groupId}, ${agentId}, ${null}, ${null}, ${now}),
      (${groupId}, ${humanId}, ${null}, ${null}, ${now})`;
    await sql`insert into messages (id, workspace_id, group_id, sender_id, content_type, content, send_time) values
      (${msg1}, ${workspaceId}, ${groupId}, ${humanId}, ${"text"}, ${"research transformers"}, ${now})`;

    const unreadBefore = await sql`
      select m.id from messages m
      join group_members gm on gm.group_id = m.group_id and gm.user_id = ${agentId}
      where m.group_id = ${groupId}
        and m.sender_id <> ${agentId}
        and (gm.last_processed_message_id is null or m.send_time > (
          select send_time from messages where id = gm.last_processed_message_id
        ))
    `;
    assert.equal(unreadBefore.length, 1);

    const runId = crypto.randomUUID();
    await sql`insert into agent_processing_runs (
      id, agent_id, group_id, workspace_id, last_message_id, message_ids, status, did_send, created_at, updated_at
    ) values (
      ${runId}, ${agentId}, ${groupId}, ${workspaceId}, ${msg1}, ${JSON.stringify([msg1])}, ${"failed"}, ${0}, ${now}, ${now}
    )`;

    const unreadAfterFail = await sql`
      select m.id from messages m
      join group_members gm on gm.group_id = m.group_id and gm.user_id = ${agentId}
      where m.group_id = ${groupId}
        and m.sender_id <> ${agentId}
        and gm.last_processed_message_id is null
    `;
    assert.equal(unreadAfterFail.length, 1, "failed processing must not consume the message");

    const key = `${runId}:send_group_message:${groupId}`;
    const outbound1 = crypto.randomUUID();
    await sql`insert into messages (id, workspace_id, group_id, sender_id, content_type, content, send_time) values
      (${outbound1}, ${workspaceId}, ${groupId}, ${agentId}, ${"text"}, ${"first send"}, ${new Date()})`;
    await sql`insert into agent_deliveries (
      id, run_id, agent_id, group_id, idempotency_key, outbound_message_id, tool_name, created_at
    ) values (
      ${crypto.randomUUID()}, ${runId}, ${agentId}, ${groupId}, ${key}, ${outbound1}, ${"send_group_message"}, ${new Date()}
    )`;

    const existing = await sql`select outbound_message_id from agent_deliveries where idempotency_key = ${key}`;
    assert.equal(existing.length, 1);
    let duplicateBlocked = false;
    try {
      await sql`insert into agent_deliveries (
        id, run_id, agent_id, group_id, idempotency_key, outbound_message_id, tool_name, created_at
      ) values (
        ${crypto.randomUUID()}, ${runId}, ${agentId}, ${groupId}, ${key}, ${crypto.randomUUID()}, ${"send_group_message"}, ${new Date()}
      )`;
    } catch {
      duplicateBlocked = true;
    }
    assert.equal(duplicateBlocked, true, "retry must not insert a second delivery for the same key");

    const researchId = crypto.randomUUID();
    await sql`insert into research_runs (id, workspace_id, group_id, question, status, plan_version, created_at, updated_at)
      values (${researchId}, ${workspaceId}, ${groupId}, ${"Do transformers work?"}, ${"active"}, ${1}, ${now}, ${now})`;
    const evidenceId = crypto.randomUUID();
    await sql`insert into research_evidence (
      id, run_id, excerpt, source_url, source_title, authors, published_year, retrieved_at, agent_id, query
    ) values (
      ${evidenceId}, ${researchId}, ${"We propose the Transformer..."}, ${"https://arxiv.org/abs/1706.03762"},
      ${"Attention Is All You Need"}, ${"[]"}, ${null}, ${now}, ${agentId}, ${"transformer"}
    )`;
    const claimId = crypto.randomUUID();
    await sql`insert into research_claims (id, run_id, plan_version, statement, status, agent_id, created_at)
      values (${claimId}, ${researchId}, ${1}, ${"Self-attention replaces recurrence."}, ${"supported"}, ${agentId}, ${now})`;
    await sql`update research_evidence set claim_id = ${claimId} where id = ${evidenceId}`;

    const persisted = await sql`select authors, published_year, excerpt from research_evidence where id = ${evidenceId}`;
    assert.equal(persisted[0]?.authors, "[]");
    assert.equal(persisted[0]?.published_year, null);
    assert.ok(String(persisted[0]?.excerpt).includes("Transformer"));

    await sql`update research_runs set plan_version = 2, updated_at = ${new Date()} where id = ${researchId}`;
    await sql`update research_claims set status = ${"needs_reverify"} where id = ${claimId}`;
    const current = await sql`
      select id from research_claims
      where run_id = ${researchId} and plan_version = 2 and status not in ('needs_reverify', 'superseded')
    `;
    assert.equal(current.length, 0, "old claims must not remain in current conclusions after steer");
  } finally {
    await sql`delete from agent_deliveries where agent_id = ${agentId}`;
    await sql`delete from agent_processing_runs where agent_id = ${agentId}`;
    await sql`delete from research_evidence where run_id in (select id from research_runs where workspace_id = ${workspaceId})`;
    await sql`delete from research_claims where run_id in (select id from research_runs where workspace_id = ${workspaceId})`;
    await sql`delete from research_plan_revisions where run_id in (select id from research_runs where workspace_id = ${workspaceId})`;
    await sql`delete from research_runs where workspace_id = ${workspaceId}`;
    await sql`delete from messages where workspace_id = ${workspaceId}`;
    await sql`delete from group_members where group_id = ${groupId}`;
    await sql`delete from groups where id = ${groupId}`;
    await sql`delete from agents where workspace_id = ${workspaceId}`;
    await sql`delete from workspaces where id = ${workspaceId}`;
    await sql.end({ timeout: 2 });
  }
});
