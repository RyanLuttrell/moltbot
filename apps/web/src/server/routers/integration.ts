import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { integrations } from "@moltbot/db/schema";
import { eq, and } from "drizzle-orm";
import { encryptJson } from "@/lib/crypto";

/** Validate a Linear API key by querying the viewer. */
async function validateLinearKey(
  apiKey: string,
): Promise<{ name: string; email: string }> {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: "{ viewer { name email } }" }),
  });

  if (!res.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid Linear API key",
    });
  }

  const json = (await res.json()) as {
    data?: { viewer?: { name: string; email: string } };
    errors?: { message: string }[];
  };

  if (json.errors?.length || !json.data?.viewer) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        json.errors?.[0]?.message ?? "Could not verify Linear API key",
    });
  }

  return json.data.viewer;
}

export const integrationRouter = router({
  // List all integrations for the current tenant (excludes encrypted credentials)
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        id: integrations.id,
        provider: integrations.provider,
        label: integrations.label,
        status: integrations.status,
        metadata: integrations.metadata,
        scopes: integrations.scopes,
        errorMessage: integrations.errorMessage,
        tokenExpiresAt: integrations.tokenExpiresAt,
        createdAt: integrations.createdAt,
        updatedAt: integrations.updatedAt,
      })
      .from(integrations)
      .where(eq(integrations.tenantId, ctx.tenant.id))
      .orderBy(integrations.createdAt);
  }),

  // Connect an integration using an API key (e.g. Linear)
  connectWithApiKey: tenantProcedure
    .input(
      z.object({
        provider: z.string().min(1),
        apiKey: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let label: string = input.provider;
      let metadata: Record<string, unknown> = {};

      // Provider-specific validation
      if (input.provider === "linear") {
        const viewer = await validateLinearKey(input.apiKey);
        label = `Linear — ${viewer.email}`;
        metadata = { name: viewer.name, email: viewer.email };
      }

      const credentialsEnc = encryptJson({ apiKey: input.apiKey });

      // Upsert: replace existing integration for this provider
      const [existing] = await ctx.db
        .select()
        .from(integrations)
        .where(
          and(
            eq(integrations.tenantId, ctx.tenant.id),
            eq(integrations.provider, input.provider),
          ),
        )
        .limit(1);

      if (existing) {
        const [updated] = await ctx.db
          .update(integrations)
          .set({
            credentialsEnc,
            label,
            status: "active",
            errorMessage: null,
            metadata,
            updatedAt: new Date(),
          })
          .where(eq(integrations.id, existing.id))
          .returning();
        return updated;
      }

      const [created] = await ctx.db
        .insert(integrations)
        .values({
          tenantId: ctx.tenant.id,
          provider: input.provider,
          label,
          credentialsEnc,
          status: "active",
          metadata,
        })
        .returning();
      return created;
    }),

  // Remove an integration
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(integrations)
        .where(
          and(
            eq(integrations.id, input.id),
            eq(integrations.tenantId, ctx.tenant.id),
          ),
        );
      return { success: true };
    }),
});
