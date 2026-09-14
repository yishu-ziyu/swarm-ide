import { getSql } from "./client";

export async function ensureSchema() {
  const sql = getSql();
  await sql/* sql */ `
    create table if not exists workspaces (
      id uuid primary key,
      name text not null,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create table if not exists agents (
      id uuid primary key,
      workspace_id uuid not null references workspaces(id),
      role text not null,
      parent_id uuid null,
      llm_history text not null,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create table if not exists groups (
      id uuid primary key,
      workspace_id uuid not null references workspaces(id),
      name text null,
      context_tokens integer default 0,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create table if not exists group_members (
      group_id uuid not null references groups(id),
      user_id uuid not null,
      last_read_message_id uuid null,
      joined_at timestamptz not null,
      primary key (group_id, user_id)
    );
  `;

  await sql/* sql */ `
    create table if not exists messages (
      id uuid primary key,
      workspace_id uuid not null references workspaces(id),
      group_id uuid not null references groups(id),
      sender_id uuid not null,
      content_type text not null,
      content text not null,
      send_time timestamptz not null
    );
  `;

  await sql/* sql */ `
    alter table group_members
      add column if not exists last_processed_message_id uuid null;
  `;

  await sql/* sql */ `
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
    );
  `;

  await sql/* sql */ `
    create unique index if not exists agent_processing_runs_batch_uidx
      on agent_processing_runs (agent_id, group_id, last_message_id);
  `;

  await sql/* sql */ `
    create table if not exists agent_deliveries (
      id uuid primary key,
      run_id uuid not null,
      agent_id uuid not null,
      group_id uuid not null,
      idempotency_key text not null,
      outbound_message_id uuid not null,
      tool_name text not null,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create unique index if not exists agent_deliveries_idempotency_uidx
      on agent_deliveries (idempotency_key);
  `;

  await sql/* sql */ `
    create table if not exists research_runs (
      id uuid primary key,
      workspace_id uuid not null,
      group_id uuid not null,
      question text not null default '',
      status text not null,
      plan_version integer not null default 1,
      created_at timestamptz not null,
      updated_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create table if not exists research_plan_revisions (
      id uuid primary key,
      run_id uuid not null,
      version integer not null,
      constraints text not null,
      created_by uuid null,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
    create table if not exists research_claims (
      id uuid primary key,
      run_id uuid not null,
      plan_version integer not null,
      statement text not null,
      status text not null,
      agent_id uuid null,
      created_at timestamptz not null
    );
  `;

  await sql/* sql */ `
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
    );
  `;

  await sql/* sql */ `
    alter table research_evidence
      add column if not exists kind text not null default 'web';
  `;
  await sql/* sql */ `
    alter table research_evidence
      add column if not exists venue text null;
  `;

  await sql/* sql */ `
    alter table research_runs
      add column if not exists phase text not null default 'isolate';
  `;
  await sql/* sql */ `
    alter table research_runs
      add column if not exists lead_agent_id uuid null;
  `;

  await sql/* sql */ `
    create table if not exists research_participants (
      run_id uuid not null,
      agent_id uuid not null,
      role text not null,
      task_spec text null,
      created_at timestamptz not null,
      primary key (run_id, agent_id)
    );
  `;

  await sql/* sql */ `
    create table if not exists research_reviews (
      id uuid primary key,
      run_id uuid not null,
      claim_id uuid not null,
      reviewer_id uuid not null,
      verdict text not null,
      note text not null,
      created_at timestamptz not null
    );
  `;
}
