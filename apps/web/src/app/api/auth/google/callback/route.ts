import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createDb, tenants, tenantConfigs, integrations } from "@moltbot/db";
import { eq, and } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * GET /api/auth/google/callback
 *
 * Handles the Google OAuth callback. Exchanges the authorization code for
 * tokens and stores encrypted credentials in the integrations table.
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
    redirect(`/dashboard/integrations?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    redirect("/dashboard/integrations?error=missing_code");
  }

  // Verify state matches current user
  if (state) {
    try {
      const parsed = JSON.parse(
        Buffer.from(state, "base64url").toString("utf8"),
      );
      if (parsed.userId !== userId) {
        redirect("/dashboard/integrations?error=state_mismatch");
      }
    } catch {
      redirect("/dashboard/integrations?error=invalid_state");
    }
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
    }),
  });

  const tokenData: GoogleTokenResponse = await tokenRes.json();

  if (!tokenRes.ok) {
    redirect("/dashboard/integrations?error=token_exchange_failed");
  }

  // Fetch user info to get email for the integration label
  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
  );

  let userInfo: GoogleUserInfo | null = null;
  if (userInfoRes.ok) {
    userInfo = await userInfoRes.json();
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
  const credentialsEnc = encryptJson({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_type: tokenData.token_type,
  });

  const grantedScopes = tokenData.scope.split(" ").filter(Boolean);
  const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
  const label = userInfo?.email
    ? `Google — ${userInfo.email}`
    : "Google";

  const metadata = {
    email: userInfo?.email,
    name: userInfo?.name,
    picture: userInfo?.picture,
  };

  // Upsert: update if this tenant already has a Google integration
  const [existing] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.tenantId, tenant.id),
        eq(integrations.provider, "google"),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(integrations)
      .set({
        credentialsEnc,
        label,
        status: "active",
        errorMessage: null,
        metadata,
        scopes: grantedScopes,
        tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      tenantId: tenant.id,
      provider: "google",
      label,
      credentialsEnc,
      status: "active",
      metadata,
      scopes: grantedScopes,
      tokenExpiresAt,
    });
  }

  redirect("/dashboard/integrations?connected=google");
}
