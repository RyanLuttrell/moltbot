"use client";

import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");

  const { data: tenant } = trpc.tenant.me.useQuery();
  const { data: usage, isLoading } = trpc.usage.summary.useQuery();

  const createCheckout = trpc.billing.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const createPortal = trpc.billing.createPortal.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  const plan = tenant?.plan ?? "free";
  const messageCount = usage?.messageCount ?? 0;
  const limit = usage?.limit ?? 50;
  const isUnlimited = !isFinite(limit);
  const percentage = isUnlimited ? 0 : Math.min((messageCount / limit) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && messageCount >= limit;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Billing</h1>
        <p className="mt-1 text-text-secondary">
          Manage your subscription and usage
        </p>
      </div>

      {/* Flash messages */}
      {checkoutStatus === "success" && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Upgrade successful! Your plan has been updated.
        </div>
      )}
      {checkoutStatus === "cancel" && (
        <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          Checkout was cancelled. No changes were made.
        </div>
      )}

      {/* Current plan */}
      <div className="rounded-2xl border border-border bg-surface-secondary p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-text-muted">Current plan</div>
            <div className="mt-1 font-display text-xl font-semibold capitalize">{plan}</div>
          </div>
          <div className="flex gap-3">
            {plan === "free" && (
              <button
                onClick={() => createCheckout.mutate()}
                disabled={createCheckout.isPending}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {createCheckout.isPending ? "Loading..." : "Upgrade to Pro"}
              </button>
            )}
            {tenant?.stripeCustomerId && (
              <button
                onClick={() => createPortal.mutate()}
                disabled={createPortal.isPending}
                className="rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface-tertiary disabled:opacity-50"
              >
                {createPortal.isPending ? "Loading..." : "Manage subscription"}
              </button>
            )}
          </div>
        </div>

        {plan === "free" && (
          <p className="mt-3 text-sm text-text-secondary">
            Upgrade to Pro for 2,000 messages per month and priority support.
          </p>
        )}
      </div>

      {/* Usage */}
      <div className="rounded-2xl border border-border bg-surface-secondary p-6 shadow-sm">
        <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand">
          Usage this month
        </div>

        {isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-surface-tertiary" />
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <span className="font-display text-2xl font-semibold">
                  {messageCount.toLocaleString()}
                </span>
                <span className="ml-1 text-sm text-text-muted">
                  / {isUnlimited ? "unlimited" : limit.toLocaleString()} messages
                </span>
              </div>
              {!isUnlimited && (
                <span className={`text-sm font-medium ${
                  isAtLimit
                    ? "text-red-600"
                    : isNearLimit
                      ? "text-yellow-600"
                      : "text-text-muted"
                }`}>
                  {Math.round(percentage)}%
                </span>
              )}
            </div>

            {/* Progress bar */}
            {!isUnlimited && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-tertiary">
                <div
                  className={`h-full rounded-full transition-all ${
                    isAtLimit
                      ? "bg-red-500"
                      : isNearLimit
                        ? "bg-yellow-500"
                        : "bg-brand"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            )}

            {isAtLimit && plan === "free" && (
              <p className="mt-3 text-sm text-red-600">
                You have reached your monthly limit. Upgrade to continue sending messages.
              </p>
            )}
          </>
        )}
      </div>

      {/* Token breakdown */}
      {usage && (usage.totalInputTokens > 0 || usage.totalOutputTokens > 0) && (
        <div className="rounded-2xl border border-border bg-surface-secondary p-6 shadow-sm">
          <div className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand">
            Token usage
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-sm text-text-muted">Input tokens</div>
              <div className="mt-1 font-display text-lg font-semibold">
                {usage.totalInputTokens.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-text-muted">Output tokens</div>
              <div className="mt-1 font-display text-lg font-semibold">
                {usage.totalOutputTokens.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm text-text-muted">Total tokens</div>
              <div className="mt-1 font-display text-lg font-semibold">
                {(usage.totalInputTokens + usage.totalOutputTokens).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
