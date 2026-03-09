import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function SectionCard({ title, description, children, className }: SectionCardProps) {
  return (
    <section className={cn('rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg shadow-slate-950/10', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-lg font-semibold text-white">{title}</h3>}
          {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
