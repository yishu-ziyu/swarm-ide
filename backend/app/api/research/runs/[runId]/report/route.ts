export const runtime = "nodejs";

import { markdownForRun } from "../../../../../../src/research/research-actions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  try {
    const markdown = await markdownForRun(runId);
    const filename = `research-${runId.slice(0, 8)}.md`;
    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 404 }
    );
  }
}
