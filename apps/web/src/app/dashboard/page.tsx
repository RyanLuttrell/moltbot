"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const { data: tenant, isLoading: tenantLoading } = trpc.tenant.me.useQuery();
  const { data: connectionsList, isLoading: connectionsLoading } =
    trpc.connection.list.useQuery();
  const { data: usage } = trpc.usage.summary.useQuery();

  const isLoading = tenantLoading || connectionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="bg-surface-secondary h-20 animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface-secondary h-20 animate-pulse rounded-lg"
            />
          ))}
        </div>
      </div>
    );
  }

  const activeConnections =
    connectionsList?.filter((c) => c.status === "active").length ?? 0;
  const totalConnections = connectionsList?.length ?? 0;
  const hasChannel = totalConnections > 0;
  const hasUsage = (usage?.messageCount ?? 0) > 0;
  const setupComplete = hasChannel && hasUsage;

  // Show onboarding for new users
  if (!setupComplete) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome{tenant?.name ? `, ${tenant.name}` : " to Moltbot"}
          </h1>
          <p className="text-text-secondary mt-1">
            Get up and running in a few steps
          </p>
        </div>

        <div className="space-y-3">
          {/* Step 1: Connect a channel */}
          <OnboardingStep
            step={1}
            title="Connect a messaging channel"
            description="Link Slack, Discord, or another platform so Moltbot can receive and respond to messages."
            complete={hasChannel}
            href="/dashboard/channels"
            actionLabel="Connect Slack"
          />

          {/* Step 2: Send a message */}
          <OnboardingStep
            step={2}
            title="Send your first message"
            description={
              hasChannel
                ? "Mention your bot in Slack to trigger a response and verify everything works."
                : "Connect a channel first, then send a message to your bot."
            }
            complete={hasUsage}
            disabled={!hasChannel}
          />

          {/* Step 3: Done */}
          <OnboardingStep
            step={3}
            title="You're all set"
            description="Your bot is live. Explore billing and settings from the sidebar."
            complete={false}
            disabled={!hasUsage}
          />
        </div>

        {hasChannel && !hasUsage && (
          <div className="bg-surface-secondary border-border rounded-lg border p-6">
            <h2 className="font-medium">Waiting for your first message</h2>
            <p className="text-text-secondary mt-1 text-sm">
              Mention your bot in a Slack channel (e.g. <code className="bg-surface-tertiary rounded px-1.5 py-0.5 text-xs">@YourBot hello</code>) and it will respond automatically.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Normal dashboard for users who have completed setup
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome{tenant?.name ? `, ${tenant.name}` : ""}
        </h1>
        <p className="text-text-secondary mt-1">
          Here is an overview of your Moltbot setup
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Channels"
          value={totalConnections}
          detail={`${activeConnections} active`}
          href="/dashboard/channels"
        />
        <StatCard
          label="Messages this month"
          value={usage?.messageCount ?? 0}
          detail={
            usage
              ? `of ${isFinite(usage.limit) ? usage.limit.toLocaleString() : "unlimited"}`
              : undefined
          }
          href="/dashboard/billing"
        />
        <StatCard
          label="Plan"
          value={tenant?.plan ?? "free"}
          capitalize
          href="/dashboard/billing"
        />
      </div>
    </div>
  );
}

function OnboardingStep({
  step,
  title,
  description,
  complete,
  href,
  actionLabel,
  disabled,
}: {
  step: number;
  title: string;
  description: string;
  complete: boolean;
  href?: string;
  actionLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`border-border rounded-lg border p-5 transition-colors ${
        complete
          ? "border-green-800 bg-green-950/30"
          : disabled
            ? "bg-surface-secondary opacity-50"
            : "bg-surface-secondary"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            complete
              ? "bg-green-900 text-green-300"
              : "bg-surface-tertiary text-text-muted"
          }`}
        >
          {complete ? "\u2713" : step}
        </div>
        <div className="flex-1">
          <div className={`font-medium ${complete ? "text-green-300" : ""}`}>
            {title}
          </div>
          <p className="text-text-secondary mt-0.5 text-sm">{description}</p>
          {href && !complete && !disabled && (
            <Link
              href={href}
              className="bg-brand hover:bg-brand-dark mt-3 inline-block rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors"
            >
              {actionLabel ?? title}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  href,
  capitalize,
}: {
  label: string;
  value: string | number;
  detail?: string;
  href?: string;
  capitalize?: boolean;
}) {
  const content = (
    <>
      <div className="text-text-muted text-sm">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${capitalize ? "capitalize" : ""}`}
      >
        {String(value)}
      </div>
      {detail && (
        <div className="text-text-muted mt-1 text-xs">{detail}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-surface-secondary border-border hover:border-brand/30 rounded-lg border p-5 transition-colors"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-surface-secondary border-border rounded-lg border p-5">
      {content}
    </div>
  );
}
