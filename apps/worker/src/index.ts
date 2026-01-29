import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runEmbeddedPiAgent } from "moltbot/agent-runtime";

const DATA_DIR = process.env.CLAWDBOT_STATE_DIR ?? "/data";
const PORT = Number(process.env.PORT ?? 3001);
const API_SECRET = process.env.WORKER_API_SECRET;

interface SlackReplyConfig {
  botToken: string;
  channelId: string;
  threadTs?: string;
}

interface TelegramReplyConfig {
  botToken: string;
  chatId: number;
  messageId: number;
}

// Dashboard channel needs no external reply config
type DashboardReplyConfig = Record<string, never>;

interface InvokeRequest {
  tenantId: string;
  prompt: string;
  channel: "slack" | "telegram" | "dashboard";
  replyConfig: SlackReplyConfig | TelegramReplyConfig | DashboardReplyConfig;
  agentConfig?: {
    model?: string;
    systemPrompt?: string;
  };
}

const app = new Hono();

// Health check
app.get("/health", (c) => c.json({ ok: true }));

// Bearer token auth middleware for /api routes
app.use("/api/*", async (c, next) => {
  if (!API_SECRET) {
    return c.json({ error: "WORKER_API_SECRET not configured" }, 500);
  }
  const authHeader = c.req.header("Authorization");
  if (authHeader !== `Bearer ${API_SECRET}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// Main agent invocation endpoint
app.post("/api/agent/invoke", async (c) => {
  const body = await c.req.json<InvokeRequest>();

  const { tenantId, prompt, channel, replyConfig, agentConfig } = body;
  if (!tenantId || !prompt) {
    return c.json({ ok: false, error: "Missing required fields" }, 400);
  }

  // Channel-specific validation
  if (channel === "slack") {
    const cfg = replyConfig as SlackReplyConfig;
    if (!cfg.botToken || !cfg.channelId) {
      return c.json({ ok: false, error: "Missing Slack reply config fields" }, 400);
    }
  } else if (channel === "telegram") {
    const cfg = replyConfig as TelegramReplyConfig;
    if (!cfg.botToken || !cfg.chatId) {
      return c.json({ ok: false, error: "Missing Telegram reply config fields" }, 400);
    }
  } else if (channel === "dashboard") {
    // No external reply config needed
  } else {
    return c.json({ ok: false, error: `Unsupported channel: ${channel}` }, 400);
  }

  // Ensure per-tenant directories exist
  const tenantDir = join(DATA_DIR, "tenants", tenantId);
  const sessionsDir = join(tenantDir, "sessions");
  const workspaceDir = join(tenantDir, "workspace");
  const agentDir = join(tenantDir, "agent");

  await mkdir(sessionsDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(agentDir, { recursive: true });

  // Build channel key based on channel type
  const channelKey =
    channel === "slack"
      ? `slack-${(replyConfig as SlackReplyConfig).channelId}`
      : channel === "telegram"
        ? `telegram-${(replyConfig as TelegramReplyConfig).chatId}`
        : `dashboard-${tenantId}`;

  const sessionId = `saas-${tenantId}-${channelKey}`;
  const sessionFile = join(sessionsDir, `${channelKey}.jsonl`);

  try {
    console.log(`[worker] Running agent for tenant=${tenantId} channel=${channelKey}`);

    const result = await runEmbeddedPiAgent({
      sessionId,
      sessionKey: sessionId,
      sessionFile,
      workspaceDir,
      agentDir,
      prompt,
      timeoutMs: 120_000,
      runId: randomUUID(),
      provider: "anthropic",
      model: agentConfig?.model ?? "claude-sonnet-4-20250514",
      messageChannel: channel,
      extraSystemPrompt: agentConfig?.systemPrompt,
      currentChannelId:
        channel === "slack"
          ? (replyConfig as SlackReplyConfig).channelId
          : channel === "telegram"
            ? String((replyConfig as TelegramReplyConfig).chatId)
            : `dashboard-${tenantId}`,
      currentThreadTs:
        channel === "slack"
          ? (replyConfig as SlackReplyConfig).threadTs
          : undefined,
    });

    // Extract text from payloads
    const replyText =
      result.payloads
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "(no response)";

    console.log(
      `[worker] Agent done for tenant=${tenantId} (${result.meta.durationMs}ms), replying to ${channel}`,
    );
    console.log(`[worker] Usage meta:`, JSON.stringify(result.meta.agentMeta?.usage));

    const usageData = {
      model: agentConfig?.model ?? "claude-sonnet-4-20250514",
      inputTokens: result.meta.agentMeta?.usage?.input ?? 0,
      outputTokens: result.meta.agentMeta?.usage?.output ?? 0,
    };

    // Dashboard channel: return reply directly instead of posting to external API
    if (channel === "dashboard") {
      console.log(`[worker] Returning dashboard reply for tenant=${tenantId}`);
      return c.json({
        ok: true,
        replyText,
        usage: usageData,
      });
    }

    // Reply via the correct channel
    if (channel === "slack") {
      const cfg = replyConfig as SlackReplyConfig;
      const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: cfg.channelId,
          text: replyText,
          ...(cfg.threadTs ? { thread_ts: cfg.threadTs } : {}),
        }),
      });

      const slackResult = (await slackRes.json()) as { ok: boolean; error?: string };
      if (!slackResult.ok) {
        console.error(`[worker] Slack reply failed:`, slackResult.error);
        return c.json({ ok: false, error: `Slack: ${slackResult.error}` }, 502);
      }
      console.log(`[worker] Reply sent to Slack for tenant=${tenantId}`);
    } else if (channel === "telegram") {
      const cfg = replyConfig as TelegramReplyConfig;
      const tgRes = await fetch(
        `https://api.telegram.org/bot${cfg.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.chatId,
            text: replyText,
            reply_parameters: { message_id: cfg.messageId },
          }),
        },
      );

      const tgResult = (await tgRes.json()) as { ok: boolean; description?: string };
      if (!tgResult.ok) {
        console.error(`[worker] Telegram reply failed:`, tgResult.description);
        return c.json({ ok: false, error: `Telegram: ${tgResult.description}` }, 502);
      }
      console.log(`[worker] Reply sent to Telegram for tenant=${tenantId}`);
    }

    // Report usage back to the web app (not needed for dashboard — web app records it directly)
    const webAppUrl = process.env.WEB_APP_URL;
    if (webAppUrl) {
      fetch(`${webAppUrl}/api/usage/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_SECRET}`,
        },
        body: JSON.stringify({
          tenantId,
          model: usageData.model,
          inputTokens: usageData.inputTokens,
          outputTokens: usageData.outputTokens,
          channelId: channel,
        }),
      }).catch((err) => {
        console.error(`[worker] Usage report failed:`, err);
      });
    }

    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Agent error for tenant=${tenantId}:`, message);
    return c.json({ ok: false, error: message }, 500);
  }
});

// Delete a session file (used by dashboard "clear conversation")
app.delete("/api/agent/session", async (c) => {
  const { tenantId, sessionKey } = await c.req.json<{
    tenantId: string;
    sessionKey: string;
  }>();

  if (!tenantId || !sessionKey) {
    return c.json({ ok: false, error: "Missing tenantId or sessionKey" }, 400);
  }

  const sessionFile = join(DATA_DIR, "tenants", tenantId, "sessions", `${sessionKey}.jsonl`);

  try {
    await rm(sessionFile, { force: true });
    console.log(`[worker] Deleted session file: ${sessionFile}`);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Failed to delete session:`, message);
    return c.json({ ok: false, error: message }, 500);
  }
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[worker] Listening on port ${info.port}`);
});
