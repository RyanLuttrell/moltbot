import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";
import { db } from "./db.js";
import { tenants } from "@moltbot/db/schema";
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

// Tenant procedure — resolves the tenant row from the Clerk user ID
export const tenantProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    const [tenant] = await ctx.db
      .select()
      .from(tenants)
      .where(eq(tenants.clerkUserId, ctx.userId))
      .limit(1);

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found. Complete onboarding first.",
      });
    }

    return next({ ctx: { ...ctx, tenant } });
  },
);
