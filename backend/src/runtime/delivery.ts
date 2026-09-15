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

/** Visible chat text when the model only ran tools and left content empty. */
export function composeHumanVisibleReply(input: {
  assistantText?: string;
  claims?: Array<{ statement?: string | null }>;
  papers?: Array<{ title?: string | null; sourceTitle?: string | null }>;
}): string {
  const spoken = (input.assistantText ?? "").trim();
  if (spoken && spoken !== "无需发送") return spoken;

  const claims = (input.claims ?? [])
    .map((claim) => (claim.statement ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (claims.length > 0) {
    return ["这一轮查完了，目前结论：", ...claims.map((line) => `- ${line}`)].join("\n");
  }

  const titles = [
    ...new Set(
      (input.papers ?? [])
        .map((paper) => (paper.title ?? paper.sourceTitle ?? "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 3);
  if (titles.length > 0) {
    return `这一轮已检索到论文：${titles.join("；")}。详情在右侧研究栏。`;
  }

  return "这一轮已经处理完，进展写在右侧研究栏。";
}
