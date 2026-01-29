"use client";

import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const { data: tenant, isLoading } = trpc.tenant.me.useQuery();
  const { data: connectionsList } = trpc.connection.list.useQuery();
  const { data: agentsList } = trpc.agent.list.useQuery();

  if (isLoading) {
    return <div className="text-text-secondary">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-text-secondary mt-1">
          Welcome back{tenant?.name ? `, ${tenant.name}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Channels"
          value={connectionsList?.length ?? 0}
          href="/dashboard/channels"
        />
        <StatCard
          label="Agents"
          value={agentsList?.length ?? 0}
          href="/dashboard/agents"
        />
        <StatCard label="Plan" value={tenant?.plan ?? "free"} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const Wrapper = href ? "a" : "div";
  return (
    <Wrapper
      href={href}
      className="bg-surface-secondary border-border rounded-lg border p-5"
    >
      <div className="text-text-muted text-sm">{label}</div>
      <div className="mt-1 text-2xl font-semibold capitalize">
        {String(value)}
      </div>
    </Wrapper>
  );
}
