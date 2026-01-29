import { z } from "zod";
import { router, tenantProcedure, protectedProcedure } from "../trpc";
import { tenants, tenantConfigs } from "@moltbot/db/schema";
import { eq } from "drizzle-orm";

export const tenantRouter = router({
  // Get current tenant profile
  me: tenantProcedure.query(async ({ ctx }) => {
    return ctx.tenant;
  }),

  // Update tenant profile
  update: tenantProcedure
    .input(z.object({ name: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(tenants)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.tenant.id))
        .returning();
      return updated;
    }),

  // Get tenant config
  config: tenantProcedure.query(async ({ ctx }) => {
    const [config] = await ctx.db
      .select()
      .from(tenantConfigs)
      .where(eq(tenantConfigs.tenantId, ctx.tenant.id))
      .limit(1);
    return config ?? null;
  }),

  // Provision a new tenant (called after Clerk signup or via webhook)
  provision: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if tenant already exists
    const [existing] = await ctx.db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, ctx.userId))
      .limit(1);

    if (existing) return existing;

    const [tenant] = await ctx.db
      .insert(tenants)
      .values({ clerkUserId: ctx.userId })
      .returning();

    // Create default empty config
    await ctx.db.insert(tenantConfigs).values({
      tenantId: tenant.id,
      config: {},
    });

    return tenant;
  }),
});
