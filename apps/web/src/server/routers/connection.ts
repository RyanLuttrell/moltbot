import { z } from "zod";
import { router, tenantProcedure } from "../trpc";
import { connections } from "@moltbot/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto";

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

  // Connect a channel using a token/credential (Discord, Telegram, etc.)
  connectWithToken: tenantProcedure
    .input(
      z.object({
        channelId: z.string().min(1),
        label: z.string().optional(),
        token: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const credentialsEnc = encryptJson({ token: input.token });

      // Upsert: replace existing connection for this channel
      const [existing] = await ctx.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.tenantId, ctx.tenant.id),
            eq(connections.channelId, input.channelId),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await ctx.db
          .update(connections)
          .set({
            credentialsEnc,
            label: input.label ?? existing.label,
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(connections.id, existing.id))
          .returning();
        return updated;
      }

      const [connection] = await ctx.db
        .insert(connections)
        .values({
          tenantId: ctx.tenant.id,
          channelId: input.channelId,
          label: input.label,
          credentialsEnc,
          status: "active",
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
