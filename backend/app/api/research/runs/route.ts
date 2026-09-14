export const runtime = "nodejs";

import { researchStore } from "../../../../src/research/research-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const groupId = (url.searchParams.get("groupId") ?? "").trim();
  const runId = (url.searchParams.get("runId") ?? "").trim();

  if (runId) {
    const briefing = await researchStore.getRun(runId);
    if (!briefing) return Response.json({ error: "run not found" }, { status: 404 });
    const full = await researchStore.getBriefing({ groupId: briefing.groupId });
    return Response.json(full);
  }

  if (!groupId) {
    return Response.json({ error: "Missing groupId" }, { status: 400 });
  }

  const briefing = await researchStore.getBriefing({ groupId });
  return Response.json(briefing);
}
