export const runtime = "nodejs";

import { getConfig, setConfig, toPublicConfig, type AppConfig } from "@/lib/config";

export async function GET() {
  return Response.json(toPublicConfig(getConfig()));
}

export async function POST(req: Request) {
  try {
    const updates = (await req.json()) as Partial<AppConfig>;
    const newConfig = setConfig(updates);
    return Response.json(toPublicConfig(newConfig));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
