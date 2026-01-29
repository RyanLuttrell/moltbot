import { createDb, connections, agents, tenants, usageRecords } from "@moltbot/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { getMonthlyMessageLimit } from "@/lib/plans";
import { verifySlackSignature } from "@/lib/slack";
import { decryptJson } from "@/lib/crypto";

interface SlackEvent {
  type: string;
  // URL verification
  challenge?: string;
  token?: string;
  // Event callback
  team_id?: string;
  event?: {
    type: string;
    text?: string;
    user?: string;
    channel?: string;
    ts?: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
  };
}

interface SlackCredentials {
  access_token: string;
  bot_user_id: string;
  app_id: string;
  team_id: string;
  scope: string;
}

export async function POST(req: Request) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return Response.json({ error: "Not configured" }, { status: 500 });
  }

  const body = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  // Verify request is from Slack
  if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload: SlackEvent = JSON.parse(body);

  // Handle URL verification challenge (Slack sends this when you set the endpoint)
  if (payload.type === "url_verification") {
    return Response.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;

    console.log("[slack-webhook] Event received:", event.type, {
      subtype: event.subtype,
      bot_id: event.bot_id,
      text: event.text?.slice(0, 50),
      channel: event.channel,
    });

    // Handle both message and app_mention events
    const isMessage = event.type === "message" && !event.bot_id && !event.subtype;
    const isMention = event.type === "app_mention" && !event.bot_id;

    if (!isMessage && !isMention) {
      console.log("[slack-webhook] Skipping event:", event.type, event.subtype ?? "");
      return Response.json({ ok: true });
    }

    if (!event.text || !event.channel || !payload.team_id) {
      console.log("[slack-webhook] Missing text/channel/team_id");
      return Response.json({ ok: true });
    }

    // Strip the @mention from the text (Slack formats it as <@BOTID> text)
    const cleanText = event.text.replace(/<@[A-Z0-9]+>\s*/g, "").trim();
    if (!cleanText) {
      return Response.json({ ok: true });
    }

    const teamId = payload.team_id;
    const channel = event.channel;
    const threadTs = event.thread_ts ?? event.ts;

    // Fire and forget — Slack requires a 200 within 3 seconds
    processMessage(teamId, channel, cleanText, threadTs).catch((err) => {
      console.error("[slack-webhook] Error processing message:", err);
    });

    return Response.json({ ok: true });
  }

  return Response.json({ ok: true });
}

async function processMessage(
  teamId: string,
  channel: string,
  text: string,
  threadTs?: string,
) {
  console.log("[slack-webhook] Processing message:", { teamId, channel, text: text.slice(0, 50) });

  const db = createDb(process.env.DATABASE_URL!);

  // Find the connection for this Slack team
  const allConnections = await db
    .select()
    .from(connections)
    .where(eq(connections.channelId, "slack"));

  console.log("[slack-webhook] Found", allConnections.length, "slack connections");

  // Match by team_id stored in metadata
  const connection = allConnections.find((c) => {
    const meta = c.metadata as Record<string, unknown> | null;
    return meta?.teamId === teamId;
  });

  if (!connection || !connection.credentialsEnc) {
    console.error(`[slack-webhook] No connection found for team ${teamId}`);
    return;
  }

  console.log("[slack-webhook] Found connection for tenant:", connection.tenantId);

  // Decrypt credentials
  const creds = decryptJson<SlackCredentials>(connection.credentialsEnc);

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
      console.log(`[slack-webhook] Tenant ${connection.tenantId} exceeded quota (${usage?.messageCount}/${limit})`);
      await slackPostMessage(
        creds.access_token,
        channel,
        `You've reached your monthly message limit (${limit} messages on the ${tenant.plan} plan). Upgrade your plan at your dashboard to continue.`,
        threadTs,
      );
      return;
    }
  }

  // Load agent config for this tenant (use the first agent, or defaults)
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.tenantId, connection.tenantId))
    .limit(1);

  console.log("[slack-webhook] Agent config:", agent?.slug ?? "(default — no agent configured)");

  // Dispatch to the Fly.io worker for full agent runtime
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_API_SECRET;
  if (!workerUrl || !workerSecret) {
    console.error("[slack-webhook] WORKER_URL or WORKER_API_SECRET not configured");
    return;
  }

  console.log("[slack-webhook] Dispatching to worker...");
  const res = await fetch(`${workerUrl}/api/agent/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({
      tenantId: connection.tenantId,
      prompt: text,
      channel: "slack",
      replyConfig: {
        botToken: creds.access_token,
        channelId: channel,
        threadTs,
      },
      agentConfig: {
        model: agent?.model,
        systemPrompt: agent?.systemPrompt,
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[slack-webhook] Worker error:", errBody);
    await slackPostMessage(creds.access_token, channel, "Sorry, something went wrong processing your message. Please try again.", threadTs);
  } else {
    console.log("[slack-webhook] Worker dispatched successfully");
  }
}

async function slackPostMessage(token: string, channel: string, text: string, threadTs?: string) {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel,
      text,
      ...(threadTs ? { thread_ts: threadTs } : {}),
    }),
  });
}
