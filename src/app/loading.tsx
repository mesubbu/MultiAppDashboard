import { Skeleton } from '@/components/ui/Skeleton';

export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_28%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] px-4 py-6 text-white md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1800px] gap-6">
        <div className="hidden w-80 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 lg:block">
          <Skeleton className="h-10 w-40" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-10 w-72" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-72" />
            <Skeleton className="h-5 w-full max-w-3xl" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32 w-full" />
            ))}
          </div>
          <Skeleton className="h-[28rem] w-full" />
        </div>
      </div>
    </div>
  );
}
