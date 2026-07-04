import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, useNavigationType } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import {
  Printer,
  FileText,
  CheckCircle,
  Users,
  Trophy,
  Search,
  Eye,
  Video,
  ClipboardList,
  Star,
  Sparkles,
  Calendar,
  Layers,
  Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLazyGetAssessmentResultsQuery, useLazyGetSessionsQuery } from "@/store";
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
import { ActiveFilterChip } from "@/components/common/SearchFilterPanel";
import { PageHeader } from "@/components/common/PageHeader";
import { ListPageToolbar, SortOption } from "@/components/common/ListPageToolbar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableRowIconButton } from "@/components/common/TableRowActions";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { listPageTableStyles } from "@/utils/listPageTableStyles";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import './AssessmentResult.css';

interface AssessmentCandidate {
  candidate_assessment_id: number;
  candidate_ai_assessment_id: number;
  assessment_id: number;
  assessment_type: string;
  assessment_title: string;
  candidate_id: number;
  candidate_name: string;
  candidate_email: string;
  status: string;
  score: string;
  completed_date: string | null;
  assigned_date: string | null;
}

interface MockSessionAdmin {
  id: number;
  display_name: string;
  display_email: string;
  stack: string;
  status: string;
  questions: number[];
  responses: Record<string, { rating?: number; notes?: string }>;
  overall_feedback: string | null;
  created_at: number;
}

type ResultTab = "regular" | "ai" | "mock_interviews";

type ResultSortMode = "default" | "candidate_asc" | "candidate_desc" | "score_desc" | "score_asc" | "date_desc" | "date_asc";

const RESULT_SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Default order" },
  { value: "candidate_asc", label: "Candidate (A–Z)" },
  { value: "candidate_desc", label: "Candidate (Z–A)" },
  { value: "score_desc", label: "Score (high to low)" },
  { value: "score_asc", label: "Score (low to high)" },
  { value: "date_desc", label: "Date (newest first)" },
  { value: "date_asc", label: "Date (oldest first)" },
];

type MockSortMode = "default" | "candidate_asc" | "candidate_desc" | "date_desc" | "date_asc";

const MOCK_SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Default order" },
  { value: "candidate_asc", label: "Candidate (A–Z)" },
  { value: "candidate_desc", label: "Candidate (Z–A)" },
  { value: "date_desc", label: "Date (newest first)" },
  { value: "date_asc", label: "Date (oldest first)" },
];

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: {
    metrics: {
      total_assessments: number;
      total_candidates: number;
      total_completed: number;
      avg_score: number;
    };
    assessment_candidates: AssessmentCandidate[];
  };
}

/* ------------------------------------------------------------------ */
/* Score formatting helpers — turn the API's free-form score string   */
/* ("9/10", "45%", "78", "-") into a clear, consistent, labelled value */
/* ------------------------------------------------------------------ */

type ParsedScore = {
  hasValue: boolean;
  /** 0–100 percentage equivalent, or null when not graded. */
  percentage: number | null;
  /** Raw marks obtained, when the API reports marks (e.g. "9/10"). */
  obtained: number | null;
  /** Total marks available, when the API reports marks. */
  total: number | null;
  raw: string;
};

const parseScoreValue = (score: string | null | undefined): ParsedScore => {
  if (!score || score === "-") {
    return { hasValue: false, percentage: null, obtained: null, total: null, raw: score ?? "-" };
  }
  if (score.includes("/")) {
    const [obtained, total] = score.split("/").map((n) => Number(n.trim()));
    const percentage = total > 0 ? (obtained / total) * 100 : null;
    return { hasValue: true, percentage, obtained, total, raw: score };
  }
  if (score.includes("%")) {
    const percentage = parseFloat(score.replace("%", ""));
    return { hasValue: !isNaN(percentage), percentage: isNaN(percentage) ? null : percentage, obtained: null, total: null, raw: score };
  }
  const n = parseFloat(score);
  return { hasValue: !isNaN(n), percentage: isNaN(n) ? null : n, obtained: null, total: null, raw: score };
};

type ScoreBand = { label: string; text: string; pill: string; bar: string };

