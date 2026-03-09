import { PageHeader } from '@/components/dashboard/PageHeader';
import { ToolRegistryTable } from '@/components/dashboard/ToolRegistryTable';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { controlPlaneService } from '@/services/control-plane';

export default async function ToolsPage() {
  const tools = await controlPlaneService.getTools();

  return (
    <div className="space-y-6">
      <PageHeader title="Tool Registry" description="Inspect `domain.action.object` tools with schema contracts, permissions, risk levels, and usage telemetry." />
      <MetricsCards
        items={[
          { label: 'Registered tools', value: `${tools.items.length}`, delta: '+2', trend: 'up', description: 'Tools visible to the control plane and tool executor.' },
          { label: 'High-risk tools', value: `${tools.items.filter((tool) => tool.riskLevel === 'high' || tool.riskLevel === 'critical').length}`, delta: 'flat', trend: 'flat', description: 'Tools that need tighter review and audit posture.' },
          { label: 'Calls today', value: `${tools.items.reduce((sum, tool) => sum + tool.usageToday, 0).toLocaleString()}`, delta: '+11%', trend: 'up', description: 'Aggregate tool invocations across the platform.' },
          { label: 'Avg p95', value: `${Math.round(tools.items.reduce((sum, tool) => sum + tool.p95Ms, 0) / tools.items.length)} ms`, delta: '-8%', trend: 'down', description: 'Performance benchmark across registry tools.' },
        ]}
      />
      <ToolRegistryTable tools={tools.items} />
    </div>
  );
}
