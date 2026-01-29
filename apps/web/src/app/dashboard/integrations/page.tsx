"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { INTEGRATIONS, type IntegrationDefinition } from "@/lib/integrations";
import {
  GoogleLogo,
  GithubLogo,
  NotePencil,
  Kanban,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

const ICON_MAP: Record<string, Icon> = {
  GoogleLogo,
  GithubLogo,
  NotePencil,
  Kanban,
};

/** An integration is "available" (not "coming soon") if it has a concrete auth path. */
function isAvailable(def: IntegrationDefinition): boolean {
  return !!(def.oauthPath || def.authMethod === "apiKey");
}

export default function IntegrationsPage() {
  return (
    <Suspense>
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected");
  const error = searchParams.get("error");

  const { data: integrationsList, refetch } =
    trpc.integration.list.useQuery();
  const deleteIntegration = trpc.integration.delete.useMutation({
    onSuccess: () => refetch(),
  });
  const connectWithApiKey = trpc.integration.connectWithApiKey.useMutation({
    onSuccess: () => {
      refetch();
      setApiKeyModal(null);
      setApiKeyValue("");
      setApiKeyError("");
    },
    onError: (err) => {
      setApiKeyError(err.message);
    },
  });

  const [apiKeyModal, setApiKeyModal] = useState<IntegrationDefinition | null>(
    null,
  );
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [apiKeyError, setApiKeyError] = useState("");

  const connectedProviders = new Set(
    integrationsList?.map((i) => i.provider),
  );

  function handleConnect(def: IntegrationDefinition) {
    if (def.authMethod === "oauth" && def.oauthPath) {
      window.location.href = def.oauthPath;
    } else if (def.authMethod === "apiKey") {
      setApiKeyModal(def);
      setApiKeyValue("");
      setApiKeyError("");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Integrations
        </h1>
        <p className="mt-1 text-text-secondary">
          Connect third-party tools your agent can use on your behalf
        </p>
      </div>

      {/* Flash messages */}
      {justConnected && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Successfully connected {justConnected}!
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Connection failed: {error}
        </div>
      )}

      {/* Connected integrations */}
      {integrationsList && integrationsList.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">
            Connected
          </h2>
          <div className="space-y-2">
            {integrationsList.map((integration) => {
              const def = INTEGRATIONS.find(
                (i) => i.id === integration.provider,
              );
              const IconComponent = def ? ICON_MAP[def.icon] : undefined;
              return (
                <div
                  key={integration.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-secondary px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    {IconComponent && (
                      <IconComponent
                        size={24}
                        weight="duotone"
                        className="text-text-secondary"
                      />
                    )}
                    <div>
                      <div className="font-medium">
                        {integration.label ?? def?.label ?? integration.provider}
                      </div>
                      {def && (
                        <div className="mt-1 flex gap-1.5">
                          {def.capabilities.map((cap) => (
                            <span
                              key={cap.id}
                              className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand"
                            >
                              {cap.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={integration.status} />
                    <button
                      onClick={() =>
                        deleteIntegration.mutate({ id: integration.id })
                      }
                      className="text-sm text-text-muted transition-colors hover:text-red-600"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Available integrations */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">
          Available integrations
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.filter((i) => !connectedProviders.has(i.id)).map(
            (integration) => {
              const comingSoon = !isAvailable(integration);
              const IconComponent = ICON_MAP[integration.icon];
              return (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  IconComponent={IconComponent}
                  comingSoon={comingSoon}
                  onConnect={() => handleConnect(integration)}
                />
              );
            },
          )}
        </div>
      </section>

      {/* API key input modal */}
      {apiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-secondary p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold">
              Connect {apiKeyModal.label}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {apiKeyModal.description}
            </p>
            {apiKeyModal.apiKeyHelpUrl && (
              <a
                href={apiKeyModal.apiKeyHelpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm text-brand transition-colors hover:text-brand-dark"
              >
                Get your API key &rarr;
              </a>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (apiKeyValue.trim()) {
                  setApiKeyError("");
                  connectWithApiKey.mutate({
                    provider: apiKeyModal.id,
                    apiKey: apiKeyValue.trim(),
                  });
                }
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm text-text-secondary">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  placeholder={apiKeyModal.apiKeyPlaceholder}
                  autoFocus
                  className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-brand focus:outline-none"
                />
              </div>
              {apiKeyError && (
                <p className="text-sm text-red-600">{apiKeyError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyModal(null);
                    setApiKeyValue("");
                    setApiKeyError("");
                  }}
                  className="px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !apiKeyValue.trim() || connectWithApiKey.isPending
                  }
                  className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                >
                  {connectWithApiKey.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  integration,
  IconComponent,
  comingSoon,
  onConnect,
}: {
  integration: IntegrationDefinition;
  IconComponent?: Icon;
  comingSoon: boolean;
  onConnect: () => void;
}) {
  return (
    <button
      onClick={() => {
        if (!comingSoon) onConnect();
      }}
      disabled={comingSoon}
      className={`rounded-2xl border border-border p-5 text-left transition-all ${
        comingSoon
          ? "cursor-default bg-surface-secondary opacity-60"
          : "bg-surface-secondary shadow-sm hover:border-brand/50 hover:shadow-md hover:shadow-brand/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {IconComponent && (
            <IconComponent
              size={20}
              weight="duotone"
              className="text-text-secondary"
            />
          )}
          <span className="font-medium">{integration.label}</span>
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
            Coming soon
          </span>
        ) : (
          <span className="text-xs uppercase text-text-muted">
            {integration.authMethod === "oauth" ? "OAuth" : "API key"}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-text-muted">
        {integration.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {integration.capabilities.map((cap) => (
          <span
            key={cap.id}
            className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-medium text-text-muted"
          >
            {cap.label}
          </span>
        ))}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    error: "bg-red-50 text-red-700 border-red-200",
    disconnected: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}
