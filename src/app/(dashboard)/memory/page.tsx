import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { MemoryRegistryTable } from '@/components/dashboard/MemoryRegistryTable';
import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { formatCompactNumber } from '@/lib/utils';
import { controlPlaneService } from '@/services/control-plane';

export default async function MemoryPage() {
  const memory = await controlPlaneService.getMemory();

  return (
    <div className="space-y-6">
      <PageHeader title="AI Memory" description="Inspect memory scope distribution, vector growth, and compaction cadence across tenant, app, and agent contexts." />
      <MetricsCards
        items={[
          { label: 'Memory spaces', value: `${memory.items.length}`, delta: '+1', trend: 'up', description: 'Logical memory partitions in the control plane.' },
          { label: 'Records', value: `${formatCompactNumber(memory.items.reduce((sum, item) => sum + item.records, 0))}`, delta: '+8%', trend: 'up', description: 'Stored long-term memory and context records.' },
          { label: 'Vectors', value: `${formatCompactNumber(memory.items.reduce((sum, item) => sum + item.vectorCount, 0))}`, delta: '+12%', trend: 'up', description: 'Total embedding vectors under retention.' },
          { label: 'Agent scopes', value: `${memory.items.filter((item) => item.scope === 'agent').length}`, delta: 'flat', trend: 'flat', description: 'Agent-specific long-term memory partitions.' },
        ]}
      />
      <SectionCard title="Memory registry" description="Metadata view of memory stores; vector payloads remain in the dedicated embedding store.">
        <MemoryRegistryTable items={memory.items} />
      </SectionCard>
    </div>
  );
}
