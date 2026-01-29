"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  ChatCircleDots,
  Check,
  PaperPlaneTilt,
  Robot,
  SpinnerGap,
  Trash,
  User,
  Warning,
} from "@phosphor-icons/react";
import Markdown from "react-markdown";

export default function DashboardPage() {
  const { data: tenant, isLoading: tenantLoading } = trpc.tenant.me.useQuery();
  const { data: connectionsList, isLoading: connectionsLoading } =
    trpc.connection.list.useQuery();
  const { data: usage } = trpc.usage.summary.useQuery();

  const isLoading = tenantLoading || connectionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-20 animate-pulse rounded-2xl bg-surface-tertiary" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl bg-surface-tertiary"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalConnections = connectionsList?.length ?? 0;
  const hasChannel = totalConnections > 0;
  const hasUsage = (usage?.messageCount ?? 0) > 0;
  const setupComplete = hasChannel && hasUsage;

  if (!setupComplete) {
    return <Onboarding tenant={tenant} hasChannel={hasChannel} hasUsage={hasUsage} />;
  }

  return <Chat tenant={tenant} usage={usage} />;
}

// ---------------------------------------------------------------------------
// Chat interface (post-onboarding)
// ---------------------------------------------------------------------------

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Chat({
  tenant,
  usage,
}: {
  tenant: { name: string | null } | null | undefined;
  usage: { messageCount: number; limit: number; plan: string } | null | undefined;
}) {
  const utils = trpc.useUtils();
  const { data: messages, isLoading: historyLoading } = trpc.chat.history.useQuery();
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate();
      utils.usage.summary.invalidate();
    },
  });
  const clearMutation = trpc.chat.clear.useMutation({
    onSuccess: () => {
      utils.chat.history.invalidate();
    },
  });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, sendMutation.isPending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setInput("");
    sendMutation.mutate({ message: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const atLimit =
    usage && isFinite(usage.limit) && usage.messageCount >= usage.limit;
  const nearLimit =
    usage &&
    isFinite(usage.limit) &&
    !atLimit &&
    usage.messageCount >= usage.limit * 0.8;

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Chat{tenant?.name ? ` with ${tenant.name}'s Agent` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            Talk to your agent directly from the dashboard
          </p>
        </div>
        <button
          onClick={() => clearMutation.mutate()}
          disabled={clearMutation.isPending || (!messages?.length && !sendMutation.isPending)}
          className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash size={16} />
          {clearMutation.isPending ? "Clearing..." : "Clear conversation"}
        </button>
      </div>

      {/* Quota warning */}
      {nearLimit && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800">
          <Warning size={18} weight="fill" className="shrink-0 text-yellow-600" />
          <span>
            You've used {usage.messageCount} of {usage.limit} messages this month.{" "}
            <Link href="/dashboard/billing" className="font-medium underline">
              Upgrade your plan
            </Link>{" "}
            for more.
          </span>
        </div>
      )}

      {atLimit && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <Warning size={18} weight="fill" className="shrink-0 text-red-600" />
          <span>
            You've reached your monthly message limit ({usage.limit} messages on the{" "}
            {usage.plan} plan).{" "}
            <Link href="/dashboard/billing" className="font-medium underline">
              Upgrade to continue
            </Link>
            .
          </span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface-secondary p-4">
        {historyLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <SpinnerGap size={32} className="animate-spin text-text-muted" />
            <div className="text-sm text-text-muted">Loading conversation...</div>
          </div>
        ) : !messages?.length && !sendMutation.isPending ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <ChatCircleDots size={48} className="text-text-muted" />
            <div className="text-sm text-text-muted">
              Send a message to start a conversation with your agent
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages?.map((msg) => (
              <MessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
              />
            ))}

            {/* Optimistic user message while waiting */}
            {sendMutation.isPending && sendMutation.variables && (
              <>
                <MessageBubble
                  role="user"
                  content={sendMutation.variables.message}
                />
                <div className="flex items-start gap-2">
                  <MessageAvatar role="assistant" />
                  <div className="rounded-2xl rounded-tl-sm bg-surface-tertiary px-4 py-3">
                    <ThinkingDots />
                  </div>
                </div>
              </>
            )}

            {/* Error state */}
            {sendMutation.isError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                {sendMutation.error.message}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="pt-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-secondary px-4 py-2 shadow-sm focus-within:border-brand/40 focus-within:shadow-md focus-within:shadow-brand/5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={atLimit ? "Message limit reached" : "Type a message..."}
            disabled={sendMutation.isPending || !!atLimit}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending || !!atLimit}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <PaperPlaneTilt size={16} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageAvatar({ role }: { role: string }) {
  const isUser = role === "user";
  return (
    <div
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        isUser ? "bg-brand/10 text-brand" : "bg-surface-tertiary text-text-secondary"
      }`}
    >
      {isUser ? <User size={16} weight="bold" /> : <Robot size={16} weight="bold" />}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  createdAt,
}: {
  role: string;
  content: string;
  createdAt?: Date | string | null;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[75%] items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
        <MessageAvatar role={role} />
        <div>
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              isUser
                ? "rounded-tr-sm bg-brand text-white"
                : "rounded-tl-sm bg-surface-tertiary text-text-primary"
            }`}
          >
            {isUser ? (
              <span className="whitespace-pre-wrap">{content}</span>
            ) : (
              <div className="chat-markdown">
                <Markdown>{content}</Markdown>
              </div>
            )}
          </div>
          <div className={`mt-1 text-[11px] text-text-muted ${isUser ? "text-right" : "text-left"}`}>
            {createdAt ? formatTime(createdAt) : "Just now"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:0ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:150ms]" />
      <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:300ms]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding (unchanged for new users)