/** Maps a 0–100 percentage to a performance band (colour + label). */
const getScoreBand = (percentage: number | null): ScoreBand => {
  if (percentage === null) return { label: "Not graded", text: "text-slate-500", pill: "bg-slate-100 text-slate-600", bar: "bg-slate-300" };
  if (percentage >= 80) return { label: "Excellent", text: "text-emerald-700", pill: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" };
  if (percentage >= 60) return { label: "Good", text: "text-blue-700", pill: "bg-blue-100 text-blue-700", bar: "bg-blue-500" };
  if (percentage >= 40) return { label: "Average", text: "text-amber-700", pill: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };
  return { label: "Needs work", text: "text-rose-700", pill: "bg-rose-100 text-rose-700", bar: "bg-rose-500" };
};

/** Maps a 1–5 interviewer rating to a performance band. */
const getRatingBand = (avg: number | null): ScoreBand => {
  if (avg === null || isNaN(avg)) return { label: "Not rated", text: "text-slate-500", pill: "bg-slate-100 text-slate-600", bar: "bg-slate-300" };
  if (avg >= 4) return { label: "Strong", text: "text-emerald-700", pill: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" };
  if (avg >= 3) return { label: "Good", text: "text-blue-700", pill: "bg-blue-100 text-blue-700", bar: "bg-blue-500" };
  if (avg >= 2) return { label: "Fair", text: "text-amber-700", pill: "bg-amber-100 text-amber-700", bar: "bg-amber-500" };
  return { label: "Weak", text: "text-rose-700", pill: "bg-rose-100 text-rose-700", bar: "bg-rose-500" };
};

/** Table-header label with an optional info tooltip explaining the metric. */
const ColumnHeader: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <span className="inline-flex items-center gap-1">
    {label}
    {hint && (
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="img" aria-label={`About ${label}`} className="text-slate-300 transition-colors hover:text-brand-violet">
            <Info className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[250px] text-xs font-normal leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    )}
  </span>
);

export const AsssesmentResult: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const navType = useNavigationType();

  // RTK Query hooks
  const [getAssessmentResults] = useLazyGetAssessmentResultsQuery();
  const [getSessions] = useLazyGetSessionsQuery();
  const isFirstRender = useRef(true);

  const ITEMS_PER_PAGE = 20;

  // Use shared table state
  const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>(() => navType === "POP" ? (sessionStorage.getItem("res_status") ?? "completed") : "completed");
  const [typeFilter, setTypeFilter] = useState<string>(() => navType === "POP" ? (sessionStorage.getItem("res_type") || "") : "");

  // Initialize search from session storage for back navigation
  const [fromDate, setFromDate] = useState<string>(() =>
    navType === "POP" ? (sessionStorage.getItem("res_from_date") || "") : ""
  );
  const [toDate, setToDate] = useState<string>(() =>
    navType === "POP" ? (sessionStorage.getItem("res_to_date") || "") : ""
  );

  // Mock interviews filter states
  const [mockStatusFilter, setMockStatusFilter] = useState<string>(() => 
    navType === "POP" ? (sessionStorage.getItem("res_mock_status") || "all") : "all"
  );
  const [mockStackFilter, setMockStackFilter] = useState<string>(() => 
    navType === "POP" ? (sessionStorage.getItem("res_mock_stack") || "all") : "all"
  );
  const [mockDateFrom, setMockDateFrom] = useState<string>(() => 
    navType === "POP" ? (sessionStorage.getItem("res_mock_date_from") || "") : ""
  );
  const [mockDateTo, setMockDateTo] = useState<string>(() => 
    navType === "POP" ? (sessionStorage.getItem("res_mock_date_to") || "") : ""
  );
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [mockFilterPanelOpen, setMockFilterPanelOpen] = useState(false);
  const [resultSortMode, setResultSortMode] = useState<ResultSortMode>("default");
  const [mockSortMode, setMockSortMode] = useState<MockSortMode>("default");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_searchInitialized] = useState(() => {
    if (navType === "POP") {
      const savedSearch = sessionStorage.getItem("res_search") || "";
      if (savedSearch) table.setSearchQuery(savedSearch);
      const savedPage = sessionStorage.getItem("res_page");
      if (savedPage) table.goToPage(parseInt(savedPage, 10));
    }
    return true;
  });

  // Data states
  const [resultsData, setResultsData] = useState<ApiResponse | null>(null);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);

  // Dropdown options - Static lists for initial display
  const [statusOptions] = useState([
    { value: "", label: "All Status" },
    { value: "assigned", label: "Assigned" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "expired", label: "Expired" },
  ]);

  const [typeOptions] = useState([
    { value: "", label: "All Types" },
    { value: "regular", label: "Regular Assessment" },
    { value: "ai", label: "AI Interview" },
  ]);

  // Mock interviews tab state
  const [resultTab, setResultTab] = useState<ResultTab>(() => {
    if (navType !== "POP") return "regular";
    return (sessionStorage.getItem("res_tab") as ResultTab) || "regular";
  });
  const [mockSessions, setMockSessions] = useState<MockSessionAdmin[]>([]);
  const [mockIsLoading, setMockIsLoading] = useState(false);
  const [mockSearch, setMockSearch] = useState(() => navType === "POP" ? (sessionStorage.getItem("res_mock_search") || "") : "");

  // Get unique stacks for mock interviews
  const mockUniqueStacks = useMemo(() => 
    Array.from(new Set(mockSessions.map((s) => s.stack))),
    [mockSessions]
  );

  // Build API URL with filters - useCallback to prevent recreation
  const buildApiUrl = useCallback((page: number = 1) => {
    const params = new URLSearchParams();

    // Add pagination
    params.append('page', page.toString());
    params.append('page_size', ITEMS_PER_PAGE.toString());

    // Add search parameter if exists
    if (table.searchQuery.trim()) {
      params.append('search', table.searchQuery.trim());
    }

    // Add status filter if selected
    if (statusFilter) {
      params.append('status', statusFilter);
    }

    // Add type filter if selected
    if (typeFilter) {
      params.append('assessment_type', typeFilter);
    }
    // Use 'assigned_from' and 'assigned_to'
    if (fromDate) {
      params.append('assigned_from', fromDate);
    }
    if (toDate) {
      params.append('assigned_to', toDate);
    }

    return `/my-admin/results/?${params.toString()}`;
  }, [table.searchQuery, statusFilter, typeFilter, fromDate, toDate]);

  // Fetch results - useCallback to prevent recreation
  const fetchResults = useCallback(async (page: number = 1) => {
    table.setIsLoading(true);
    try {
      const endpoint = buildApiUrl(page);
      console.log("Fetching:", endpoint);
      const data = await getAssessmentResults(endpoint, false).unwrap();
      setResultsData(data);
      table.updatePaginationFromResponse(
        data.count || 0,
        data.next,
        data.previous,
        page
      );

    } catch (error) {
      console.error("Error fetching results data:", error);
      toast({
        title: "Failed",
        description: "Failed to load assessment results",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      table.setIsLoading(false);
      setHasFetchedInitialData(true);
    }
  }, [buildApiUrl, toast, getAssessmentResults]);


  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchResults(table.pagination.currentPage);
      return;
    }
    const timer = setTimeout(() => {
      fetchResults(1);
    }, 500);

    return () => 
      clearTimeout(timer);
 }, [table.searchQuery, statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    if (resultTab === "regular") {
      setTypeFilter("regular");
    } else if (resultTab === "ai") {
      setTypeFilter("ai");
    }
  }, [resultTab]);
  useEffect(() => {
    sessionStorage.setItem("res_tab", resultTab);
    sessionStorage.setItem("res_status", statusFilter);
    sessionStorage.setItem("res_type", typeFilter);
    sessionStorage.setItem("res_search", table.searchQuery);
    sessionStorage.setItem("res_page", table.pagination.currentPage.toString());
    sessionStorage.setItem("res_mock_search", mockSearch);
    sessionStorage.setItem("res_from_date", fromDate);
    sessionStorage.setItem("res_to_date", toDate);
    sessionStorage.setItem("res_mock_status", mockStatusFilter);
    sessionStorage.setItem("res_mock_stack", mockStackFilter);
    sessionStorage.setItem("res_mock_date_from", mockDateFrom);
    sessionStorage.setItem("res_mock_date_to", mockDateTo);
  }, [resultTab, statusFilter, typeFilter, table.searchQuery, table.pagination.currentPage, mockSearch, fromDate, toDate, mockStatusFilter, mockStackFilter, mockDateFrom, mockDateTo]);

  const fetchMockSessions = useCallback(async () => {
    setMockIsLoading(true);
    try {
      const data = await getSessions("status=completed", true).unwrap();
      setMockSessions(Array.isArray(data) ? data : (data.results ?? []));
    } catch {
      toast({ title: "Failed", description: "Failed to load mock sessions", variant: "destructive", duration: 3000 });
    } finally {
      setMockIsLoading(false);
    }
  }, [toast, getSessions]);

  useEffect(() => {
    if (resultTab === "mock_interviews" && mockSessions.length === 0) {
      fetchMockSessions();
    }
  }, [resultTab, fetchMockSessions]);


  const handleSearchChange = (value: string) => {
    table.setSearchQuery(value);
    table.clearSelection();
  };

  // Handle filter changes
  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    table.clearSelection();
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    table.clearSelection();
  };

  // Clear all filters
  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    table.clearSelection();
  };

  const handleToDateChange = (value: string) => {
    setToDate(value);
    table.clearSelection();
  };

  const clearDateFilter = () => {
    setFromDate("");
    setToDate("");
    table.clearSelection();
    sessionStorage.removeItem("res_from_date");
    sessionStorage.removeItem("res_to_date");
  };

  // Mock interview filter handlers
  const handleMockStatusChange = (value: string) => {
    setMockStatusFilter(value);
  };

  const handleMockStackChange = (value: string) => {
    setMockStackFilter(value);
  };

  const handleMockDateFromChange = (value: string) => {
    setMockDateFrom(value);
  };

  const handleMockDateToChange = (value: string) => {
    setMockDateTo(value);
  };

  const clearMockFilters = () => {
    setMockStatusFilter("all");
    setMockStackFilter("all");
    setMockDateFrom("");
    setMockDateTo("");
    setMockSearch("");
    sessionStorage.removeItem("res_mock_status");
    sessionStorage.removeItem("res_mock_stack");
    sessionStorage.removeItem("res_mock_date_from");
    sessionStorage.removeItem("res_mock_date_to");
    sessionStorage.removeItem("res_mock_search");
  };

  const clearFilters = () => {
    table.setSearchQuery("");
    setStatusFilter("");
    setTypeFilter("");
    setFromDate("");
    setToDate("");
    table.clearSelection();
    sessionStorage.removeItem("res_tab");
    sessionStorage.removeItem("res_status");
    sessionStorage.removeItem("res_type");
    sessionStorage.removeItem("res_search");
    sessionStorage.removeItem("res_page");
    sessionStorage.removeItem("res_mock_search");
    sessionStorage.removeItem("res_from_date");
    sessionStorage.removeItem("res_to_date");
  };

  const isFilterApplied = table.searchQuery.trim() || statusFilter || typeFilter || fromDate || toDate;
  const isMockFilterApplied = !!(mockSearch.trim() || mockStatusFilter !== "all" || mockStackFilter !== "all" || mockDateFrom || mockDateTo);

  // ── Active filter chips ───
  const resultFilterChips: ActiveFilterChip[] = [
    ...(table.searchQuery.trim()
      ? [{
        id: "search",
        label: "Search",
        value: table.searchQuery,
        onRemove: () => table.setSearchQuery(""),
        tone: "blue" as const,
        quoteValue: true,
      }]
      : []),
    ...(statusFilter
      ? [{
        id: "status",
        label: "Status",
        value: statusOptions.find((opt) => opt.value === statusFilter)?.label || statusFilter,
        onRemove: () => setStatusFilter(""),
        tone: "green" as const,
      }]
      : []),
    ...(typeFilter
      ? [{
        id: "type",
        label: "Type",
        value: typeOptions.find((opt) => opt.value === typeFilter)?.label || typeFilter,
        onRemove: () => setTypeFilter(""),
        tone: "purple" as const,
      }]
      : []),
    ...(fromDate
      ? [{
          id: "from_date",
          label: "From",
          value: new Date(fromDate + "T00:00:00").toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          }),
          onRemove: () => { setFromDate(""); table.clearSelection(); },
          tone: "amber" as const,
        }]
      : []),
    ...(toDate
      ? [{
          id: "to_date",
          label: "To",
          value: new Date(toDate + "T00:00:00").toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          }),
          onRemove: () => { setToDate(""); table.clearSelection(); },
          tone: "amber" as const,
      }]
      : []),
  ];

  // Mock filter chips
  const mockFilterChips: ActiveFilterChip[] = [
    ...(mockSearch.trim()
      ? [{
          id: "mock_search",
          label: "Search",
          value: mockSearch,
          onRemove: () => setMockSearch(""),
          tone: "blue" as const,
          quoteValue: true,
        }]
      : []),
    ...(mockStatusFilter !== "all"
      ? [{
          id: "mock_status",
          label: "Status",
          value: mockStatusFilter.charAt(0).toUpperCase() + mockStatusFilter.slice(1),
          onRemove: () => setMockStatusFilter("all"),
          tone: "green" as const,
        }]
      : []),
    ...(mockStackFilter !== "all"
      ? [{
          id: "mock_stack",
          label: "Stack",
          value: mockStackFilter,
          onRemove: () => setMockStackFilter("all"),
          tone: "purple" as const,
        }]
      : []),
    ...(mockDateFrom
      ? [{
          id: "mock_date_from",
          label: "From",
          value: new Date(mockDateFrom + "T00:00:00").toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          }),
          onRemove: () => setMockDateFrom(""),
          tone: "amber" as const,
        }]
      : []),
    ...(mockDateTo
      ? [{
          id: "mock_date_to",
          label: "To",
          value: new Date(mockDateTo + "T00:00:00").toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          }),
          onRemove: () => setMockDateTo(""),
          tone: "amber" as const,
        }]
      : []),
  ];

  // Chip tone → Tailwind classes
  const chipToneClass: Record<string, string> = {
    blue:   "bg-blue-100 text-blue-700 border border-blue-200",
    green:  "bg-green-100 text-green-700 border border-green-200",
    purple: "bg-purple-100 text-purple-700 border border-purple-200",
    amber:  "bg-amber-100 text-amber-700 border border-amber-200",
  };
  
  const currentResults = resultsData?.results?.assessment_candidates || [];

  const sortedResults = useMemo(() => {
    const list = [...currentResults];
    const scoreOf = (r: AssessmentCandidate) => parseFloat(r.score) || 0;
    const dateOf = (r: AssessmentCandidate) =>
      new Date(r.completed_date || r.assigned_date || 0).getTime() || 0;

    switch (resultSortMode) {
      case "candidate_asc":
        return list.sort((a, b) => a.candidate_name.localeCompare(b.candidate_name));
      case "candidate_desc":
        return list.sort((a, b) => b.candidate_name.localeCompare(a.candidate_name));
      case "score_desc":
        return list.sort((a, b) => scoreOf(b) - scoreOf(a));
      case "score_asc":
        return list.sort((a, b) => scoreOf(a) - scoreOf(b));
      case "date_desc":
        return list.sort((a, b) => dateOf(b) - dateOf(a));
      case "date_asc":
        return list.sort((a, b) => dateOf(a) - dateOf(b));
      default:
        return list;
    }
  }, [currentResults, resultSortMode]);
  // Summary metrics from API
  const totalAssessments = resultsData?.results?.metrics?.total_assessments || 0;
  const totalCandidates = resultsData?.results?.metrics?.total_candidates || 0;
  const totalCompleted = resultsData?.results?.metrics?.total_completed || 0;
  const avgScore = resultsData?.results?.metrics?.avg_score?.toFixed(2) || "0.00";

  const handlePrintReport = () => {
    window.print();
  };

  const getMockAvgScore = (responses: Record<string, { rating?: number; notes?: string }>) => {
    const scores = Object.values(responses).map(v => v?.rating ?? 0).filter(r => r > 0);
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
  };

  const filteredMockSessions = mockSessions.filter(s => {
    // Search filter
    if (mockSearch.trim()) {
      const term = mockSearch.toLowerCase();
      const matchesSearch = (
       (s.display_name || "").toLowerCase().includes(term) ||
        (s.display_email || "").toLowerCase().includes(term) ||
        (s.stack || "").toLowerCase().includes(term)
      );
      if (!matchesSearch) return false;
    }

    // Status filter
    if (mockStatusFilter !== "all" && s.status !== mockStatusFilter) {
      return false;
    }

    // Stack filter
    if (mockStackFilter !== "all" && s.stack !== mockStackFilter) {
      return false;
    }

    // Date filter
    if (mockDateFrom || mockDateTo) {
      const sessionDate = s.created_at ? new Date(s.created_at * 1000) : null;
      if (!sessionDate) return false;

      if (mockDateFrom) {
        const fromDate = new Date(mockDateFrom + "T00:00:00");
        if (sessionDate < fromDate) return false;
      }

      if (mockDateTo) {
        const toDate = new Date(mockDateTo + "T23:59:59");
        if (sessionDate > toDate) return false;
      }
    }

    return true;
  });

  const sortedMockSessions = useMemo(() => {
    const list = [...filteredMockSessions];
    const nameOf = (s: MockSessionAdmin) => s.display_name || s.stack || "";
    const dateOf = (s: MockSessionAdmin) => (s.created_at ? s.created_at * 1000 : 0);

    switch (mockSortMode) {
      case "candidate_asc":
        return list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      case "candidate_desc":
        return list.sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
      case "date_desc":
        return list.sort((a, b) => dateOf(b) - dateOf(a));
      case "date_asc":
        return list.sort((a, b) => dateOf(a) - dateOf(b));
      default:
        return list;
    }
  }, [filteredMockSessions, mockSortMode]);


  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in_progress":
        return "bg-amber-100 text-amber-800";
      case "assigned":
        return "bg-yellow-100 text-yellow-800";
      case "expired":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "in_progress":
        return "In Progress";
      case "assigned":
        return "Assigned";
      case "expired":
        return "Expired";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "regular":
        return "Regular";
      case "ai":
        return "AI Interview";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };

  const isResultViewable = (result: AssessmentCandidate) =>
    result.status === "completed" && result.score !== "-";

  const handleViewDetails = (result: AssessmentCandidate) => {
    // Always give feedback on click — never a silent dead button.
    if (!isResultViewable(result)) {
      toast({
        title: "Result not available yet",
        description:
          result.status === "completed"
            ? "This assessment has no score recorded yet."
            : `Results appear once the candidate completes the assessment (currently ${getStatusText(result.status).toLowerCase()}).`,
        duration: 3000,
      });
      return;
    }

    if (result.assessment_type === "regular") {
      if (!result.candidate_assessment_id) {
        toast({
          title: "Unable to open result",
          description: "Missing assessment reference for this row.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      navigate(`/admin/results/assessment/${result.candidate_assessment_id}`);
    } else if (result.assessment_type === "ai") {
  if (!result.assessment_id) {
    toast({
      title: "Unable to open result",
      description: "Missing assessment reference for this row.",
      variant: "destructive",
      duration: 3000,
    });
    return;
  }
  if (result.candidate_ai_assessment_id) {
    navigate(`/admin/result/ai-assessment/${result.assessment_id}/report/${result.candidate_ai_assessment_id}`);
  } else {
    navigate(`/admin/results/ai-assessment/${result.assessment_id}`);
  }
} else {
      toast({
        title: "Info",
        description: "Detailed results are not available for this assessment type.",
        duration: 3000,
      });
    }
  };

  // Define columns for DynamicTable
  const columns: TableColumn<AssessmentCandidate>[] = [

    {
      name: 'Assessment Title',
      selector: (row: AssessmentCandidate) => row.assessment_title,
      sortable: true,
      grow: 2,
      cell: (row: AssessmentCandidate) => {
        const assessmentPath = row.assessment_type === "ai"
          ? `/admin/ai-assessment/${row.assessment_id}`
          : `/admin/assessment/${row.assessment_id}`;

        return (
          <div
            title="View Assessment"
            onClick={() => navigate(assessmentPath)}
            className="font-medium whitespace-normal break-words transition-colors duration-200 hover:text-brand-violet cursor-pointer"
          >
            {row.assessment_title}
          </div>
        );
      },
    },

    {
      name: 'Candidate',
      selector: (row: AssessmentCandidate) => row.candidate_name,
      sortable: true,
      cell: (row: AssessmentCandidate) => (
        <div
          className="text-xs hover:text-brand-violet cursor-pointer"
          onClick={() => navigate(`/admin/learner/${row.candidate_id}`)}
        >
          {row.candidate_name}
        </div>
      ),
    },
    {
      name: 'Email',
      selector: (row: AssessmentCandidate) => row.candidate_email,
      sortable: true,
      cell: (row: AssessmentCandidate) => (
        <div className="text-xs">{row.candidate_email}</div>
      ),
    },
    {
      name: (
        <ColumnHeader
          label="Type"
          hint="Regular = standard question-based assessment, scored on marks. AI Interview = AI-conducted interview, scored on responses."
        />
      ),
      selector: (row: AssessmentCandidate) => row.assessment_type,
      cell: (row: AssessmentCandidate) => (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${row.assessment_type === "ai"
          ? "bg-purple-100 text-purple-800"
          : "bg-blue-100 text-blue-800"
          }`}>
          {getTypeText(row.assessment_type)}
        </span>
      ),
    },
    {
      name: (
        <ColumnHeader
          label="Status"
          hint="Where the assignment is in its lifecycle: Assigned → In Progress → Completed. Expired means the candidate did not finish before the window closed."
        />
      ),
      selector: (row: AssessmentCandidate) => row.status,
      cell: (row: AssessmentCandidate) => (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${getStatusColor(row.status)}`}>
          {getStatusText(row.status)}
        </span>
      ),
    },
    {
      name: (
        <ColumnHeader
          label="Score"
          hint="Percentage of total marks the candidate earned. The coloured bar and label (Excellent ≥80% · Good ≥60% · Average ≥40% · Needs work <40%) show performance at a glance. The smaller line shows the raw marks, e.g. 9 / 10."
        />
      ),
      selector: (row: AssessmentCandidate) => parseScoreValue(row.score).percentage ?? -1,
      sortable: true,
      grow: 1.6,
      minWidth: "172px",
      cell: (row: AssessmentCandidate) => {
        const parsed = parseScoreValue(row.score);
        if (!parsed.hasValue) {
          return (
            <span
              title="Not graded yet — a score appears once the assessment is completed and evaluated."
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
            >
              Not graded
            </span>
          );
        }
        const band = getScoreBand(parsed.percentage);
        const pctText = parsed.percentage !== null ? `${Math.round(parsed.percentage)}%` : "—";
        const hasMarks = parsed.obtained !== null && parsed.total !== null;
        const marksText = hasMarks ? `${parsed.obtained} / ${parsed.total} marks` : "of total";
        const tooltip = hasMarks
          ? `Scored ${parsed.obtained} out of ${parsed.total} marks (${pctText}). Percentage = marks obtained ÷ total marks × 100.`
          : `Scored ${pctText} of the total marks available.`;
        return (
          <div title={tooltip} className="flex w-full flex-col gap-1 py-1">
            <div className="flex items-center gap-1.5">
              <span className={cn("text-sm font-bold tabular-nums", band.text)}>{pctText}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", band.pill)}>
                {band.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", band.bar)}
                  style={{ width: `${Math.min(100, Math.max(0, parsed.percentage ?? 0))}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-[10px] text-slate-400">{marksText}</span>
            </div>
          </div>
        );
      },
    },
    {
      name: 'Assigned Date',
      selector: (row: AssessmentCandidate) => row.assigned_date || '',
      sortable: true,
      grow: 1.2,
      cell: (row: AssessmentCandidate) => (
        <div className="text-xs whitespace-normal">
          {row.assigned_date
            ? new Date(row.assigned_date).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            : '-'}
        </div>
      ),
    },
    {
      name: 'Completed',
      selector: (row: AssessmentCandidate) => row.completed_date || '',
      sortable: true,
      grow: 1.2,
      cell: (row: AssessmentCandidate) => (
        <div className="text-xs whitespace-normal">
          {row.completed_date
            ? new Date(row.completed_date).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            : '-'}
        </div>
      ),
    },
    {
    name: 'Action',
    cell: (row: AssessmentCandidate) => (
      <div className="flex w-full items-center justify-center">
        <TableRowIconButton
          title={isResultViewable(row) ? "View result" : "View result (pending)"}
          onClick={() => handleViewDetails(row)}
        >
          <Eye className="h-4 w-4 text-gray-700" />
        </TableRowIconButton>
      </div>
    ),
    ignoreRowClick: true,
    center: true,
  },
  ];

  const showTableLoading = !hasFetchedInitialData || table.isLoading;

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px]">
        <PageHeader
          icon={Trophy}
          title="Results"
          description="View assessment outcomes, scores, and candidate performance."
          className="mb-4"
        />

        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard index={0} label="Total Assessments" value={totalAssessments} icon={FileText} gradient="from-brand-purple to-brand-violet" hint="Total number of assessment assignments across all candidates (each assigned attempt is counted once)." />
          <StatCard index={1} label="Total Candidates" value={totalCandidates} icon={Users} gradient="from-[#0955a7] to-[#2f9cd4]" hint="Number of distinct candidates who have been assigned at least one assessment." />
          <StatCard index={2} label="Completed Tests" value={totalCompleted} icon={CheckCircle} gradient="from-[#0e9f6e] to-[#23c366]" hint="Assessments that candidates have finished and submitted. The rest are still assigned, in progress, or expired." />
          <StatCard index={3} label="Average Score" value={Number(avgScore) || 0} suffix="%" icon={Trophy} gradient="from-[#c2790b] to-[#eab40b]" hint="Mean score across all completed assessments, shown as a percentage of total marks (0–100%). Not-yet-graded assessments are excluded." />
        </div>

        <div className="mb-4">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 shadow-inner">
            {[
              { key: "regular" as const, label: "Regular", icon: ClipboardList, count: null as number | null },
              { key: "ai" as const, label: "AI", icon: Sparkles, count: null as number | null },
              { key: "mock_interviews" as const, label: "Mock Interviews", icon: Video, count: mockSessions.length || null },
            ].map((tab) => {
              const active = resultTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setResultTab(tab.key)}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200",
                    active ? "text-brand-purple" : "text-slate-500 hover:text-brand-violet"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="resultTabIndicator"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-0 rounded-lg bg-white shadow-[0_2px_8px_-2px_rgba(61,7,95,0.25)] ring-1 ring-black/5"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <TabIcon className={cn("h-4 w-4", active ? "text-brand-violet" : "text-slate-400")} />
                    {tab.label}
                    {tab.count != null && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", active ? "bg-violet-100 text-brand-violet" : "bg-slate-200 text-slate-500")}>
                        {tab.count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Mock Interviews Tab */}
        {resultTab === "mock_interviews" && (
          <div>
            <ListPageToolbar
              className=""
              searchValue={mockSearch}
              onSearchChange={setMockSearch}
              searchPlaceholder="Search by name or email…"
              filterPanelOpen={mockFilterPanelOpen}
              onFilterPanelToggle={() => setMockFilterPanelOpen((o) => !o)}
              sortValue={mockSortMode}
              onSortChange={(v) => setMockSortMode(v as MockSortMode)}
              sortOptions={MOCK_SORT_OPTIONS}
              sortMenuLabel="Sort sessions"
              activeFilters={mockFilterChips}
              onClearAllFilters={clearMockFilters}
              filterPanel={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                    <Search className="h-3.5 w-3.5" />
                    Filters
                  </span>
                  <Dropdown
                    value={mockStatusFilter}
                    onChange={handleMockStatusChange}
                    options={[
                      { value: "all", label: "All Status" },
                      { value: "active", label: "Active" },
                      { value: "completed", label: "Completed" },
                    ] as DropdownOption<string>[]}
                    icon={CheckCircle}
                    className="w-[150px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                  <Dropdown
                    value={mockStackFilter}
                    onChange={handleMockStackChange}
                    options={[
                      { value: "all", label: "All Stacks" },
                      ...mockUniqueStacks.map((stack) => ({ value: stack, label: stack })),
                    ] as DropdownOption<string>[]}
                    icon={Layers}
                    className="w-[170px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                  <DateRangePicker
                    from={mockDateFrom}
                    to={mockDateTo}
                    onChange={(f, t) => {
                      handleMockDateFromChange(f);
                      handleMockDateToChange(t);
                    }}
                    placeholder="Date: any"
                    className="w-[200px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                </div>
              }
            />

            {/* Sessions Table */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
              <div className="hidden md:grid grid-cols-[2fr,2fr,1.5fr,1fr,1fr,0.8fr] border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700">
                <span>Candidate</span>
                <span>Email</span>
                <span>Stack</span>
                <span className="flex items-center justify-center">
                  <ColumnHeader
                    label="Avg. Rating"
                    hint="Average of the interviewer's per-question ratings for this session, on a 1–5 scale (5 = strongest). Only answered/rated questions are counted."
                  />
                </span>
                <span className="text-center">Date</span>
                <span className="text-right">Action</span>
              </div>

              {mockIsLoading && (
                <div className="py-8 text-center text-[11px] text-slate-500">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet" />
                  Loading mock sessions…
                </div>
              )}

              {!mockIsLoading && sortedMockSessions.length === 0 && (
                <div className="py-8 text-center text-[11px] text-slate-500">
                  <div className="flex flex-col items-center">
                    <Search className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium mb-1">No sessions found</p>
                    <p className="text-xs text-slate-400">
                      {isMockFilterApplied
                        ? "No sessions available for the selected filters. Try adjusting your filters or search query."
                        : "No mock interview sessions available yet."}
                    </p>
                    {isMockFilterApplied && (
                      <button
                        onClick={clearMockFilters}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ff5a1f]"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </div>
              )}

              {!mockIsLoading && sortedMockSessions.length > 0 && (
                <div className="divide-y">
                  {sortedMockSessions.map(s => {
                    const avg = getMockAvgScore(s.responses || {});
                    const avgNum = avg === "—" ? null : parseFloat(avg);
                    const ratedCount = Object.values(s.responses || {}).filter((v) => (v?.rating ?? 0) > 0).length;
                    const ratingBand = getRatingBand(avgNum);
                    const ratingTooltip =
                      avgNum !== null
                        ? `Average interviewer rating of ${avg} out of 5 across ${ratedCount} rated ${ratedCount === 1 ? "question" : "questions"}. Higher is better (5 = strongest).`
                        : "Not rated yet — this session has no interviewer ratings recorded.";
                    return (
                      <div
                        key={`mock-${s.id}`}
                        className="grid grid-cols-1 items-center border-b border-slate-100 px-4 py-2 text-[13px] text-gray-900 transition-colors hover:bg-violet-50/40 md:grid-cols-[2fr,2fr,1.5fr,1fr,1fr,0.8fr]"
                      >
                        <div className="font-medium truncate">{s.display_name || s.stack}</div>
                        <div className="text-slate-500 truncate">{s.display_email || "—"}</div>
                        <div className="text-slate-700">{s.stack}</div>
                        <div title={ratingTooltip} className="flex flex-col items-start justify-center gap-0.5 md:items-center">
                          {avgNum !== null ? (
                            <>
                              <div className={cn("flex items-center gap-1 text-sm font-bold tabular-nums", ratingBand.text)}>
                                <Star className="h-3.5 w-3.5 fill-current" />
                                {avg}
                                <span className="text-[11px] font-medium text-slate-400">/ 5</span>
                              </div>
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", ratingBand.pill)}>
                                {ratingBand.label}
                              </span>
                            </>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                              Not rated
                            </span>
                          )}
                        </div>
                        <div className="md:text-center text-slate-500">
                          {s.created_at
                            ? new Date(s.created_at * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            : "—"}
                        </div>
                        <div className="flex justify-end md:text-right">
                          <TableRowIconButton
                            title="View session"
                            onClick={() => navigate(`/admin/mock-interview/session/${s.id}`)}
                          >
                            <Eye className="h-4 w-4 text-gray-700" />
                          </TableRowIconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Regular / AI Tab */}
        {(resultTab === "regular" || resultTab === "ai") && (
          <>
            <ListPageToolbar
              className=""
              searchValue={table.searchQuery}
              onSearchChange={handleSearchChange}
              searchPlaceholder="Search by name or email…"
              filterPanelOpen={filterPanelOpen}
              onFilterPanelToggle={() => setFilterPanelOpen((o) => !o)}
              sortValue={resultSortMode}
              onSortChange={(v) => setResultSortMode(v as ResultSortMode)}
              sortOptions={RESULT_SORT_OPTIONS}
              sortMenuLabel="Sort results"
              moreMenuItems={
                resultTab === "regular" ? (
                  <DropdownMenuItem onClick={handlePrintReport}>
                    <Printer className="h-4 w-4" />
                    Print report
                  </DropdownMenuItem>
                ) : undefined
              }
              activeFilters={resultFilterChips}
              onClearAllFilters={clearFilters}
              filterPanel={
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                    <Search className="h-3.5 w-3.5" />
                    Filters
                  </span>
                  <Dropdown
                    value={statusFilter}
                    onChange={handleStatusChange}
                    options={statusOptions as DropdownOption<string>[]}
                    icon={CheckCircle}
                    className="w-[160px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                  <DateRangePicker
                    from={fromDate}
                    to={toDate}
                    onChange={(f, t) => {
                      handleFromDateChange(f);
                      handleToDateChange(t);
                    }}
                    placeholder="Assigned date: any"
                    className="w-[200px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                </div>
              }
            />

            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)] print-content">
              <DynamicTable
                className="rounded-none border-0 shadow-none"
                customTableStyles={listPageTableStyles}
                data={sortedResults}
                columns={columns}
                pagination={table.pagination}
                rowsPerPage={ITEMS_PER_PAGE}
                isLoading={showTableLoading}
                onPageChange={(page) => fetchResults(page)}
                itemLabel="results"
                loadingMessage="Loading results..."
                noDataMessage="No assessment results found"
                noDataSubMessage={
                  isFilterApplied
                    ? "No data available for the selected filters. Try adjusting your filters or search query."
                    : "No assessment data available yet. Start by assigning assessments to candidates."
                }
                isFilterApplied={!!isFilterApplied}
                onClearFilters={clearFilters}
              />
            </div>
          </>
        )}
        </div>
      </div>
    </AdminLayout>
  );
};
