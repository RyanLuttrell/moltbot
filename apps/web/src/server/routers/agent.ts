import { z } from "zod";
import { router, tenantProcedure } from "../trpc";
import { agents } from "@moltbot/db/schema";
import { eq, and } from "drizzle-orm";

export const agentRouter = router({
  // List all agents for the current tenant
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(agents)
      .where(eq(agents.tenantId, ctx.tenant.id))
      .orderBy(agents.createdAt);
  }),

  // Get a single agent
  get: tenantProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.tenantId, ctx.tenant.id),
            eq(agents.slug, input.slug),
          ),
        )
        .limit(1);
      return agent ?? null;
    }),

  // Create a new agent
  create: tenantProcedure
    .input(
      z.object({
        slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
        name: z.string().min(1).optional(),
        systemPrompt: z.string().optional(),
        model: z.string().optional(),
        modelProvider: z.enum(["anthropic", "openai", "byok"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [agent] = await ctx.db
        .insert(agents)
        .values({ tenantId: ctx.tenant.id, ...input })
        .returning();
      return agent;
    }),

  // Update an agent
  update: tenantProcedure
    .input(
      z.object({
        slug: z.string(),
        name: z.string().min(1).optional(),
        systemPrompt: z.string().optional(),
        model: z.string().optional(),
        modelProvider: z.enum(["anthropic", "openai", "byok"]).optional(),
        toolsPolicy: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { slug, ...updates } = input;
      const [updated] = await ctx.db
        .update(agents)
        .set({ ...updates, updatedAt: new Date() })
        .where(
          and(
            eq(agents.tenantId, ctx.tenant.id),
            eq(agents.slug, slug),
          ),
        )
        .returning();
      return updated;
    }),

  // Delete an agent
  delete: tenantProcedure
    .input(z.object({ slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(agents)
        .where(
          and(
            eq(agents.tenantId, ctx.tenant.id),
            eq(agents.slug, input.slug),
          ),
        );
      return { success: true };
    }),
});
