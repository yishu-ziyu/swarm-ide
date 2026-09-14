export const runtime = "nodejs";

import { researchStore } from "../../../../../src/research/research-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params;
  const claim = await researchStore.getClaim(claimId);
  if (!claim) return Response.json({ error: "claim not found" }, { status: 404 });
  return Response.json({ claim });
}
