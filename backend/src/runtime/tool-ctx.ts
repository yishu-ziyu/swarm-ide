export type ToolResult = { ok: boolean; [key: string]: unknown };

export type ToolCtx = {
  agentId: string;
  workspaceId: string;
  groupId: string;
  processingRunId?: string;
  argumentsText: string;
  emitDone: (ok: boolean) => void;
  signal?: AbortSignal;
  ensureRunner: (id: string) => void;
  wakeAgent: (id: string) => void;
  researchSendGate: (input: {
    groupId: string;
    targetId?: string;
    memberIds?: string[];
  }) => Promise<{ ok: false; error: string } | null>;
  deliverSend: <T extends { id: string }>(input: {
    processingRunId?: string;
    groupId: string;
    toolName: string;
    target: string;
    send: () => Promise<T>;
  }) => Promise<{ ok: true; reused: boolean } & T>;
};
