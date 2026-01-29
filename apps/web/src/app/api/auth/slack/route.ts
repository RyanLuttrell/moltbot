import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * GET /api/auth/slack
 *
 * Initiates the Slack OAuth flow. Redirects the user to Slack's authorization page.
 * After authorization, Slack redirects back to /api/auth/slack/callback.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return new Response("SLACK_CLIENT_ID not configured", { status: 500 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/slack/callback`;

  // Scopes for a Slack bot that can read/write messages + manage channels
  const scopes = [
    "chat:write",
    "channels:history",
    "channels:read",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "im:write",
    "mpim:history",
    "mpim:read",
    "users:read",
    "files:read",
    "files:write",
    "reactions:read",
    "reactions:write",
  ].join(",");

  // Pass the Clerk user ID as state for verification in the callback
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");

  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  redirect(url.toString());
}
