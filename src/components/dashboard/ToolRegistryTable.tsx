'use client';

import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatPercent } from '@/lib/utils';
import type { ToolRecord } from '@/types/platform';

export function ToolRegistryTable({ tools }: { tools: ToolRecord[] }) {
  return (
    <SectionCard
      title="Tool contracts"
      description="Schema, permissions, risk, and usage telemetry for platform tools."
    >
      <ClientDataTable
        ariaLabel="Tool registry table"
        caption="Platform tool contracts, permissions, risk levels, and usage telemetry."
        rows={tools}
        rowKey={(tool) => tool.name}
        initialSort={{ key: 'usage', direction: 'desc' }}
        columns={[
          {
            key: 'name',
            header: 'Tool',
            sortValue: (tool) => tool.name,
            render: (tool) => (
              <div>
                <p className="font-medium text-white">{tool.name}</p>
                <p className="text-xs text-slate-400">{tool.description}</p>
              </div>
            ),
          },
          {
            key: 'schema',
            header: 'Schema',
            sortValue: (tool) => tool.schema.length,
            render: (tool) => (
              <div className="flex flex-wrap gap-2">
                {tool.schema.map((field) => (
                  <span key={field} className="rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300">
                    {field}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: 'mode',
            header: 'Mode',
            sortValue: (tool) => tool.executionMode,
            render: (tool) => <span className="text-sm capitalize text-slate-200">{tool.executionMode}</span>,
          },
          {
            key: 'permissions',
            header: 'Permissions',
            sortValue: (tool) => tool.permissions.length,
            render: (tool) => (
              <div className="flex flex-wrap gap-2">
                {tool.permissions.map((permission) => (
                  <span
                    key={permission}
                    className="rounded-full bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: 'risk',
            header: 'Risk',
            sortValue: (tool) => tool.riskLevel,
            render: (tool) => <StatusBadge value={tool.riskLevel} />,
          },
          {
            key: 'guards',
            header: 'Guards',
            sortValue: (tool) => tool.safetyGuards.length,
            render: (tool) => (
              <div className="flex flex-wrap gap-2">
                {tool.safetyGuards.map((guard) => (
                  <span key={guard} className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
                    {guard}
                  </span>
                ))}
              </div>
            ),
          },
          {
            key: 'usage',
            header: 'Usage today',
            sortValue: (tool) => tool.usageToday,
            render: (tool) => tool.usageToday.toLocaleString(),
          },
          {
            key: 'latency',
            header: 'P95',
            sortValue: (tool) => tool.p95Ms,
            render: (tool) => `${tool.p95Ms} ms`,
          },
          {
            key: 'error',
            header: 'Error rate',
            sortValue: (tool) => tool.errorRate,
            render: (tool) => formatPercent(tool.errorRate),
          },
        ]}
      />
    </SectionCard>
  );
}