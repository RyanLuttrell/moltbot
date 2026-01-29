import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";
import { db } from "./db";
import { tenants, tenantConfigs } from "@moltbot/db/schema";
import { eq } from "drizzle-orm";

// Context available to every tRPC procedure
export async function createContext() {
  const { userId } = await auth();
  return { userId, db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Authenticated procedure — rejects if no Clerk session
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

// Tenant procedure — resolves (or auto-provisions) the tenant from the Clerk user ID
export const tenantProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    let [tenant] = await ctx.db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, ctx.userId))
      .limit(1);

    if (!tenant) {
      // Auto-provision on first access
      [tenant] = await ctx.db
        .insert(tenants)
        .values({ clerkUserId: ctx.userId })
        .returning();

      await ctx.db.insert(tenantConfigs).values({
        tenantId: tenant.id,
        config: {},
      });
    }

    return next({ ctx: { ...ctx, tenant } });
  },
);
