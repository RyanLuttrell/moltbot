import { z } from "zod";
import { randomBytes } from "node:crypto";
import { router, tenantProcedure } from "../trpc";
import { connections } from "@moltbot/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptJson, decryptJson } from "@/lib/crypto";
import {
  telegramGetMe,
  telegramSetWebhook,
  telegramDeleteWebhook,
} from "@/lib/telegram";

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
        metadata: connections.metadata,
        createdAt: connections.createdAt,
        updatedAt: connections.updatedAt,
      })
      .from(connections)
      .where(eq(connections.tenantId, ctx.tenant.id))
      .orderBy(connections.createdAt);
  }),

  // Connect a channel using a token/credential (Discord, etc.)
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

  // Connect a Telegram bot: validate token, register webhook, store creds
  connectTelegram: tenantProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Validate the token by calling getMe
      const botInfo = await telegramGetMe(input.token);

      // Generate a random secret for webhook verification
      const webhookSecret = randomBytes(32).toString("hex");

      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        throw new Error("NEXT_PUBLIC_APP_URL is not configured");
      }

      // Register the webhook with Telegram
      await telegramSetWebhook(
        input.token,
        `${appUrl}/api/webhooks/telegram`,
        webhookSecret,
      );

      const credentialsEnc = encryptJson({ token: input.token });
      const metadata = {
        botId: botInfo.id,
        botUsername: botInfo.username,
        webhookSecret,
      };

      // Upsert: replace existing Telegram connection
      const [existing] = await ctx.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.tenantId, ctx.tenant.id),
            eq(connections.channelId, "telegram"),
          ),
        )
        .limit(1);

      if (existing) {
        // Clean up old webhook if we have old creds
        if (existing.credentialsEnc) {
          try {
            const oldCreds = decryptJson<{ token: string }>(existing.credentialsEnc);
            await telegramDeleteWebhook(oldCreds.token);
          } catch {
            // Best-effort cleanup
          }
        }

        const [updated] = await ctx.db
          .update(connections)
          .set({
            credentialsEnc,
            label: `@${botInfo.username}`,
            metadata,
            status: "active",
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(connections.id, existing.id))
          .returning();
        return { botUsername: botInfo.username, connection: updated };
      }

      const [connection] = await ctx.db
        .insert(connections)
        .values({
          tenantId: ctx.tenant.id,
          channelId: "telegram",
          label: `@${botInfo.username}`,
          credentialsEnc,
          metadata,
          status: "active",
        })
        .returning();
      return { botUsername: botInfo.username, connection };
    }),

  // Remove a channel connection
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Look up the connection to check if it's Telegram (needs webhook cleanup)
      const [conn] = await ctx.db
        .select()
        .from(connections)
        .where(
          and(
            eq(connections.id, input.id),
            eq(connections.tenantId, ctx.tenant.id),
          ),
        )
        .limit(1);

      if (conn?.channelId === "telegram" && conn.credentialsEnc) {
        try {
          const creds = decryptJson<{ token: string }>(conn.credentialsEnc);
          await telegramDeleteWebhook(creds.token);
        } catch {
          // Best-effort cleanup — still delete the connection
        }
      }

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
