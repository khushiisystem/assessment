import React, { useMemo, useState, useEffect } from "react";
import DataTable from "react-data-table-component";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DynamicTableProps } from "./types";
import { listPageTableStyles } from "@/utils/listPageTableStyles";
import "./dynamicTable.css";

const mergeTableStyles = (
  base: Record<string, { style?: React.CSSProperties }>,
  overlay?: Record<string, { style?: React.CSSProperties }>
) => {
  if (!overlay) return base;
  const keys = new Set([...Object.keys(base), ...Object.keys(overlay)]);
  const out: Record<string, { style?: React.CSSProperties }> = {};
  keys.forEach((k) => {
    const b = base[k] || {};
    const o = overlay[k] || {};
    out[k] = {
      ...b,
      ...o,
      style: { ...(b.style || {}), ...(o.style || {}) },
    };
  });
  return out;
};

const defaultTableStyles = listPageTableStyles;

export const DynamicTable: React.FC<DynamicTableProps> = ({
  data = [],
  columns = [],
  pagination,
  selectable = false,
  onSelectionChange,
  toggleCleared = false,
  onRowClick,
  isLoading = false,
  error = null,
  onPageChange,
  noDataMessage = "No data found",
  noDataSubMessage,
  loadingMessage = "Loading data...",
  showPagination = true,
  itemLabel = "items",
  rowsPerPage = 20,
  bulkActionBar,
  isFilterApplied = false,
  onClearFilters,
  className,
  customTableStyles,
  horizontalScroll = false,
}) => {
  // Responsive: by default the table fills its container and wraps/shrinks content
  // so it never scrolls horizontally — tighter spacing on small screens.
  // With `horizontalScroll`, columns keep their widths and the wrapper scrolls.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const responsiveStyles = useMemo(
    () =>
      horizontalScroll
        ? {
            table: { style: { width: "max-content", minWidth: "100%" } },
            tableWrapper: { style: { width: "100%" } },
            responsiveWrapper: { style: { width: "100%", overflowX: "auto" as const } },
          }
        : {
            table: { style: { width: "100%" } },
            tableWrapper: { style: { width: "100%" } },
            responsiveWrapper: { style: { width: "100%" } },
            headCells: {
              style: narrow ? { minWidth: "0", paddingLeft: "8px", paddingRight: "8px" } : {},
            },
            cells: {
              style: narrow ? { minWidth: "0", paddingLeft: "8px", paddingRight: "8px" } : {},
            },
          },
    [narrow, horizontalScroll]
  );

  const mergedCustomStyles = useMemo(
    () =>
      mergeTableStyles(
        mergeTableStyles(defaultTableStyles, customTableStyles),
        responsiveStyles
      ),
    [customTableStyles, responsiveStyles]
  );

  // Format columns for react-data-table-component
  const formattedColumns = useMemo(() => {
    return columns
      .filter((col) => !col.omit)
      .map((col) => {
        const column: any = {
          name: col.name,
          sortable: col.sortable ?? false,
          wrap: col.wrap ?? !horizontalScroll,
          grow: col.grow,
        };

        if (col.id) column.id = col.id;
        if (col.width) column.width = col.width;
        if (horizontalScroll) {
          // Keep declared min-widths so columns have room and the table can scroll.
          if (col.minWidth) column.minWidth = col.minWidth;
        } else if (!narrow && col.minWidth) {
          // Cap min-widths on desktop and drop them on small screens so columns
          // shrink to fit the container instead of forcing horizontal scroll.
          const n = parseInt(col.minWidth, 10);
          column.minWidth = Number.isNaN(n) ? col.minWidth : `${Math.min(n, 150)}px`;
        }
        if (col.maxWidth) column.maxWidth = col.maxWidth;
        if (col.center) column.center = col.center;
        if (col.right) column.right = col.right;
        if (col.ignoreRowClick) column.ignoreRowClick = col.ignoreRowClick;

        if (col.selector) {
          column.selector = typeof col.selector === "function"
            ? col.selector
            : (row: any) => row[col.selector as string] ?? "-";
        }

        if (col.cell) column.cell = col.cell;
        if (col.style) column.style = col.style;

        return column;
      });
  }, [columns, narrow]);

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-800 font-medium">Error loading data</p>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  // Pagination calculations
  const startIndex = pagination && pagination.totalCount > 0
    ? (pagination.currentPage - 1) * rowsPerPage + 1
    : 0;
  const endIndex = pagination
    ? Math.min(pagination.currentPage * rowsPerPage, pagination.totalCount)
    : 0;

  return (
    <div className={cn("bg-white  border border-gray-200 shadow-sm", horizontalScroll ? "dt-hscroll" : "dt-fit", className)}>
      {/* Bulk action bar (shown when rows are selected) */}
      {bulkActionBar}

      <DataTable
        columns={formattedColumns}
        data={data}
        progressPending={isLoading}
        progressComponent={
          <div className="py-8 text-center">
            <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet" />
            <p className="text-sm text-slate-600">{loadingMessage}</p>
          </div>
        }
        noDataComponent={
          <div className="py-8 text-center text-slate-500">
            <div className="flex flex-col items-center">
              <Search className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium mb-1">{noDataMessage}</p>
              {noDataSubMessage && (
                <p className="text-xs text-slate-400">{noDataSubMessage}</p>
              )}
              {!noDataSubMessage && (
                <p className="text-xs text-slate-400">
                  {isFilterApplied
                    ? "No data available for the selected filters. Try adjusting your filters or search query."
                    : `No ${itemLabel} available yet.`}
                </p>
              )}
              {isFilterApplied && onClearFilters && (
                <button
                  onClick={onClearFilters}
                  className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        }
        selectableRows={selectable}
        selectableRowsHighlight={selectable}
        selectableRowsVisibleOnly={false}
        onSelectedRowsChange={
          onSelectionChange
            ? ({ selectedRows }) => onSelectionChange(selectedRows)
            : undefined
        }
        clearSelectedRows={toggleCleared}
        customStyles={mergedCustomStyles}
        dense
        highlightOnHover
        pointerOnHover
        onRowClicked={onRowClick}
        pagination={false}
      />

      {/* Pagination */}
      {showPagination && pagination && pagination.totalCount > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center p-3 border-t border-gray-200 gap-3">
          <div className="text-xs text-slate-500">
            Showing <span className="font-medium">{startIndex}</span> to{" "}
            <span className="font-medium">{endIndex}</span> of{" "}
            <span className="font-medium">{pagination.totalCount}</span> {itemLabel}
          </div>

          <div className="flex items-center gap-2">
            {/* First page */}
            <button
              onClick={() => onPageChange?.(1)}
              disabled={pagination.currentPage === 1 || isLoading}
              className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              title="First Page"
            >
              <ChevronLeft className="w-3 h-3" />
              <ChevronLeft className="w-3 h-3 -ml-2" />
            </button>

            {/* Previous */}
            <button
              onClick={() => onPageChange?.(pagination.currentPage - 1)}
              disabled={pagination.currentPage <= 1 || isLoading}
              className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              title="Previous Page"
            >
              <ChevronLeft className="w-3 h-3" />
              Previous
            </button>

            {/* Page info */}
            <div className="px-2 py-1 text-xs text-slate-700">
              Page <span className="font-medium">{pagination.currentPage}</span> of{" "}
              <span className="font-medium">{pagination.totalPages}</span>
            </div>

            {/* Next */}
            <button
              onClick={() => onPageChange?.(pagination.currentPage + 1)}
              disabled={pagination.currentPage >= pagination.totalPages || isLoading}
              className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              title="Next Page"
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </button>

            {/* Last page */}
            <button
              onClick={() => onPageChange?.(pagination.totalPages)}
              disabled={pagination.currentPage === pagination.totalPages || isLoading}
              className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              title="Last Page"
            >
              <ChevronRight className="w-3 h-3" />
              <ChevronRight className="w-3 h-3 -ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamicTable;
