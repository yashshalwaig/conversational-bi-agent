"use client";

import { useState } from "react";

interface DataTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
  defaultCollapsed?: boolean;
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const columns = Object.keys(data[0]);
  const header = columns.join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const ROW_OPTIONS = [10, 25, 50, 100] as const;

export default function DataTable({
  data,
  maxRows = 50,
  defaultCollapsed = false,
}: DataTableProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [rowLimit, setRowLimit] = useState<number>(maxRows);

  if (!data || data.length === 0) return null;

  const columns = Object.keys(data[0]);
  const effectiveLimit = rowLimit === 0 ? data.length : rowLimit;
  const displayData = data.slice(0, effectiveLimit);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span
            className="inline-block transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
          >
            ▼
          </span>
          {collapsed
            ? `Show table (${data.length} rows)`
            : `${data.length} rows · ${columns.length} columns`}
        </button>
        <div className="flex items-center gap-3">
          {/* Row limit selector */}
          {!collapsed && data.length > 10 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>Show</span>
              <select
                value={rowLimit}
                onChange={(e) => setRowLimit(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
              >
                {ROW_OPTIONS.filter((n) => n < data.length).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
                <option value={0}>All ({data.length})</option>
              </select>
              <span>rows</span>
            </div>
          )}
          {/* Download button */}
          <button
            onClick={() =>
              downloadCSV(data, `query-results-${Date.now()}.csv`)
            }
            className="flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-700 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-auto max-h-[400px]">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap bg-gray-100"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, i) => (
                <tr
                  key={i}
                  className={
                    i % 2 === 0
                      ? "bg-white hover:bg-blue-50/50"
                      : "bg-gray-50/50 hover:bg-blue-50/50"
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap max-w-[300px] truncate"
                      title={
                        row[col] !== null && row[col] !== undefined
                          ? String(row[col])
                          : ""
                      }
                    >
                      {row[col] === null || row[col] === undefined
                        ? "—"
                        : typeof row[col] === "number"
                        ? (row[col] as number).toLocaleString()
                        : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!collapsed && data.length > effectiveLimit && (
        <div className="px-4 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          Showing {effectiveLimit} of {data.length.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
