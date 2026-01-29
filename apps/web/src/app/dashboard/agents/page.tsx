"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function AgentsPage() {
  const { data: agentsList, refetch } = trpc.agent.list.useQuery();
  const createAgent = trpc.agent.create.useMutation({
    onSuccess: () => {
      refetch();
      setShowCreate(false);
      setNewSlug("");
    },
  });
  const deleteAgent = trpc.agent.delete.useMutation({
    onSuccess: () => refetch(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newSlug, setNewSlug] = useState("");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Agents</h1>
          <p className="mt-1 text-text-secondary">
            Configure your AI assistants
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          New agent
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newSlug) createAgent.mutate({ slug: newSlug });
          }}
          className="flex items-end gap-3 rounded-2xl border border-border bg-surface-secondary p-4 shadow-sm"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm text-text-secondary">
              Agent slug
            </label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="my-assistant"
              pattern="^[a-z0-9-]+$"
              className="w-full rounded-full border border-border bg-surface px-4 py-2 text-sm transition-colors focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!newSlug || createAgent.isPending}
            className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="text-sm text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
        </form>
      )}

      {agentsList && agentsList.length > 0 ? (
        <div className="space-y-2">
          {agentsList.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface-secondary p-4 shadow-sm"
            >
              <div>
                <span className="font-medium">{agent.slug}</span>
                {agent.name && (
                  <span className="ml-2 text-text-muted">{agent.name}</span>
                )}
                <div className="mt-1 text-xs text-text-muted">
                  {agent.model} via {agent.modelProvider}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-sm text-text-secondary transition-colors hover:text-text-primary">
                  Configure
                </button>
                <button
                  onClick={() => deleteAgent.mutate({ slug: agent.slug })}
                  className="text-sm text-text-muted transition-colors hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-text-muted">
          No agents yet. Create one to get started.
        </div>
      )}
    </div>
  );
}
