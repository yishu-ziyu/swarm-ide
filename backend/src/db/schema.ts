import { integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  role: text("role").notNull(),
  parentId: uuid("parent_id"),
  llmHistory: text("llm_history").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: text("name"),
  contextTokens: integer("context_tokens").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id),
    userId: uuid("user_id").notNull(),
    lastReadMessageId: uuid("last_read_message_id"),
    lastProcessedMessageId: uuid("last_processed_message_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.groupId, t.userId] }),
  })
);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id),
  senderId: uuid("sender_id").notNull(),
  contentType: text("content_type").notNull(),
  content: text("content").notNull(),
  sendTime: timestamp("send_time", { withTimezone: true }).notNull(),
});

export const agentProcessingRuns = pgTable(
  "agent_processing_runs",
  {
    id: uuid("id").primaryKey(),
    agentId: uuid("agent_id").notNull(),
    groupId: uuid("group_id").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    lastMessageId: uuid("last_message_id").notNull(),
    messageIds: text("message_ids").notNull(),
    status: text("status").notNull(),
    didSend: integer("did_send").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    batchUid: uniqueIndex("agent_processing_runs_batch_uidx").on(t.agentId, t.groupId, t.lastMessageId),
  })
);

export const agentDeliveries = pgTable(
  "agent_deliveries",
  {
    id: uuid("id").primaryKey(),
    runId: uuid("run_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    groupId: uuid("group_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    outboundMessageId: uuid("outbound_message_id").notNull(),
    toolName: text("tool_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    idempotencyUid: uniqueIndex("agent_deliveries_idempotency_uidx").on(t.idempotencyKey),
  })
);

export const researchRuns = pgTable("research_runs", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  groupId: uuid("group_id").notNull(),
  question: text("question").notNull(),
  status: text("status").notNull(),
  planVersion: integer("plan_version").notNull(),
  phase: text("phase").notNull(),
  leadAgentId: uuid("lead_agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const researchPlanRevisions = pgTable("research_plan_revisions", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull(),
  version: integer("version").notNull(),
  constraints: text("constraints").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const researchClaims = pgTable("research_claims", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull(),
  planVersion: integer("plan_version").notNull(),
  statement: text("statement").notNull(),
  status: text("status").notNull(),
  agentId: uuid("agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const researchEvidence = pgTable("research_evidence", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull(),
  claimId: uuid("claim_id"),
  excerpt: text("excerpt").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceTitle: text("source_title").notNull(),
  authors: text("authors").notNull(),
  publishedYear: integer("published_year"),
  doi: text("doi"),
  locator: text("locator"),
  kind: text("kind").notNull(),
  venue: text("venue"),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  agentId: uuid("agent_id"),
  query: text("query"),
});

export const researchParticipants = pgTable(
  "research_participants",
  {
    runId: uuid("run_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    role: text("role").notNull(),
    taskSpec: text("task_spec"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.runId, t.agentId] }),
  })
);

export const researchReviews = pgTable("research_reviews", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id").notNull(),
  claimId: uuid("claim_id").notNull(),
  reviewerId: uuid("reviewer_id").notNull(),
  verdict: text("verdict").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

