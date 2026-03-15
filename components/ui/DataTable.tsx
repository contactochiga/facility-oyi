"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import Button from "./Button";
import Input from "./Input";

export function DataTable<T>({
  data,
  columns,
  title,
  searchKey,
}: {
  data: T[];
  columns: ColumnDef<T, any>[];
  title: string;
  searchKey?: keyof T;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const needle = String(filterValue ?? "").toLowerCase().trim();
      if (!needle) return true;

      const haystacks: string[] = [];
      if (searchKey) {
        haystacks.push(String((row.original as any)[searchKey] ?? ""));
      }

      try {
        haystacks.push(JSON.stringify(row.original));
      } catch {}

      return haystacks.some((v) => v.toLowerCase().includes(needle));
    },
  });

  return (
    <div className="glass p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-xs text-zinc-500">Search • sort • paginate • row actions</div>
        </div>

        <div className="w-full md:w-[320px]">
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search…"
          />
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5 text-zinc-300">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left font-medium whitespace-nowrap"
                    onClick={h.column.getToggleSortingHandler()}
                    style={{ cursor: h.column.getCanSort() ? "pointer" : "default" }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-white/10">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-white/5 transition">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap text-zinc-200">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}

            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={columns.length}>
                  No results.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-zinc-500">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Prev
          </Button>
          <Button variant="ghost" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
