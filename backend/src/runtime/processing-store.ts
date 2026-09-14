import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { agentDeliveries, agentProcessingRuns, groupMembers } from "@/db/schema";
import { sendIdempotencyKey } from "./delivery";

type UUID = string;

function now() {
  return new Date();
}

function uuid(): UUID {
  return crypto.randomUUID();
}

export type ProcessingRun = {
  id: UUID;
  agentId: UUID;
  groupId: UUID;
  workspaceId: UUID;
  lastMessageId: UUID;
  messageIds: string[];
  status: "pending" | "processing" | "completed" | "failed";
  didSend: boolean;
  error: string | null;
};

function mapRun(row: typeof agentProcessingRuns.$inferSelect): ProcessingRun {
  let messageIds: string[] = [];
  try {
    const parsed = JSON.parse(row.messageIds);
    if (Array.isArray(parsed)) messageIds = parsed.map(String);
  } catch {
    messageIds = [];
  }
  return {
    id: row.id,
    agentId: row.agentId,
    groupId: row.groupId,
    workspaceId: row.workspaceId,
    lastMessageId: row.lastMessageId,
    messageIds,
    status: row.status as ProcessingRun["status"],
    didSend: row.didSend === 1,
    error: row.error ?? null,
  };
}

export const processingStore = {
  async beginRun(input: {
    agentId: UUID;
    groupId: UUID;
    workspaceId: UUID;
    lastMessageId: UUID;
    messageIds: UUID[];
  }): Promise<ProcessingRun> {
    const db = getDb();
    const existing = await db
      .select()
      .from(agentProcessingRuns)
      .where(
        and(
          eq(agentProcessingRuns.agentId, input.agentId),
          eq(agentProcessingRuns.groupId, input.groupId),
          eq(agentProcessingRuns.lastMessageId, input.lastMessageId)
        )
      )
      .limit(1);

    const stamp = now();
    if (existing[0]) {
      const current = existing[0];
      if (current.status !== "completed") {
        await db
          .update(agentProcessingRuns)
          .set({
            status: "processing",
            messageIds: JSON.stringify(input.messageIds),
            error: null,
            updatedAt: stamp,
          })
          .where(eq(agentProcessingRuns.id, current.id));
        return mapRun({
          ...current,
          status: "processing",
          messageIds: JSON.stringify(input.messageIds),
          error: null,
          updatedAt: stamp,
        });
      }
      return mapRun(current);
    }

    const id = uuid();
    const row = {
      id,
      agentId: input.agentId,
      groupId: input.groupId,
      workspaceId: input.workspaceId,
      lastMessageId: input.lastMessageId,
      messageIds: JSON.stringify(input.messageIds),
      status: "processing",
      didSend: 0,
      error: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.insert(agentProcessingRuns).values(row);
    return mapRun(row);
  },

  async markDidSend(runId: UUID): Promise<void> {
    const db = getDb();
    await db
      .update(agentProcessingRuns)
      .set({ didSend: 1, updatedAt: now() })
      .where(eq(agentProcessingRuns.id, runId));
  },

  async completeRun(runId: UUID, didSend: boolean): Promise<void> {
    const db = getDb();
    await db
      .update(agentProcessingRuns)
      .set({
        status: "completed",
        didSend: didSend ? 1 : 0,
        error: null,
        updatedAt: now(),
      })
      .where(eq(agentProcessingRuns.id, runId));
  },

  async failRun(runId: UUID, error: string): Promise<void> {
    const db = getDb();
    await db
      .update(agentProcessingRuns)
      .set({
        status: "failed",
        error,
        updatedAt: now(),
      })
      .where(eq(agentProcessingRuns.id, runId));
  },

  async getDelivery(idempotencyKey: string) {
    const db = getDb();
    const rows = await db
      .select()
      .from(agentDeliveries)
      .where(eq(agentDeliveries.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  },

  async sendIdempotent<T extends { id: string }>(input: {
    runId: UUID;
    agentId: UUID;
    groupId: UUID;
    toolName: string;
    target: string;
    send: () => Promise<T>;
  }): Promise<{ reused: boolean; result: T | { id: string } }> {
    const key = sendIdempotencyKey({
      runId: input.runId,
      toolName: input.toolName,
      target: input.target,
    });
    const existing = await this.getDelivery(key);
    if (existing) {
      return { reused: true, result: { id: existing.outboundMessageId } };
    }

    const result = await input.send();
    const db = getDb();
    try {
      await db.insert(agentDeliveries).values({
        id: uuid(),
        runId: input.runId,
        agentId: input.agentId,
        groupId: input.groupId,
        idempotencyKey: key,
        outboundMessageId: result.id,
        toolName: input.toolName,
        createdAt: now(),
      });
    } catch {
      const raced = await this.getDelivery(key);
      if (raced) return { reused: true, result: { id: raced.outboundMessageId } };
      throw new Error("Failed to record delivery");
    }
    await this.markDidSend(input.runId);
    return { reused: false, result };
  },

  async markProcessedToMessage(input: { groupId: UUID; readerId: UUID; messageId: UUID }) {
    const db = getDb();
    await db
      .update(groupMembers)
      .set({ lastProcessedMessageId: input.messageId })
      .where(
        and(eq(groupMembers.groupId, input.groupId), eq(groupMembers.userId, input.readerId))
      );
  },
};
