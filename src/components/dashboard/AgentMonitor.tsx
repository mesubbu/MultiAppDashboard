'use client';

import { useState } from 'react';

import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { AgentRecord } from '@/types/platform';

export function AgentMonitor({ agents }: { agents: AgentRecord[] }) {
  const [localAgents, setLocalAgents] = useState(agents);
  const [saving, setSaving] = useState<string | null>(null);

  async function applyAction(agentId: string, payload: Record<string, string | number>) {
    setSaving(agentId);
    await fetch(`/api/admin/agents/${agentId}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);

    setLocalAgents((current) =>
      current.map((agent) => {
        if (agent.id !== agentId) return agent;
        if (payload.action === 'pause') return { ...agent, state: 'paused' };
        if (payload.action === 'restart') return { ...agent, state: 'running' };
        return {
          ...agent,
          budgetUsd: typeof payload.budgetUsd === 'number' ? payload.budgetUsd : agent.budgetUsd,
          workflowVersion: typeof payload.workflowVersion === 'string' ? payload.workflowVersion : agent.workflowVersion,
        };
      }),
    );
    setSaving(null);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {localAgents.map((agent) => (
        <SectionCard key={agent.id} title={agent.name} description={`${agent.tenantId} • ${agent.appId}`}>
          <div className="space-y-4 text-sm text-slate-300">
            <div className="flex items-center justify-between">
              <StatusBadge value={agent.state} />
              <span className="text-slate-500">Queue: {agent.queue}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-white/5 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Budget</p>
                <p className="mt-1 font-medium text-white">{formatCurrency(agent.budgetUsd)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Decisions</p>
                <p className="mt-1 font-medium text-white">{agent.decisionsToday}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Last task</p>
              <p className="mt-1 leading-6 text-slate-300">{agent.lastTask}</p>
            </div>
            <div className="grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Budget (USD)</span>
                <input defaultValue={agent.budgetUsd} type="number" className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100" onBlur={(event) => applyAction(agent.id, { action: 'update_budget', budgetUsd: Number(event.target.value) })} />
              </label>
              <label className="grid gap-1">
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Workflow version</span>
                <input defaultValue={agent.workflowVersion} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-100" onBlur={(event) => applyAction(agent.id, { action: 'update_workflow', workflowVersion: event.target.value })} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyAction(agent.id, { action: 'pause' })} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/5">Pause</button>
              <button onClick={() => applyAction(agent.id, { action: 'restart' })} className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-400">Restart</button>
            </div>
            <p className="text-xs text-slate-500">Last heartbeat: {formatDateTime(agent.lastHeartbeatAt)}{saving === agent.id ? ' • saving…' : ''}</p>
          </div>
        </SectionCard>
      ))}
    </div>
  );
}
