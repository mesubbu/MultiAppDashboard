'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterChip {
  key: string;
  label: string;
  options: string[];
  value: string;
}

interface FilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: FilterChip[];
  onFilterChange: (key: string, value: string) => void;
  mode?: string;
  modeLabel?: string;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  onFilterChange,
  mode,
  modeLabel,
  className,
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3', className)}>
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-white/10 bg-slate-950 py-2 pl-9 pr-8 text-sm text-slate-100 outline-none transition focus:border-cyan-400/40"
          aria-label={searchPlaceholder}
        />
        {searchValue ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-white"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {filters.map((filter) => (
        <select
          key={filter.key}
          value={filter.value}
          onChange={(e) => onFilterChange(filter.key, e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300 outline-none transition focus:border-cyan-400/40"
          aria-label={filter.label}
        >
          <option value="">{filter.label}</option>
          {filter.options.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      ))}

      {mode ? (
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
          <div className="h-2 w-2 rounded-full bg-cyan-400" />
          {modeLabel ?? mode}
        </div>
      ) : null}
    </div>
  );
}
