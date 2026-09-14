export const runtime = "nodejs";

import { researchStore } from "../../../../../../src/research/research-store";
import { getAgentRuntime } from "@/runtime/agent-runtime";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { constraints?: string; createdBy?: string }
    | null;
  const constraints = (body?.constraints ?? "").trim();
  if (!constraints) {
    return Response.json({ error: "Missing constraints" }, { status: 400 });
  }

  const steered = await researchStore.steer({
    runId,
    constraints,
    createdBy: body?.createdBy ?? null,
  });
  const runtime = getAgentRuntime();
  await runtime.interruptAll({ workspaceId: steered.run.workspaceId });
  return Response.json(steered);
}
