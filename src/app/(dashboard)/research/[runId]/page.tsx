import { PageHeader } from '@/components/dashboard/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';

const mockRun = {
  id: 'rr_2026030901',
  name: 'RSS Market Feed Collection',
  status: 'completed',
  source: 'rss',
  startedAt: '2026-03-09T06:00:00Z',
  completedAt: '2026-03-09T06:03:12Z',
  duration: '3m 12s',
  artifacts: [
    { id: 'art_01', name: 'APAC Market News Feed', type: 'document', size: '24 KB', chunks: 12 },
    { id: 'art_02', name: 'EU Trade Signals Feed', type: 'document', size: '18 KB', chunks: 9 },
    { id: 'art_03', name: 'NA Competitor Pricing Index', type: 'document', size: '31 KB', chunks: 15 },
  ],
  diagnostics: [
    { level: 'info', message: 'Collection started with 5 configured sources', timestamp: '2026-03-09T06:00:01Z' },
    { level: 'info', message: '3 of 5 sources responded successfully', timestamp: '2026-03-09T06:01:30Z' },
    { level: 'warn', message: 'Source "LatAm Market API" returned 503, skipped', timestamp: '2026-03-09T06:01:45Z' },
    { level: 'warn', message: 'Source "Africa Trade Feed" timed out after 30s', timestamp: '2026-03-09T06:02:15Z' },
    { level: 'info', message: 'Embedding generation completed for 36 chunks', timestamp: '2026-03-09T06:03:00Z' },
    { level: 'info', message: 'Run completed with 3 artifacts and 36 embeddings', timestamp: '2026-03-09T06:03:12Z' },
  ],
  embeddings: { total: 36, model: 'all-minilm-l6-v2', dimensions: 384 },
};

export default function ResearchRunDetailPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Research Run: ${mockRun.name}`}
        description={`Run ${mockRun.id} · Source: ${mockRun.source} · Duration: ${mockRun.duration}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={mockRun.status} />
        <span className="text-sm text-slate-400">Started: {new Date(mockRun.startedAt).toLocaleString()}</span>
        <span className="text-sm text-slate-400">Completed: {new Date(mockRun.completedAt).toLocaleString()}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Artifacts</p>
          <p className="mt-2 text-2xl font-semibold text-white">{mockRun.artifacts.length}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Embeddings</p>
          <p className="mt-2 text-2xl font-semibold text-white">{mockRun.embeddings.total}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model</p>
          <p className="mt-2 text-lg font-semibold text-white">{mockRun.embeddings.model}</p>
          <p className="text-xs text-slate-500">{mockRun.embeddings.dimensions} dimensions</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard title="Collected artifacts" description="Documents and source data collected during this run.">
          <div className="space-y-3">
            {mockRun.artifacts.map((artifact) => (
              <div key={artifact.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-sm font-medium text-white">{artifact.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{artifact.type} · {artifact.size} · {artifact.chunks} chunks</p>
                </div>
                <button type="button" className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5">
                  Inspect
                </button>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Diagnostics" description="Execution log and processing details for this run.">
          <div className="space-y-2">
            {mockRun.diagnostics.map((diag, index) => (
              <div key={index} className="flex gap-3 text-sm">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium ${diag.level === 'warn' ? 'bg-amber-500/15 text-amber-300' : 'bg-cyan-500/10 text-cyan-300'}`}>
                  {diag.level}
                </span>
                <span className="text-slate-300">{diag.message}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
