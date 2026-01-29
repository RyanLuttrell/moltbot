"use client";

import { trpc } from "@/lib/trpc";

export default function SettingsPage() {
  const { data: tenant } = trpc.tenant.me.useQuery();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-text-secondary mt-1">Manage your account</p>
      </div>

      <div className="bg-surface-secondary border-border rounded-lg border p-6">
        <h2 className="font-medium">Account</h2>
        <dl className="text-text-secondary mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Email</dt>
            <dd>{tenant?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Tenant ID</dt>
            <dd className="font-mono text-xs">{tenant?.id ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Created</dt>
            <dd>
              {tenant?.createdAt
                ? new Date(tenant.createdAt).toLocaleDateString()
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-surface-secondary border-border rounded-lg border p-6">
        <h2 className="font-medium">API Keys</h2>
        <p className="text-text-secondary mt-2 text-sm">
          API key management coming soon. You will be able to create keys for
          programmatic access to your Moltbot tenant.
        </p>
      </div>
    </div>
  );
}
