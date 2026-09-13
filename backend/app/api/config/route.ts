export const runtime = "nodejs";

import { getConfig, setConfig, AppConfig } from "@/lib/config";

export async function GET() {
  const config = getConfig();
  return Response.json(config);
}

export async function POST(req: Request) {
  try {
    const updates = (await req.json()) as Partial<AppConfig>;
    const newConfig = setConfig(updates);
    return Response.json(newConfig);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }
}
