import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createDb, tenants, tenantConfigs, connections } from "@moltbot/db";
import { eq, and } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto";

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: { id: string; name: string };
  authed_user: { id: string };
}

/**
 * GET /api/auth/slack/callback
 *
 * Handles the Slack OAuth callback. Exchanges the authorization code for
 * an access token and stores encrypted credentials in the connections table.
 */
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    redirect(`/dashboard/channels?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    redirect("/dashboard/channels?error=missing_code");
  }

  // Verify state matches current user
  if (state) {
    try {
      const parsed = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8"),
      );
      if (parsed.userId !== userId) {
        redirect("/dashboard/channels?error=state_mismatch");
      }
    } catch {
      redirect("/dashboard/channels?error=invalid_state");
    }
  }

  // Exchange code for token
  const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`,
    }),
  });

  const data: SlackOAuthResponse = await tokenRes.json();

  if (!data.ok) {
    redirect(
      `/dashboard/channels?error=${encodeURIComponent(data.error ?? "oauth_failed")}`,
    );
  }

  const db = createDb(process.env.DATABASE_URL!);

  // Find or auto-provision the tenant for this Clerk user
  let [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkUserId, userId))
    .limit(1);

  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({ clerkUserId: userId })
      .returning();

    await db.insert(tenantConfigs).values({
      tenantId: tenant.id,
      config: {},
    });
  }

  // Encrypt and store credentials
  const credentials = encryptJson({
    access_token: data.access_token,
    bot_user_id: data.bot_user_id,
    app_id: data.app_id,
    team_id: data.team.id,
    scope: data.scope,
  });

  // Upsert: update if this tenant already has a Slack connection, otherwise insert
  const [existing] = await db
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.tenantId, tenant.id),
        eq(connections.channelId, "slack"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(connections)
      .set({
        credentialsEnc: credentials,
        label: data.team.name,
        status: "active",
        errorMessage: null,
        metadata: { teamId: data.team.id, botUserId: data.bot_user_id },
        updatedAt: new Date(),
      })
      .where(eq(connections.id, existing.id));
  } else {
    await db.insert(connections).values({
      tenantId: tenant.id,
      channelId: "slack",
      label: data.team.name,
      credentialsEnc: credentials,
      status: "active",
      metadata: { teamId: data.team.id, botUserId: data.bot_user_id },
    });
  }

  redirect("/dashboard/channels?connected=slack");
}
