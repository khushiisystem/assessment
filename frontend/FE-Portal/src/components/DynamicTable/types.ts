import type { CSSProperties, ReactNode } from "react";

export interface TableColumn<T = any> {
  /** Passed to react-data-table-component for defaultSortFieldId / stable keys */
  id?: string;
  name: string | ReactNode;
  selector?: string | ((row: T) => any);
  cell?: (row: T, rowIndex?: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  grow?: number;
  wrap?: boolean;
  omit?: boolean;
  center?: boolean;
  right?: boolean;
  ignoreRowClick?: boolean;
  style?: CSSProperties;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  nextUrl: string | null;
  prevUrl: string | null;
}

export interface DynamicTableProps<T = any> {
  data: T[];
  columns: TableColumn<T>[];
  pagination: PaginationState;
  rowsPerPage?: number;

  // Selection
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  toggleCleared?: boolean;

  // Row click
  onRowClick?: (row: T, event?: any) => void;

  // State
  isLoading?: boolean;
  error?: string | null;

  // Pagination
  onPageChange?: (newPage: number) => void;
  showPagination?: boolean;

  // Empty/Loading messages
  noDataMessage?: string;
  noDataSubMessage?: string;
  loadingMessage?: string;
  itemLabel?: string;

  // Filter state (for empty message)
  isFilterApplied?: boolean;
  onClearFilters?: () => void;

  // Bulk actions slot
  bulkActionBar?: ReactNode;

  /** Extra classes on the outer table wrapper */
  className?: string;
  /** Shallow-merged into default react-data-table-component `customStyles` (per-section `style` objects merged) */
  customTableStyles?: Record<string, { style?: CSSProperties }>;
  /** Allow the table to scroll horizontally for wide/many-column tables instead of cramming columns. */
  horizontalScroll?: boolean;
}

export interface ApiTableResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
