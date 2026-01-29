import { headers } from "next/headers";
import { Webhook } from "svix";
import { createDb, tenants, tenantConfigs } from "@moltbot/db";
import type { WebhookEvent } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(webhookSecret);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);

  if (event.type === "user.created") {
    const { id, email_addresses, first_name, last_name } = event.data;
    const email = email_addresses?.[0]?.email_address ?? null;
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    const [tenant] = await db
      .insert(tenants)
      .values({ clerkUserId: id, email, name })
      .onConflictDoNothing()
      .returning();

    if (tenant) {
      await db.insert(tenantConfigs).values({
        tenantId: tenant.id,
        config: {},
      });
    }
  }

  if (event.type === "user.deleted") {
    const { id } = event.data;
    if (id) {
      // Cascade delete handles configs, connections, agents, etc.
      const { eq } = await import("drizzle-orm");
      await db.delete(tenants).where(eq(tenants.clerkUserId, id));
    }
  }

  return new Response("OK", { status: 200 });
}
