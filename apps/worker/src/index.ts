import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { runEmbeddedPiAgent } from "moltbot/agent-runtime";

const DATA_DIR = process.env.CLAWDBOT_STATE_DIR ?? "/data";
const PORT = Number(process.env.PORT ?? 3001);
const API_SECRET = process.env.WORKER_API_SECRET;

interface InvokeRequest {
  tenantId: string;
  prompt: string;
  channel: "slack";
  replyConfig: {
    botToken: string;
    channelId: string;
    threadTs?: string;
  };
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

  const { tenantId, prompt, replyConfig, agentConfig } = body;
  if (!tenantId || !prompt || !replyConfig?.botToken || !replyConfig?.channelId) {
    return c.json({ ok: false, error: "Missing required fields" }, 400);
  }

  // Ensure per-tenant directories exist
  const tenantDir = join(DATA_DIR, "tenants", tenantId);
  const sessionsDir = join(tenantDir, "sessions");
  const workspaceDir = join(tenantDir, "workspace");
  const agentDir = join(tenantDir, "agent");

  await mkdir(sessionsDir, { recursive: true });
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(agentDir, { recursive: true });

  const channelKey = `slack-${replyConfig.channelId}`;
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
      messageChannel: "slack",
      extraSystemPrompt: agentConfig?.systemPrompt,
      currentChannelId: replyConfig.channelId,
      currentThreadTs: replyConfig.threadTs,
    });

    // Extract text from payloads
    const replyText =
      result.payloads
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "(no response)";

    console.log(
      `[worker] Agent done for tenant=${tenantId} (${result.meta.durationMs}ms), replying to Slack`,
    );
    console.log(`[worker] Usage meta:`, JSON.stringify(result.meta.agentMeta?.usage));

    // Post reply to Slack
    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replyConfig.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: replyConfig.channelId,
        text: replyText,
        ...(replyConfig.threadTs ? { thread_ts: replyConfig.threadTs } : {}),
      }),
    });

    const slackResult = (await slackRes.json()) as { ok: boolean; error?: string };
    if (!slackResult.ok) {
      console.error(`[worker] Slack reply failed:`, slackResult.error);
      return c.json({ ok: false, error: `Slack: ${slackResult.error}` }, 502);
    }

    console.log(`[worker] Reply sent to Slack for tenant=${tenantId}`);

    // Report usage back to the web app
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
          model: agentConfig?.model ?? "claude-sonnet-4-20250514",
          inputTokens: result.meta.agentMeta?.usage?.input ?? 0,
          outputTokens: result.meta.agentMeta?.usage?.output ?? 0,
          channelId: "slack",
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

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[worker] Listening on port ${info.port}`);
});
