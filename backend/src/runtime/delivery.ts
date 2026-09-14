export const SEND_TOOL_NAMES = new Set(["send", "send_group_message", "send_direct_message"]);

export function isSendTool(name?: string | null): boolean {
  return Boolean(name && SEND_TOOL_NAMES.has(name));
}

export function didSendSucceed(
  name: string | undefined | null,
  result: { ok?: unknown } | null | undefined
): boolean {
  return isSendTool(name) && result?.ok === true;
}

export function sendTargetFromArgs(
  name: string,
  args: Record<string, unknown>
): string | null {
  if (name === "send") {
    const to = typeof args.to === "string" ? args.to.trim() : "";
    return to || null;
  }
  if (name === "send_direct_message") {
    const to = typeof args.toAgentId === "string" ? args.toAgentId.trim() : "";
    return to || null;
  }
  if (name === "send_group_message") {
    const groupId = typeof args.groupId === "string" ? args.groupId.trim() : "";
    return groupId || null;
  }
  return null;
}

export function sendIdempotencyKey(input: {
  runId: string;
  toolName: string;
  target: string;
}): string {
  return `${input.runId}:${input.toolName}:${input.target}`;
}

export function fallbackIdempotencyKey(runId: string, groupId: string): string {
  return sendIdempotencyKey({ runId, toolName: "fallback_send", target: groupId });
}
