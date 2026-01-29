"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { CHANNELS, type ChannelDefinition } from "@/lib/channels";

export default function ChannelsPage() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("connected");
  const error = searchParams.get("error");

  const { data: connectionsList, refetch } = trpc.connection.list.useQuery();
  const connectWithToken = trpc.connection.connectWithToken.useMutation({
    onSuccess: () => {
      refetch();
      setTokenModal(null);
      setTokenValue("");
    },
  });
  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const [tokenModal, setTokenModal] = useState<ChannelDefinition | null>(null);
  const [tokenValue, setTokenValue] = useState("");

  const connectedIds = new Set(connectionsList?.map((c) => c.channelId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-text-secondary mt-1">
          Connect your messaging platforms to Moltbot
        </p>
      </div>

      {/* Flash messages */}
      {justConnected && (
        <div className="rounded-lg border border-green-800 bg-green-950/50 px-4 py-3 text-sm text-green-300">
          Successfully connected {justConnected}!
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          Connection failed: {error}
        </div>
      )}

      {/* Connected channels */}
      {connectionsList && connectionsList.length > 0 && (
        <section>
          <h2 className="text-text-muted mb-3 text-xs font-semibold uppercase tracking-widest">
            Connected
          </h2>
          <div className="space-y-2">
            {connectionsList.map((conn) => {
              const def = CHANNELS.find((c) => c.id === conn.channelId);
              return (
                <div
                  key={conn.id}
                  className="bg-surface-secondary border-border flex items-center justify-between rounded-lg border px-5 py-4"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        {def?.label ?? conn.channelId}
                      </div>
                      {conn.label && (
                        <div className="text-text-muted text-sm">
                          {conn.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge status={conn.status} />
                    <button
                      onClick={() => deleteConnection.mutate({ id: conn.id })}
                      className="text-text-muted hover:text-red-400 text-sm transition-colors"
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

      {/* Available channels */}
      <section>
        <h2 className="text-text-muted mb-3 text-xs font-semibold uppercase tracking-widest">
          Add a channel
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.filter((ch) => !connectedIds.has(ch.id)).map((channel) => (
            <button
              key={channel.id}
              onClick={() => handleConnect(channel)}
              className="bg-surface-secondary border-border hover:border-brand/50 group rounded-lg border p-5 text-left transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{channel.label}</span>
                <span className="text-text-muted text-xs uppercase">
                  {channel.authMethod === "oauth"
                    ? "OAuth"
                    : channel.authMethod === "qr"
                      ? "QR scan"
                      : "Token"}
                </span>
              </div>
              <p className="text-text-muted mt-2 text-sm">
                {channel.description}
              </p>
              {channel.tier === 2 && (
                <div className="text-brand mt-2 text-xs font-medium">
                  Requires dedicated worker
                </div>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* Token input modal */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-surface-secondary border-border w-full max-w-md rounded-xl border p-6 shadow-xl">
            <h3 className="text-lg font-semibold">
              Connect {tokenModal.label}
            </h3>
            <p className="text-text-secondary mt-1 text-sm">
              {tokenModal.description}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tokenValue.trim()) {
                  connectWithToken.mutate({
                    channelId: tokenModal.id,
                    token: tokenValue.trim(),
                  });
                }
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="text-text-secondary mb-1.5 block text-sm">
                  {tokenModal.authMethod === "token" ? "Token" : "Credentials"}
                </label>
                <input
                  type="password"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder={tokenModal.tokenPlaceholder}
                  autoFocus
                  className="bg-surface border-border focus:border-brand w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTokenModal(null);
                    setTokenValue("");
                  }}
                  className="text-text-secondary hover:text-text-primary px-4 py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tokenValue.trim() || connectWithToken.isPending}
                  className="bg-brand hover:bg-brand-dark rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  {connectWithToken.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function handleConnect(channel: ChannelDefinition) {
    switch (channel.authMethod) {
      case "oauth":
        // Redirect to the OAuth initiation route
        window.location.href = channel.oauthPath!;
        break;
      case "token":
        setTokenModal(channel);
        break;
      case "qr":
        // QR-based channels need a dedicated worker — show a placeholder for now
        setTokenModal({
          ...channel,
          authMethod: "token",
          tokenPlaceholder:
            "QR-based connection coming soon. Enter a session token if available.",
        });
        break;
    }
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-900/40 text-green-400 border-green-800",
    pending: "bg-yellow-900/40 text-yellow-400 border-yellow-800",
    error: "bg-red-900/40 text-red-400 border-red-800",
    disconnected: "bg-neutral-800 text-neutral-400 border-neutral-700",
  };
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}
