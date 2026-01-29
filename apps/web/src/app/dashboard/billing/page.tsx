"use client";

import { trpc } from "@/lib/trpc";

export default function BillingPage() {
  const { data: tenant } = trpc.tenant.me.useQuery();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-text-secondary mt-1">
          Manage your subscription and usage
        </p>
      </div>

      <div className="bg-surface-secondary border-border rounded-lg border p-6">
        <div className="text-text-muted text-sm">Current plan</div>
        <div className="mt-1 text-xl font-semibold capitalize">
          {tenant?.plan ?? "free"}
        </div>
        <p className="text-text-secondary mt-3 text-sm">
          Stripe billing integration coming soon. You will be able to upgrade
          plans, view usage, and manage payment methods here.
        </p>
      </div>
    </div>
  );
}
