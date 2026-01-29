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

  // Telegram-specific modal state
  const [telegramModal, setTelegramModal] = useState(false);
  const [telegramStep, setTelegramStep] = useState(1);
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramError, setTelegramError] = useState("");

  const connectTelegram = trpc.connection.connectTelegram.useMutation({
    onSuccess: (data) => {
      setTelegramBotUsername(data.botUsername ?? "");
      setTelegramStep(5);
      setTelegramError("");
      refetch();
    },
    onError: (err) => {
      setTelegramError(err.message);
    },
  });

  const connectedIds = new Set(connectionsList?.map((c) => c.channelId));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Channels</h1>
        <p className="mt-1 text-text-secondary">
          Connect your messaging platforms to Moltbot
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

      {/* Connected channels */}
      {connectionsList && connectionsList.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">
            Connected
          </h2>
          <div className="space-y-2">
            {connectionsList.map((conn) => {
              const def = CHANNELS.find((c) => c.id === conn.channelId);
              const meta = conn.metadata as Record<string, unknown> | null;
              const botUsername =
                conn.channelId === "telegram" && meta?.botUsername
                  ? String(meta.botUsername)
                  : null;
              return (
                <div
                  key={conn.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-surface-secondary px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        {def?.label ?? conn.channelId}
                      </div>
                      {conn.label && (
                        <div className="text-sm text-text-muted">
                          {conn.label}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {botUsername && (
                      <a
                        href={`https://t.me/${botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-brand transition-colors hover:text-brand-dark"
                      >
                        Open in Telegram
                      </a>
                    )}
                    <StatusBadge status={conn.status} />
                    <button
                      onClick={() => deleteConnection.mutate({ id: conn.id })}
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

      {/* Available channels */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand">
          Add a channel
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHANNELS.filter((ch) => !connectedIds.has(ch.id)).map((channel) => {
            const comingSoon = !["slack", "telegram"].includes(channel.id);
            return (
              <button
                key={channel.id}
                onClick={() => !comingSoon && handleConnect(channel)}
                disabled={comingSoon}
                className={`rounded-2xl border border-border p-5 text-left transition-all ${
                  comingSoon
                    ? "cursor-default bg-surface-secondary opacity-60"
                    : "bg-surface-secondary shadow-sm hover:border-brand/50 hover:shadow-md hover:shadow-brand/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{channel.label}</span>
                  {comingSoon ? (
                    <span className="rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-semibold uppercase text-text-muted">
                      Coming soon
                    </span>
                  ) : (
                    <span className="text-xs uppercase text-text-muted">
                      {channel.authMethod === "oauth"
                        ? "OAuth"
                        : channel.authMethod === "qr"
                          ? "QR scan"
                          : "Token"}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-text-muted">
                  {channel.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Token input modal (generic) */}
      {tokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface-secondary p-6 shadow-xl">
            <h3 className="font-display text-lg font-semibold">
              Connect {tokenModal.label}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
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
                <label className="mb-1.5 block text-sm text-text-secondary">
                  {tokenModal.authMethod === "token" ? "Token" : "Credentials"}
                </label>
                <input
                  type="password"
                  value={tokenValue}
                  onChange={(e) => setTokenValue(e.target.value)}
                  placeholder={tokenModal.tokenPlaceholder}
                  autoFocus
                  className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-brand focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTokenModal(null);
                    setTokenValue("");
                  }}
                  className="px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!tokenValue.trim() || connectWithToken.isPending}
                  className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
                >
                  {connectWithToken.isPending ? "Connecting..." : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Telegram onboarding modal */}
      {telegramModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-secondary p-6 shadow-xl">
            <TelegramConnectModal
              step={telegramStep}
              token={telegramToken}
              botUsername={telegramBotUsername}
              error={telegramError}
              isPending={connectTelegram.isPending}
              onTokenChange={setTelegramToken}
              onConnect={() => {
                if (telegramToken.trim()) {
                  setTelegramError("");
                  connectTelegram.mutate({ token: telegramToken.trim() });
                }
              }}
              onNext={() => setTelegramStep((s) => s + 1)}
              onBack={() => setTelegramStep((s) => s - 1)}
              onClose={() => {
                setTelegramModal(false);
                setTelegramStep(1);
                setTelegramToken("");
                setTelegramBotUsername("");
                setTelegramError("");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  function handleConnect(channel: ChannelDefinition) {
    if (channel.id === "telegram") {
      setTelegramModal(true);
      return;
    }

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

/* ---------- Telegram Connect Modal ---------- */

interface TelegramConnectModalProps {
  step: number;
  token: string;
  botUsername: string;
  error: string;
  isPending: boolean;
  onTokenChange: (v: string) => void;
  onConnect: () => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

function TelegramConnectModal({
  step,
  token,
  botUsername,
  error,
  isPending,
  onTokenChange,
  onConnect,
  onNext,
  onBack,
  onClose,
}: TelegramConnectModalProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Connect Telegram</h3>
        <span className="text-sm text-text-muted">Step {Math.min(step, 4)} of 4</span>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex gap-1.5">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-brand" : "bg-surface-tertiary"
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Open BotFather</h4>
            <p className="mt-1 text-sm text-text-secondary">
              BotFather is the official Telegram tool for creating bots. Click the link
              below to open it in Telegram.
            </p>
          </div>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-brand/50"
          >
            <span className="font-medium text-brand">t.me/BotFather</span>
            <span className="text-text-muted">— opens in Telegram</span>
          </a>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Create a new bot</h4>
            <p className="mt-1 text-sm text-text-secondary">
              In the BotFather chat, send the command below. BotFather will ask you for a
              display name and a username for your bot.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <code className="font-mono text-sm">/newbot</code>
          </div>
          <p className="text-xs text-text-muted">
            Choose any name and username you like. The username must end in &quot;bot&quot;
            (e.g. MyCompanyBot).
          </p>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Copy the bot token</h4>
            <p className="mt-1 text-sm text-text-secondary">
              After creating the bot, BotFather will send you an API token. It looks like
              this:
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface px-4 py-3">
            <code className="font-mono text-xs text-text-muted">
              110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw
            </code>
          </div>
          <p className="text-xs text-text-muted">
            Copy the entire token from BotFather&apos;s message.
          </p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">Paste your bot token</h4>
            <p className="mt-1 text-sm text-text-secondary">
              Paste the token from BotFather below. We&apos;ll verify it and set up the
              webhook automatically.
            </p>
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            placeholder="110201543:AAHdqTcvCH1vGWJxfSeo..."
            autoFocus
            className="w-full rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder-text-muted transition-colors focus:border-brand focus:outline-none"
          />
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium">Telegram connected!</h4>
            <p className="mt-1 text-sm text-text-secondary">
              Your bot <span className="font-medium">@{botUsername}</span> is ready.
              Send it a message to try it out.
            </p>
          </div>
          <a
            href={`https://t.me/${botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-full bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Open in Telegram
          </a>
        </div>
      )}

      {/* Footer buttons */}
      <div className="mt-6 flex justify-between">
        {step < 5 ? (
          <>
            <button
              type="button"
              onClick={step === 1 ? onClose : onBack}
              className="px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              {step === 1 ? "Cancel" : "Back"}
            </button>
            {step < 4 ? (
              <button
                type="button"
                onClick={onNext}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnect}
                disabled={!token.trim() || isPending}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {isPending ? "Connecting..." : "Connect"}
              </button>
            )}
          </>
        ) : (
          <div className="flex w-full justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Status Badge ---------- */

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
