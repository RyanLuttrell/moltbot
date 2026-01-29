import { createDb, connections, agents, tenants, usageRecords } from "@moltbot/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { getMonthlyMessageLimit } from "@/lib/plans";
import { decryptJson } from "@/lib/crypto";
import { telegramSendMessage } from "@/lib/telegram";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; is_bot: boolean; first_name: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

export async function POST(req: Request) {
  const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secretToken) {
    return Response.json({ error: "Missing secret token" }, { status: 401 });
  }

  const payload: TelegramUpdate = await req.json();

  // Only handle text messages from non-bot users
  const message = payload.message;
  if (!message?.text || message.from?.is_bot) {
    return Response.json({ ok: true });
  }

  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = message.text.trim();
  if (!text) {
    return Response.json({ ok: true });
  }

  // Fire and forget — Telegram expects a quick 200
  processMessage(secretToken, chatId, messageId, text).catch((err) => {
    console.error("[telegram-webhook] Error processing message:", err);
  });

  return Response.json({ ok: true });
}

async function processMessage(
  webhookSecret: string,
  chatId: number,
  messageId: number,
  text: string,
) {
  console.log("[telegram-webhook] Processing message:", { chatId, text: text.slice(0, 50) });

  const db = createDb(process.env.DATABASE_URL!);

  // Find the Telegram connection by matching webhookSecret in metadata
  const allConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.channelId, "telegram"));

  const connection = allConnections.find((c) => {
    const meta = c.metadata as Record<string, unknown> | null;
    return meta?.webhookSecret === webhookSecret;
  });

  if (!connection?.credentialsEnc) {
    console.error("[telegram-webhook] No connection found for secret token");
    return;
  }

  console.log("[telegram-webhook] Found connection for tenant:", connection.tenantId);

  const creds = decryptJson<{ token: string }>(connection.credentialsEnc);

  // --- Quota check ---
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, connection.tenantId))
    .limit(1);

  if (tenant) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [usage] = await db
      .select({ messageCount: sql<number>`count(*)::int` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, connection.tenantId),
          gte(usageRecords.createdAt, monthStart),
        ),
      );

    const limit = getMonthlyMessageLimit(tenant.plan);
    if ((usage?.messageCount ?? 0) >= limit) {
      console.log(
        `[telegram-webhook] Tenant ${connection.tenantId} exceeded quota (${usage?.messageCount}/${limit})`,
      );
      await telegramSendMessage(
        creds.token,
        chatId,
        `You've reached your monthly message limit (${limit} messages on the ${tenant.plan} plan). Upgrade your plan at your dashboard to continue.`,
        messageId,
      );
      return;
    }
  }

  // Load agent config
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.tenantId, connection.tenantId))
    .limit(1);

  console.log("[telegram-webhook] Agent config:", agent?.slug ?? "(default)");

  // Dispatch to worker
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_API_SECRET;
  if (!workerUrl || !workerSecret) {
    console.error("[telegram-webhook] WORKER_URL or WORKER_API_SECRET not configured");
    return;
  }

  console.log("[telegram-webhook] Dispatching to worker...");
  const res = await fetch(`${workerUrl}/api/agent/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({
      tenantId: connection.tenantId,
      prompt: text,
      channel: "telegram",
      replyConfig: {
        botToken: creds.token,
        chatId,
        messageId,
      },
      agentConfig: {
        model: agent?.model,
        systemPrompt: agent?.systemPrompt,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[telegram-webhook] Worker error:", errBody);
    await telegramSendMessage(
      creds.token,
      chatId,
      "Sorry, something went wrong processing your message. Please try again.",
      messageId,
    );
  } else {
    console.log("[telegram-webhook] Worker dispatched successfully");
  }
}
