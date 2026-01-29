import Stripe from "stripe";
import { createDb, tenants } from "@moltbot/db";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  const db = createDb(process.env.DATABASE_URL!);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId) break;

      await db
        .update(tenants)
        .set({
          plan: "pro",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      console.log(`[stripe-webhook] Tenant ${tenantId} upgraded to pro`);
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const plan = subscription.status === "active" ? "pro" : "free";

      await db
        .update(tenants)
        .set({ plan, updatedAt: new Date() })
        .where(eq(tenants.stripeCustomerId, customerId));

      console.log(`[stripe-webhook] Subscription updated for customer ${customerId}: ${plan}`);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await db
        .update(tenants)
        .set({
          plan: "free",
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(tenants.stripeCustomerId, customerId));

      console.log(`[stripe-webhook] Subscription deleted for customer ${customerId}, downgraded to free`);
      break;
    }
  }

  return new Response("OK", { status: 200 });
}
