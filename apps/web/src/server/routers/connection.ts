import { z } from "zod";
import { router, tenantProcedure } from "../trpc.js";
import { connections } from "@moltbot/db/schema";
import { eq, and } from "drizzle-orm";

export const connectionRouter = router({
  // List all connections for the current tenant
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: connections.id,
        channelId: connections.channelId,
        label: connections.label,
        status: connections.status,
        errorMessage: connections.errorMessage,
        createdAt: connections.createdAt,
        updatedAt: connections.updatedAt,
      })
      .from(connections)
      .where(eq(connections.tenantId, ctx.tenant.id))
      .orderBy(connections.createdAt);
  }),

  // Add a new channel connection
  create: tenantProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        label: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [connection] = await ctx.db
        .insert(connections)
        .values({
          tenantId: ctx.tenant.id,
          channelId: input.channelId,
          label: input.label,
          metadata: input.metadata ?? {},
        })
        .returning();
      return connection;
    }),

  // Remove a channel connection
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(connections)
        .where(
          and(
            eq(connections.id, input.id),
            eq(connections.tenantId, ctx.tenant.id),
          ),
        );
      return { success: true };
    }),
});
