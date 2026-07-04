import { useState, useCallback, useRef } from "react";
import { PaginationState } from "./types";

export interface UseTableStateConfig {
  initialPage?: number;
  rowsPerPage?: number;
}

export interface UseTableStateReturn {
  // Pagination
  pagination: PaginationState;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  updatePaginationFromResponse: (count: number, next: string | null, previous: string | null, page?: number) => void;
  goToPage: (page: number) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Selection
  selectedRows: any[];
  setSelectedRows: (rows: any[]) => void;
  toggleCleared: boolean;
  clearSelection: () => void;

  // Loading & Error
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}

export const useTableState = (config: UseTableStateConfig = {}): UseTableStateReturn => {
  const { initialPage = 1, rowsPerPage = 20 } = config;

  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: initialPage,
    totalPages: 1,
    totalCount: 0,
    nextUrl: null,
    prevUrl: null,
  });

  const [searchQuery, setSearchQueryState] = useState("");
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  }, []);

  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRows([]);
    setToggleCleared((prev) => !prev);
  }, []);

  const updatePaginationFromResponse = useCallback(
    (count: number, next: string | null, previous: string | null, page?: number) => {
      const totalPages = Math.ceil(count / rowsPerPage);
      setPagination((prev) => ({
        ...prev,
        totalCount: count,
        totalPages,
        nextUrl: next,
        prevUrl: previous,
        ...(page !== undefined ? { currentPage: page } : {}),
      }));
    },
    [rowsPerPage]
  );

  return {
    pagination,
    setPagination,
    updatePaginationFromResponse,
    goToPage,
    searchQuery,
    setSearchQuery,
    selectedRows,
    setSelectedRows,
    toggleCleared,
    clearSelection,
    isLoading,
    setIsLoading,
    error,
    setError,
  };
};

export default useTableState;
