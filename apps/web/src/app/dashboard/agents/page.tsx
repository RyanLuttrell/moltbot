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
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-text-secondary mt-1">
            Configure your AI assistants
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand hover:bg-brand-dark rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
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
          className="bg-surface-secondary border-border flex items-end gap-3 rounded-lg border p-4"
        >
          <div className="flex-1">
            <label className="text-text-secondary mb-1 block text-sm">
              Agent slug
            </label>
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="my-assistant"
              pattern="^[a-z0-9-]+$"
              className="bg-surface border-border w-full rounded-md border px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!newSlug || createAgent.isPending}
            className="bg-brand hover:bg-brand-dark rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="text-text-muted hover:text-text-primary text-sm"
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
              className="bg-surface-secondary border-border flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <span className="font-medium">{agent.slug}</span>
                {agent.name && (
                  <span className="text-text-muted ml-2">{agent.name}</span>
                )}
                <div className="text-text-muted mt-1 text-xs">
                  {agent.model} via {agent.modelProvider}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-text-secondary hover:text-text-primary text-sm transition-colors">
                  Configure
                </button>
                <button
                  onClick={() => deleteAgent.mutate({ slug: agent.slug })}
                  className="text-text-muted hover:text-red-400 text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-text-muted py-12 text-center">
          No agents yet. Create one to get started.
        </div>
      )}
    </div>
  );
}
