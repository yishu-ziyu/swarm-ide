export const runtime = "nodejs";

import { advanceResearchRun } from "../../../../../../src/research/research-actions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const advanced = await advanceResearchRun(runId);
    return Response.json(advanced);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
