"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/common/states";
import type { PageMeta } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Backend sort field (must be whitelisted by the API); enables a sortable header. */
  sortKey?: string;
  className?: string;
  headerClassName?: string;
  /** Hide below a breakpoint to keep tables readable on small screens. */
  hideBelow?: "sm" | "md" | "lg";
}

const HIDE: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export interface SortState {
  field: string;
  dir: "asc" | "desc";
}

export function parseSort(sort: string | undefined): SortState | null {
  if (!sort) return null;
  const [field, dir] = sort.split(",")[0].split(":");
  return field ? { field, dir: dir === "desc" ? "desc" : "asc" } : null;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  onRetry,
  empty,
  sort,
  onSortChange,
  onRowClick,
  caption,
  rowClassName,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: React.ReactNode;
  sort?: string;
  onSortChange?: (sort: string) => void;
  onRowClick?: (row: T) => void;
  caption?: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  const current = parseSort(sort);

  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isLoading && !rows) return <TableSkeleton columns={Math.min(columns.length, 5)} />;
  if (!rows || rows.length === 0) return <>{empty ?? <EmptyState title="Nothing to show" />}</>;

  return (
    <div className={cn("relative w-full overflow-x-auto", isLoading && "opacity-60 transition-opacity")} aria-busy={isLoading || undefined}>
      <table className="w-full caption-bottom text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="border-b bg-muted/40">
          <tr>
            {columns.map((col) => {
              const active = !!current && !!col.sortKey && current.field === col.sortKey;
              const ariaSort = active ? (current?.dir === "asc" ? "ascending" : "descending") : undefined;
              return (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={col.sortKey ? (ariaSort ?? "none") : undefined}
                  className={cn(
                    "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground first:pl-4 last:pr-4",
                    col.hideBelow && HIDE[col.hideBelow],
                    col.headerClassName,
                  )}
                >
                  {col.sortKey && onSortChange ? (
                    <button
                      type="button"
                      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-foreground"
                      onClick={() => onSortChange(`${col.sortKey}:${active && current?.dir === "asc" ? "desc" : "asc"}`)}
                    >
                      {col.header}
                      {active ? (
                        current?.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                "transition-colors hover:bg-muted/40",
                onRowClick && "cursor-pointer",
                rowClassName?.(row),
              )}
              onClick={onRowClick ? (e) => {
                // Let links, buttons and menus inside the row handle their own clicks.
                if ((e.target as HTMLElement).closest("a,button,[role=menuitem],input,select,label")) return;
                onRowClick(row);
              } : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn("px-3 py-2.5 align-middle first:pl-4 last:pr-4", col.hideBelow && HIDE[col.hideBelow], col.className)}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  meta,
  onPageChange,
  onPageSizeChange,
  pageSizes = [20, 50, 100],
}: {
  meta: PageMeta | undefined;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
}) {
  if (!meta || meta.total === 0) return null;
  const first = (meta.page - 1) * meta.pageSize + 1;
  const last = Math.min(meta.page * meta.pageSize, meta.total);
  return (
    <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span className="tabular-nums">
        {first.toLocaleString()}–{last.toLocaleString()} of {meta.total.toLocaleString()}
      </span>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <select
              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
              value={meta.pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="tabular-nums">
          Page {meta.page} of {meta.totalPages}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)} aria-label="Previous page">
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPageChange(meta.page + 1)}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
