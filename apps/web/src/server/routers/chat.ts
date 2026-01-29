import { z } from "zod";
import { router, tenantProcedure } from "../trpc";
import {
  dashboardMessages,
  usageRecords,
  agents,
} from "@moltbot/db/schema";
import { eq, and, gte, asc, sql } from "drizzle-orm";
import { getMonthlyMessageLimit } from "@/lib/plans";
import { TRPCError } from "@trpc/server";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const chatRouter = router({
  // Load conversation history (last 100 messages)
  history: tenantProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: dashboardMessages.id,
        role: dashboardMessages.role,
        content: dashboardMessages.content,
        model: dashboardMessages.model,
        createdAt: dashboardMessages.createdAt,
      })
      .from(dashboardMessages)
      .where(eq(dashboardMessages.tenantId, ctx.tenant.id))
      .orderBy(asc(dashboardMessages.createdAt))
      .limit(100);

    return rows;
  }),

  // Send a message to the agent and get a response
  send: tenantProcedure
    .input(z.object({ message: z.string().min(1).max(10_000) }))
    .mutation(async ({ ctx, input }) => {
      // Quota check
      const monthStart = startOfCurrentMonth();
      const [usage] = await ctx.db
        .select({ messageCount: sql<number>`count(*)::int` })
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.tenantId, ctx.tenant.id),
            gte(usageRecords.createdAt, monthStart),
          ),
        );

      const limit = getMonthlyMessageLimit(ctx.tenant.plan);
      if ((usage?.messageCount ?? 0) >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You've reached your monthly message limit (${limit} messages on the ${ctx.tenant.plan} plan). Upgrade to continue.`,
        });
      }

      // Load agent config (first agent for tenant, or defaults)
      const [agent] = await ctx.db
        .select()
        .from(agents)
        .where(eq(agents.tenantId, ctx.tenant.id))
        .limit(1);

      // Insert user message
      await ctx.db.insert(dashboardMessages).values({
        tenantId: ctx.tenant.id,
        role: "user",
        content: input.message,
      });

      // Dispatch to worker
      const workerUrl = process.env.WORKER_URL;
      const workerSecret = process.env.WORKER_API_SECRET;
      if (!workerUrl || !workerSecret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Worker not configured",
        });
      }

      const requestBody = {
        tenantId: ctx.tenant.id,
        prompt: input.message,
        channel: "dashboard" as const,
        replyConfig: {},
        agentConfig: {
          model: agent?.model,
          systemPrompt: agent?.systemPrompt,
        },
      };

      const res = await fetch(`${workerUrl}/api/agent/invoke`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerSecret}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[chat.send] Worker error:", errBody);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get agent response. Please try again.",
        });
      }

      const result = (await res.json()) as {
        ok: boolean;
        replyText?: string;
        usage?: { model: string; inputTokens: number; outputTokens: number };
        error?: string;
      };

      if (!result.ok || !result.replyText) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "No response from agent",
        });
      }

      const model = result.usage?.model ?? agent?.model ?? "claude-sonnet-4-20250514";

      // Insert assistant message
      await ctx.db.insert(dashboardMessages).values({
        tenantId: ctx.tenant.id,
        role: "assistant",
        content: result.replyText,
        model,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
      });

      // Record usage
      await ctx.db.insert(usageRecords).values({
        tenantId: ctx.tenant.id,
        agentSlug: agent?.slug ?? null,
        model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
        channelId: "dashboard",
      });

      return {
        content: result.replyText,
        model,
      };
    }),

  // Clear conversation (delete messages + worker session)
  clear: tenantProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .delete(dashboardMessages)
      .where(eq(dashboardMessages.tenantId, ctx.tenant.id));

    // Delete the session file on the worker
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_API_SECRET;
    if (workerUrl && workerSecret) {
      fetch(`${workerUrl}/api/agent/session`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${workerSecret}`,
        },
        body: JSON.stringify({
          tenantId: ctx.tenant.id,
          sessionKey: `dashboard-${ctx.tenant.id}`,
        }),
      }).catch((err) => {
        console.error("[chat.clear] Failed to delete worker session:", err);
      });
    }

    return { success: true };
  }),
});
