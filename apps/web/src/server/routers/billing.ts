import Stripe from "stripe";
import { router, tenantProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { tenants } from "@moltbot/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
  return new Stripe(key);
}

export const billingRouter = router({
  createCheckout: tenantProcedure.mutation(async ({ ctx }) => {
    const stripe = getStripe();
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "STRIPE_PRO_PRICE_ID not set" });
    }

    // Reuse existing Stripe customer or create one
    let customerId = ctx.tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ctx.tenant.email ?? undefined,
        metadata: { tenantId: ctx.tenant.id },
      });
      customerId = customer.id;
      await ctx.db
        .update(tenants)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.tenant.id));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?checkout=success`,
      cancel_url: `${appUrl}/dashboard/billing?checkout=cancel`,
      metadata: { tenantId: ctx.tenant.id },
    });

    return { url: session.url };
  }),

  createPortal: tenantProcedure.mutation(async ({ ctx }) => {
    const stripe = getStripe();
    const customerId = ctx.tenant.stripeCustomerId;
    if (!customerId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No subscription found" });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return { url: session.url };
  }),
});
