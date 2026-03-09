'use client';

import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';
type SortableValue = string | number | Date | null | undefined;

export interface ClientDataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => SortableValue;
  headerClassName?: string;
  cellClassName?: string;
}

interface ClientDataTableProps<T> {
  columns: ClientDataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  initialSort?: { key: string; direction?: SortDirection };
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyState?: ReactNode;
  ariaLabel?: string;
  caption?: string;
  serverPagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function normalizeSortValue(value: SortableValue) {
  if (value instanceof Date) {
    return value.getTime();
  }
  return value;
}

function compareSortValues(left: SortableValue, right: SortableValue) {
  const normalizedLeft = normalizeSortValue(left);
  const normalizedRight = normalizeSortValue(right);

  if (normalizedLeft == null && normalizedRight == null) return 0;
  if (normalizedLeft == null) return 1;
  if (normalizedRight == null) return -1;
  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }
  return collator.compare(String(normalizedLeft), String(normalizedRight));
}

export function ClientDataTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  pageSize = 8,
  pageSizeOptions = [8, 16, 32],
  ariaLabel,
  caption,
  serverPagination,
  emptyState = (
    <EmptyState
      compact
      title="No records to display"
      description="Try adjusting filters, refreshing the page, or adding a new record."
      className="border-0 bg-transparent px-0 py-2"
    />
  ),
}: ClientDataTableProps<T>) {
  const captionId = useId();
  const pageSizeId = useId();
  const resultsStatusId = useId();
  const defaultSortKey = initialSort?.key ?? columns.find((column) => column.sortValue)?.key ?? null;
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSort?.direction ?? 'asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return rows;
    }

    const column = columns.find((candidate) => candidate.key === sortKey);
    if (!column?.sortValue) {
      return rows;
    }

    return [...rows].sort((left, right) => {
      const comparison = compareSortValues(column.sortValue?.(left), column.sortValue?.(right));
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [columns, rows, sortDirection, sortKey]);

  const effectivePageSize = serverPagination?.pageSize ?? currentPageSize;
  const totalItems = serverPagination?.totalItems ?? sortedRows.length;
  const totalPages = serverPagination?.totalPages ?? Math.max(1, Math.ceil(sortedRows.length / effectivePageSize));
  const safePage = serverPagination?.page ?? Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * effectivePageSize;
  const pagedRows = serverPagination ? sortedRows : sortedRows.slice(startIndex, startIndex + effectivePageSize);
  const visibleCount = pagedRows.length;

  function handlePageChange(nextPage: number) {
    if (serverPagination) {
      serverPagination.onPageChange(nextPage);
      return;
    }

    setCurrentPage(nextPage);
  }

  function handlePageSizeChange(nextPageSize: number) {
    if (serverPagination) {
      serverPagination.onPageSizeChange(nextPageSize);
      return;
    }

    setCurrentPageSize(nextPageSize);
    setCurrentPage(1);
  }

  function toggleSort(column: ClientDataTableColumn<T>) {
    if (!column.sortValue) {
      return;
    }

    if (sortKey !== column.key) {
      setSortKey(column.key);
      setSortDirection('asc');
      return;
    }

    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <div className="overflow-x-auto">
        <table
          aria-label={ariaLabel}
          aria-describedby={resultsStatusId}
          className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200"
        >
          <caption id={captionId} className="sr-only">
            {caption ?? ariaLabel ?? 'Results table'}
          </caption>
          <thead className="bg-slate-900/90 text-xs uppercase tracking-[0.2em] text-slate-400">
            <tr>
              {columns.map((column) => {
                const isSorted = sortKey === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={column.sortValue ? (isSorted ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                    className={cn('px-4 py-3 font-medium', column.headerClassName)}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        aria-label={`Sort by ${column.header}${isSorted ? `, currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                        className="inline-flex items-center gap-2 text-left transition hover:text-white"
                      >
                        <span>{column.header}</span>
                        {isSorted ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-70" />
                        )}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 bg-slate-950/40">
            {pagedRows.length > 0 ? (
              pagedRows.map((row, index) => (
                <tr key={rowKey(row, startIndex + index)} className="transition hover:bg-white/5">
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3 align-top text-slate-200', column.cellClassName)}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-slate-400">
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <div id={resultsStatusId} role="status" aria-live="polite">
          {totalItems === 0
            ? '0 results'
            : `Showing ${startIndex + 1}-${Math.min(startIndex + visibleCount, totalItems)} of ${totalItems}`}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor={pageSizeId} className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Rows</span>
            <select
              id={pageSizeId}
              value={effectivePageSize}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              aria-describedby={resultsStatusId}
              className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-sm text-slate-200"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-white/10 p-2 text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Previous page, currently on page ${safePage} of ${totalPages}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 text-center text-xs uppercase tracking-[0.2em] text-slate-500">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-white/10 p-2 text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Next page, currently on page ${safePage} of ${totalPages}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
