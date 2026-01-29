import { createDb, usageRecords } from "@moltbot/db";

export async function POST(req: Request) {
  const secret = process.env.WORKER_API_SECRET;
  if (!secret) {
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    tenantId: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    agentSlug?: string;
    channelId?: string;
  };

  if (!body.tenantId || !body.model) {
    return Response.json({ error: "Missing tenantId or model" }, { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);

  await db.insert(usageRecords).values({
    tenantId: body.tenantId,
    model: body.model,
    inputTokens: body.inputTokens ?? 0,
    outputTokens: body.outputTokens ?? 0,
    agentSlug: body.agentSlug ?? null,
    channelId: body.channelId ?? null,
  });

  return Response.json({ ok: true });
}
