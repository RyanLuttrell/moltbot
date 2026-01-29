"use client";

import { trpc } from "@/lib/trpc";

const AVAILABLE_CHANNELS = [
  { id: "slack", label: "Slack", tier: 1 },
  { id: "discord", label: "Discord", tier: 1 },
  { id: "telegram", label: "Telegram", tier: 1 },
  { id: "googlechat", label: "Google Chat", tier: 1 },
  { id: "msteams", label: "Microsoft Teams", tier: 1 },
  { id: "whatsapp", label: "WhatsApp", tier: 2 },
  { id: "signal", label: "Signal", tier: 2 },
  { id: "matrix", label: "Matrix", tier: 2 },
] as const;

export default function ChannelsPage() {
  const { data: connectionsList, refetch } = trpc.connection.list.useQuery();
  const createConnection = trpc.connection.create.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteConnection = trpc.connection.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const connectedIds = new Set(connectionsList?.map((c) => c.channelId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-text-secondary mt-1">
          Connect your messaging platforms
        </p>
      </div>

      {/* Connected channels */}
      {connectionsList && connectionsList.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
            Connected
          </h2>
          <div className="space-y-2">
            {connectionsList.map((conn) => (
              <div
                key={conn.id}
                className="bg-surface-secondary border-border flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <span className="font-medium">{conn.channelId}</span>
                  {conn.label && (
                    <span className="text-text-muted ml-2 text-sm">
                      {conn.label}
                    </span>
                  )}
                  <span
                    className={`ml-3 inline-block rounded-full px-2 py-0.5 text-xs ${
                      conn.status === "active"
                        ? "bg-green-900/40 text-green-400"
                        : conn.status === "error"
                          ? "bg-red-900/40 text-red-400"
                          : "bg-yellow-900/40 text-yellow-400"
                    }`}
                  >
                    {conn.status}
                  </span>
                </div>
                <button
                  onClick={() => deleteConnection.mutate({ id: conn.id })}
                  className="text-text-muted hover:text-red-400 text-sm transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available channels */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
          Available
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_CHANNELS.filter((ch) => !connectedIds.has(ch.id)).map(
            (channel) => (
              <button
                key={channel.id}
                onClick={() =>
                  createConnection.mutate({ channelId: channel.id })
                }
                className="bg-surface-secondary border-border hover:border-brand/50 rounded-lg border p-4 text-left transition-colors"
              >
                <div className="font-medium">{channel.label}</div>
                <div className="text-text-muted mt-1 text-xs">
                  {channel.tier === 1 ? "Token / OAuth" : "Session-based"}
                </div>
              </button>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