// ---------------------------------------------------------------------------

function Onboarding({
  tenant,
  hasChannel,
  hasUsage,
}: {
  tenant: { name: string | null } | null | undefined;
  hasChannel: boolean;
  hasUsage: boolean;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Welcome{tenant?.name ? `, ${tenant.name}` : " to Moltbot"}
        </h1>
        <p className="mt-1 text-text-secondary">
          Get up and running in a few steps
        </p>
      </div>

      <div className="space-y-3">
        <OnboardingStep
          step={1}
          title="Connect a messaging channel"
          description="Link Slack, Discord, or another platform so Moltbot can receive and respond to messages."
          complete={hasChannel}
          href="/dashboard/channels"
          actionLabel="Connect Slack"
        />

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

        <OnboardingStep
          step={3}
          title="You're all set"
          description="Your bot is live. Explore billing and settings from the sidebar."
          complete={false}
          disabled={!hasUsage}
        />
      </div>

      {hasChannel && !hasUsage && (
        <div className="rounded-2xl border border-border bg-surface-secondary p-6 shadow-sm">
          <h2 className="font-medium">Waiting for your first message</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Mention your bot in a Slack channel (e.g.{" "}
            <code className="rounded-md bg-surface-tertiary px-1.5 py-0.5 text-xs">
              @YourBot hello
            </code>
            ) and it will respond automatically.
          </p>
        </div>
      )}
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
      className={`rounded-2xl border p-5 transition-colors ${
        complete
          ? "border-green-200 bg-green-50"
          : disabled
            ? "border-border bg-surface-secondary opacity-50"
            : "border-border bg-surface-secondary shadow-sm"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            complete
              ? "bg-green-100 text-green-700"
              : "bg-surface-tertiary text-text-muted"
          }`}
        >
          {complete ? <Check size={14} weight="bold" /> : step}
        </div>
        <div className="flex-1">
          <div className={`font-medium ${complete ? "text-green-700" : ""}`}>
            {title}
          </div>
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
          {href && !complete && !disabled && (
            <Link
              href={href}
              className="mt-3 inline-block rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              {actionLabel ?? title}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
