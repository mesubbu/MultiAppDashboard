import { EmptyState } from '@/components/ui/EmptyState';
import { AuditLogTable } from '@/components/dashboard/AuditLogTable';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { parseAuditListQuery } from '@/lib/catalog-list-query';
import { controlPlaneService } from '@/services/control-plane';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const query = parseAuditListQuery(resolvedSearchParams);
  const audit = await controlPlaneService.getAuditPage(query);
  const exportSearch = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (typeof value === 'string') exportSearch.set(key, value);
  }

  const actorCount = new Set(audit.items.map((item) => item.actor)).size;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Audit log</h1>
          <p className="text-sm text-slate-400">Filter platform changes by actor, action, resource, scope, and date range.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <a className="rounded-full border border-white/10 px-4 py-2 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200" href={`/api/admin/audit/export?${exportSearch.toString()}&format=csv`}>Export CSV</a>
          <a className="rounded-full border border-white/10 px-4 py-2 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-200" href={`/api/admin/audit/export?${exportSearch.toString()}&format=json`}>Export JSON</a>
        </div>
      </div>

      <MetricsCards items={[
        { label: 'Visible entries', value: `${audit.pageInfo.totalItems}`, delta: 'Filtered', trend: 'up', description: 'Entries matching the current audit filters across the visible scope.' },
        { label: 'Actors on page', value: `${actorCount}`, delta: 'Distinct', trend: 'up', description: 'Unique actors represented on the current audit page.' },
        { label: 'Current page', value: `${audit.pageInfo.page}/${audit.pageInfo.totalPages}`, delta: `${audit.items.length} rows`, trend: 'up', description: 'Cursor-aware page position within the filtered audit history.' },
      ]} />

      <form className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/40 p-4 md:grid-cols-6">
        <label className="grid gap-2">
          <span className="sr-only">Search summary or resource</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" name="q" defaultValue={query.query} placeholder="Search summary or resource" />
        </label>
        <label className="grid gap-2">
          <span className="sr-only">Actor</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" name="actor" defaultValue={query.actor} placeholder="Actor" />
        </label>
        <label className="grid gap-2">
          <span className="sr-only">Action</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" name="action" defaultValue={query.action} placeholder="Action" />
        </label>
        <label className="grid gap-2">
          <span className="sr-only">Resource type</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" name="resource_type" defaultValue={query.resourceType} placeholder="Resource type" />
        </label>
        <label className="grid gap-2">
          <span className="sr-only">From date</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" type="date" name="from" defaultValue={query.from?.slice(0, 10)} />
        </label>
        <label className="grid gap-2">
          <span className="sr-only">To date</span>
          <input className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" type="date" name="to" defaultValue={query.to?.slice(0, 10)} />
        </label>
        <button className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 md:col-span-6 md:justify-self-start">Apply filters</button>
      </form>

      {audit.items.length ? (
        <AuditLogTable rows={audit.items} pageInfo={audit.pageInfo} />
      ) : (
        <EmptyState title="No audit entries match these filters" description="Try widening the date range or clearing actor/action filters." />
      )}
    </section>
  );
}