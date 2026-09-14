export const runtime = "nodejs";

import { store } from "@/lib/storage";
import { getAgentRuntime } from "@/runtime/agent-runtime";
import { getWorkspaceUIBus } from "@/runtime/ui-bus";
import { onHumanResearchMessage } from "../../../../../src/research/research-actions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const url = new URL(req.url);
  const markRead = url.searchParams.get("markRead") === "true";
  const readerId = url.searchParams.get("readerId") ?? undefined;

  // 游标分页参数透传：limit 截取条数，beforeTime 游标（早于该时间的消息）
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam !== null ? Number.parseInt(limitParam, 10) : undefined;
  const beforeTimeParam = url.searchParams.get("beforeTime");
  const beforeTime = beforeTimeParam !== null ? new Date(beforeTimeParam) : undefined;

  const messages = await store.listMessages({
    groupId,
    ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
    ...(beforeTime !== undefined && !Number.isNaN(beforeTime.getTime()) ? { beforeTime } : {}),
  });

  if (markRead && readerId) {
    await store.markGroupRead({ groupId, readerId });
  }

  return Response.json({ messages });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params;
  const body = (await req.json()) as {
    senderId: string;
    content: string;
    contentType?: string;
  };

  const result = await store.sendMessage({
    groupId,
    senderId: body.senderId,
    content: body.content,
    contentType: body.contentType ?? "text",
  });

  const memberIds = await store.listGroupMemberIds({ groupId });
  const workspaceId = await store.getGroupWorkspaceId({ groupId });
  getWorkspaceUIBus().emit(workspaceId, {
    event: "ui.message.created",
    data: {
      workspaceId,
      groupId,
      memberIds,
      message: { id: result.id, senderId: body.senderId, sendTime: result.sendTime },
    },
  });

  const runtime = getAgentRuntime();
  const senderRole = await store.getAgentRole({ agentId: body.senderId }).catch(() => null);
  if (senderRole === "human") {
    const outcome = await onHumanResearchMessage({
      workspaceId,
      groupId,
      senderId: body.senderId,
      content: body.content,
      memberIds,
    });
    if (outcome.steered) {
      await runtime.interruptAll({ workspaceId });
    }
  }

  void runtime.wakeAgentsForGroup(groupId, body.senderId);

  return Response.json(result, { status: 201 });
}
