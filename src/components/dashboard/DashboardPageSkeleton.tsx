import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';

export function DashboardPageSkeleton({
  variant = 'table',
}: {
  variant?: 'table' | 'detail' | 'board';
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-3xl" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-10 w-20" />
            <Skeleton className="mt-3 h-4 w-32" />
          </div>
        ))}
      </div>

      {variant === 'detail' ? (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <SectionCard title="Loading agents" description="Fetching active fleet and execution state.">
            <div className="space-y-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Loading details" description="Preparing tasks, decisions, logs, and workflow state.">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
            <Skeleton className="mt-4 h-40 w-full" />
            <div className="mt-4 grid gap-4 2xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full" />
              ))}
            </div>
          </SectionCard>
        </div>
      ) : variant === 'board' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <SectionCard title="Loading board" description="Hydrating orchestration lanes and dependency context.">
            <div className="grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-96 w-full" />
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Loading dependency focus" description="Preparing queue controls and audit context.">
            <Skeleton className="h-[32rem] w-full" />
          </SectionCard>
        </div>
      ) : (
        <SectionCard title="Loading table" description="Fetching dashboard records and operational metadata.">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}