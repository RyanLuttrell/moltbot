import { router, tenantProcedure } from "../trpc";
import { usageRecords } from "@moltbot/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { getMonthlyMessageLimit } from "@/lib/plans";

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const usageRouter = router({
  summary: tenantProcedure.query(async ({ ctx }) => {
    const monthStart = startOfCurrentMonth();

    const [row] = await ctx.db
      .select({
        messageCount: sql<number>`count(*)::int`,
        totalInputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)::int`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.tenantId, ctx.tenant.id),
          gte(usageRecords.createdAt, monthStart),
        ),
      );

    const limit = getMonthlyMessageLimit(ctx.tenant.plan);

    return {
      messageCount: row?.messageCount ?? 0,
      totalInputTokens: row?.totalInputTokens ?? 0,
      totalOutputTokens: row?.totalOutputTokens ?? 0,
      limit,
      plan: ctx.tenant.plan,
      periodStart: monthStart.toISOString(),
    };
  }),
});
