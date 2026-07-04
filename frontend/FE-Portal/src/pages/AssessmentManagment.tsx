import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation, useNavigationType } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import {
  Cpu,
  Edit,
  Plus,
  Trash2, BarChart,
  CalendarDays,
  Search,
  Clock,
  Users,
  CheckCircle2,
  FileText,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useGetCategoriesQuery,
  useLazyGetAssessmentsQuery,
  useLazyGetAiAssessmentsQuery,
  useBulkDeleteAssessmentsMutation,
  useBulkDeleteAiAssessmentsMutation,
} from "@/store";
import { DynamicTable, TableColumn } from "@/components/DynamicTable";
import type { PaginationState as DynamicTablePaginationState } from "@/components/DynamicTable";
import { PageHeader } from "@/components/common/PageHeader";
import { ActiveFilterChip } from "@/components/common/SearchFilterPanel";
import { ListPageToolbar, SortOption } from "@/components/common/ListPageToolbar";
import { TableRowActions } from "@/components/common/TableRowActions";
import { listPageTableStyles } from "@/utils/listPageTableStyles";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokenStorage } from "@/lib/tokenStorage";

/** One-click action icon button with a tooltip. */
function ActionIconBtn({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5",
            className
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  manager: { label: "Manager", cls: "bg-violet-50 text-brand-violet ring-violet-100" },
  org_admin: { label: "Org Admin", cls: "bg-sky-50 text-sky-700 ring-sky-100" },
  super_admin: { label: "Super Admin", cls: "bg-amber-50 text-amber-700 ring-amber-100" },
};

/** "Created by" cell: creator name + a small role badge. */
function CreatedByCell({ name, role }: { name?: string; role?: string }) {
  if (!name) return <span className="text-[11px] italic text-slate-300">—</span>;
  const badge = role ? ROLE_BADGE[role] : undefined;
  return (
    <div className="min-w-0 py-1">
      <div className="truncate text-[12px] font-medium text-slate-700" title={name}>
        {name}
      </div>
      {badge && (
        <span className={cn("mt-0.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", badge.cls)}>
          {badge.label}
        </span>
      )}
    </div>
  );
}

/** Smart status badge for assessments. */
const ASSESS_STATUS: Record<string, { label: string; cls: string; dot: string; hint: string; pulse?: boolean }> = {
  Active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", hint: "Live now — candidates can take it.", pulse: true },
  Upcoming: { label: "Upcoming", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", hint: "Scheduled to start later." },
  Completed: { label: "Completed", cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", hint: "The assessment window has ended." },
};

function AssessStatusBadge({ status }: { status: string }) {
  const m = ASSESS_STATUS[status] || ASSESS_STATUS.Active;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", m.cls)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", m.dot, m.pulse && "animate-pulse")} />
          {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{m.hint}</TooltipContent>
    </Tooltip>
  );
}

/** Candidate completion progress with a breakdown tooltip. */
function CandidatesCell({
  total,
  completed,
  inProgress,
  notStarted,
}: {
  total?: number;
  completed?: number;
  inProgress?: number;
  notStarted?: number;
}) {
  const t = total || 0;
  const d = completed || 0;
  const ip = inProgress || 0;
  const ns = notStarted ?? Math.max(0, t - d - ip);
  if (!t) return <span className="text-xs text-slate-400">No candidates</span>;
  const pct = Math.round((d / t) * 100);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="w-full max-w-[160px]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
              <Users className="h-3 w-3 text-slate-400" />
              {d}/{t} done
            </span>
            <span className="text-[11px] font-bold text-slate-700">{pct}%</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-emerald-500" style={{ width: `${(d / t) * 100}%` }} />
            <div className="h-full bg-sky-400" style={{ width: `${(ip / t) * 100}%` }} />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5 text-xs">
          <div>{t} assigned</div>
          <div className="text-emerald-600">✓ {d} completed</div>
          <div className="text-sky-600">◐ {ip} in progress</div>
          <div className="text-slate-500">○ {ns} not started</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Relative schedule/window summary based on status + raw dates. */
function assessScheduleInfo(start?: string, end?: string, status?: string): { text: string; cls: string } {
  const now = Date.now();
  const day = 86_400_000;
  const s = start ? new Date(start).getTime() : NaN;
  const e = end ? new Date(end).getTime() : NaN;
  if (status === "Upcoming" && !isNaN(s)) {
    const days = Math.ceil((s - now) / day);
    return { text: days <= 0 ? "Starting soon" : `Starts in ${days}d`, cls: "font-medium text-amber-600" };
  }
  if (status === "Completed" && !isNaN(e)) {
    const days = Math.floor((now - e) / day);
    return { text: days <= 0 ? "Ended today" : `Ended ${days}d ago`, cls: "text-slate-500" };
  }
  if (!isNaN(e)) {
    const days = Math.ceil((e - now) / day);
    if (days < 0) return { text: "Window ended", cls: "text-slate-500" };
    if (days === 0) return { text: "Ends today", cls: "font-semibold text-red-600" };
    return { text: `Ends in ${days}d`, cls: days <= 2 ? "font-medium text-red-600" : "font-medium text-emerald-600" };
  }
  return { text: "—", cls: "text-slate-400" };
}

interface Assessment {
  id: number;
  title: string;
  categories: number[];
  duration: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  question_ids: number[];
  description?: string;
  status: "active" | "completed" | "upcoming";
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  instructions?: string;
  total_candidates?: number;
  completed_count?: number;
  in_progress_count?: number;
  not_started_count?: number;
  question_count?: number;
  category_names?: string[];
  created_by_name?: string;
  created_by_role?: string;
}

interface AiAssessment {
  id: number;
  created_by_username: string;
  title: string;
  description: string;
  role_type: string;
  experience_level: string;
  start_date: string;
  end_date: string;
  instructions: string;
  num_questions: number;
  num_hardcoded_questions: number;
  gemini_api_key: string;
  enable_voice_recording: boolean;
  enable_camera: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  status: "active" | "completed" | "upcoming";
  role_type_display: string;
  experience_level_display: string;
  assigned_candidates_count: number;
  completed_candidates_count: number;
  total_candidates?: number;
  completed_count?: number;
  in_progress_count?: number;
  not_started_count?: number;
  created_by_name?: string;
  created_by_role?: string;
}

interface Category {
  id: number;
  name: string;
}

interface TransformedAssessment {
  id: string;
  title: string;
  categories: string[];
  duration: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Upcoming";
  questions: string;
  level: number;
  isActive: boolean;
  rawData: Assessment;
  totalCandidates?: number;
  completedCount?: number;
  inProgressCount?: number;
  notStartedCount?: number;
}

interface TransformedAiAssessment {
  id: string;
  title: string;
  roleType: string;
  experienceLevel: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Completed" | "Upcoming";
  questions: string;
  totalQuestions: number;
  hardcodedQuestions: number;
  aiQuestions: number;
  totalCandidates: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  enableVoiceRecording: boolean;
  enableCamera: boolean;
  isActive: boolean;
  rawData: AiAssessment;
}

interface ApiResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Assessment[];
  status?: string | null;
  ai_assessments?: AiAssessment[];
}

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  nextPageUrl: string | null;
  prevPageUrl: string | null;
}

type AssessmentType = "regular" | "ai";

// Constants
const ROWS_PER_PAGE = 20;
const DEBOUNCE_DELAY = 500;
const STATUS_MAP: Record<string, "Active" | "Completed" | "Upcoming"> = {
  "active": "Active",
  "completed": "Completed",
  "upcoming": "Upcoming"
};

// Date validator function
const isValidDate = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

type AssessmentSortMode = "default" | "title_asc" | "title_desc" | "start_desc" | "start_asc";

const ASSESSMENT_SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Default order" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "start_desc", label: "Start date (newest first)" },
  { value: "start_asc", label: "Start date (oldest first)" },
];

export const AssessmentManagement: React.FC = () => {
  // State variables
  const navType = useNavigationType();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialStatus = searchParams.get("status") || "all";
  const [statusFilter, setStatusFilter] = useState(() => navType === "POP" ? (sessionStorage.getItem("assess_status") || initialStatus) : initialStatus);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>(() => {
    if (location.state?.AssessmentType) {
      return location.state.AssessmentType as AssessmentType;
    }
    if (navType !== "POP") return "regular";
    return (sessionStorage.getItem("assess_tab") as AssessmentType) || "regular";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => navType === "POP" ? (sessionStorage.getItem("assess_search") || "") : "");
  const [dateFrom, setDateFrom] = useState(() => navType === "POP" ? (sessionStorage.getItem("assess_date_from") || "") : "");
  const [dateTo, setDateTo] = useState(() => navType === "POP" ? (sessionStorage.getItem("assess_date_to") || "") : "");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<AssessmentSortMode>("default");

  // RTK Query hooks
  // const { data: categoriesData, isSuccess: categoriesLoaded } = useGetCategoriesQuery();
  const [getAssessments] = useLazyGetAssessmentsQuery();
  const [getAiAssessments] = useLazyGetAiAssessmentsQuery();
  const [bulkDeleteAssessments] = useBulkDeleteAssessmentsMutation();
  const [bulkDeleteAiAssessments] = useBulkDeleteAiAssessmentsMutation();


  // Data states
  const [assessments, setAssessments] = useState<TransformedAssessment[]>([]);
  const [aiAssessments, setAiAssessments] = useState<TransformedAiAssessment[]>([]);

  // Pagination states
  const [regularPagination, setRegularPagination] = useState<PaginationState>({
    currentPage: navType === "POP" ? parseInt(sessionStorage.getItem("assess_reg_page") || "1", 10) : 1,
    totalPages: 1, totalCount: 0, nextPageUrl: null, prevPageUrl: null,
  });

  const [aiPagination, setAiPagination] = useState<PaginationState>({
    currentPage: navType === "POP" ? parseInt(sessionStorage.getItem("assess_ai_page") || "1", 10) : 1,
    totalPages: 1, totalCount: 0, nextPageUrl: null, prevPageUrl: null,
  });

  // Selection states
  const [selectedRows, setSelectedRows] = useState<(TransformedAssessment | TransformedAiAssessment)[]>([]);
  const [toggleCleared, setToggleCleared] = useState(false);

  // Refs
  const searchTimeoutRef = useRef<number | null>(null);
  const isInitialLoad = useRef(true);
  const navigate = useNavigate();
  // Org admins / super admins see who created each assessment; a manager only
  // ever sees their own, so the column is redundant for them.
  const currentRole = tokenStorage.getUser<{ role?: string }>()?.role;
  const canSeeCreator = currentRole === "org_admin" || currentRole === "super_admin";
  const isFirstRenderFilters = useRef(true);
  const isFirstRenderSearch = useRef(true);
  const isFirstRenderDate = useRef(true);

  // Set initial assessmentType based on navigation state (only on mount)
  useEffect(() => {
    if (location.state?.AssessmentType && location.state.AssessmentType !== assessmentType) {
      setAssessmentType(location.state.AssessmentType);
    }
  }, []);
  // Memoized values
  const currentPagination = useMemo(() =>
    assessmentType === "regular" ? regularPagination : aiPagination,
    [assessmentType, regularPagination, aiPagination]
  );

  const currentData = useMemo(() =>
    assessmentType === "regular" ? assessments : aiAssessments,
    [assessmentType, assessments, aiAssessments]
  );

  const sortedData = useMemo(() => {
    const list = [...currentData];
    const getStart = (row: TransformedAssessment | TransformedAiAssessment) =>
      new Date(row.startDate).getTime() || 0;

    switch (sortMode) {
      case "title_asc":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "title_desc":
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case "start_desc":
        return list.sort((a, b) => getStart(b) - getStart(a));
      case "start_asc":
        return list.sort((a, b) => getStart(a) - getStart(b));
      default:
        return list;
    }
  }, [currentData, sortMode]);

  // Helper functions
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "Active": return "bg-blue-100 text-blue-800";
      case "Completed": return "bg-green-200 text-green-800";
      case "Upcoming": return "bg-yellow-100 text-yellow-800";
      default: return "bg-slate-100 text-slate-700";
    }
  }, []);

  const getCategoryColor = useCallback((category: string) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-purple-100 text-purple-800",
      "bg-green-100 text-green-800",
      "bg-red-100 text-red-800",
      "bg-yellow-100 text-yellow-800",
      "bg-indigo-100 text-indigo-800",
      "bg-pink-100 text-pink-800",
      "bg-teal-100 text-teal-800",
    ];
    const hash = category.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

  const formatDateForDisplay = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).replace(',', '');
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return dateString;
    }
  }, []);

  // Data transformation functions
  const transformAssessment = useCallback((assessment: Assessment): TransformedAssessment => {
    const uiStatus = STATUS_MAP[assessment.status.toLowerCase()] || "Active";

    const categoryNames = assessment.category_names || [];

    return {
      id: assessment.id.toString(),
      title: assessment.title,
      categories: assessment.category_names || [],
      duration: `${assessment.duration} mins`,
      startDate: formatDateForDisplay(assessment.start_date),
      endDate: formatDateForDisplay(assessment.end_date),
      status: uiStatus,
      questions: assessment.question_count
        ? `${assessment.question_count}`
        : assessment.question_ids?.length > 0
          ? `${assessment.question_ids.length}`
          : "0",
      level: 1,
      isActive: assessment.is_active,
      rawData: assessment,
      totalCandidates: assessment.total_candidates,
      completedCount: assessment.completed_count,
      inProgressCount: assessment.in_progress_count,
      notStartedCount: assessment.not_started_count
    };
  }, [formatDateForDisplay]);

  const transformAiAssessment = useCallback((assessment: AiAssessment): TransformedAiAssessment => {
    // Derive status if backend doesn't provide one
    let rawStatus = (assessment as any).status as string | undefined;
    if (!rawStatus) {
      try {
        const now = new Date();
        const start = new Date(assessment.start_date);
        const end = new Date(assessment.end_date);
        if (now < start) rawStatus = "upcoming";
        else if (now > end) rawStatus = "completed";
        else rawStatus = "active";
      } catch {
        rawStatus = "active";
      }
    }

    const uiStatus = STATUS_MAP[rawStatus.toLowerCase()] || "Active";
    const aiQuestions = (assessment.num_questions || 0) - (assessment.num_hardcoded_questions || 0);

    // Fallback display labels if *_display fields are missing
    const roleTypeDisplay =
      (assessment as any).role_type_display ||
      (assessment.role_type || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const experienceLevelDisplay =
      (assessment as any).experience_level_display ||
      (assessment.experience_level || "")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      id: assessment.id.toString(),
      title: assessment.title,
      roleType: roleTypeDisplay,
      experienceLevel: experienceLevelDisplay,
      startDate: formatDateForDisplay(assessment.start_date),
      endDate: formatDateForDisplay(assessment.end_date),
      status: uiStatus,
      questions: `${assessment.num_questions}`,
      totalQuestions: assessment.num_questions,
      hardcodedQuestions: assessment.num_hardcoded_questions,
      aiQuestions: aiQuestions > 0 ? aiQuestions : 0,
      totalCandidates: (assessment as any).assigned_candidates_count ?? (assessment as any).total_candidates ?? 0,
      completedCount: (assessment as any).completed_candidates_count ?? (assessment as any).completed_count ?? 0,
      inProgressCount: (assessment as any).in_progress_count ?? 0,
      notStartedCount: (assessment as any).not_started_count ?? 0,
      enableVoiceRecording: assessment.enable_voice_recording,
      enableCamera: assessment.enable_camera,
      isActive: assessment.is_active,
      rawData: assessment
    };
  }, [formatDateForDisplay]);

  // Build endpoint URLs
  const buildRegularEndpoint = useCallback((page: number) => {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: ROWS_PER_PAGE.toString(),
    });

    if (searchQuery.trim()) {
      params.append("search", searchQuery.trim());
    }

    if (statusFilter !== "all") {
      params.append("status", statusFilter);
    }

    // FIXED: Filter by START DATE only for regular assessments
    if (dateFrom && isValidDate(dateFrom)) {
      params.append("start_date_after", dateFrom);
    }
    if (dateTo && isValidDate(dateTo)) {
      params.append("start_date_before", dateTo);
    }

    return `/my-admin/assessments/?${params.toString()}`;
  }, [searchQuery, statusFilter, dateFrom, dateTo]);

  const buildAiEndpoint = useCallback(() => {
    // We paginate AI assessments locally in the UI, so always fetch page 1
    // with a larger page size to avoid backend "invalid page" 404s.
    const params = new URLSearchParams({
      page: "1",
      page_size: "1000",
    });
    return `/my-admin/ai-assessments/?${params.toString()}`;
  }, []);

  // Main data fetch function
  const fetchData = useCallback(async (pageNum: number, forceRefresh = false) => {
    // Prevent duplicate calls
    if (isLoading && !forceRefresh) return;

    setIsLoading(true);
    try {
      if (assessmentType === "regular") {
        await fetchRegularAssessments(pageNum);
      } else {
        await fetchAiAssessments(pageNum);
      }
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      toast({
        title: "Failed",
        description: `Failed to fetch ${assessmentType === "regular" ? "assessments" : "AI assessments"}`,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
      setHasFetchedInitialData(true);
    }
  }, [assessmentType, searchQuery, statusFilter, dateFrom, dateTo]);

  const showTableLoading = !hasFetchedInitialData || isLoading;

  // Regular assessments fetch logic
  const fetchRegularAssessments = useCallback(async (pageNum: number) => {
    const endpoint = buildRegularEndpoint(pageNum);
    const data = await getAssessments(endpoint, true).unwrap();

    const transformed = data.results.map((a: Assessment) => transformAssessment(a));
    setAssessments(transformed);
    const totalCount = data.count;
    const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);

    setRegularPagination({
      currentPage: pageNum,
      totalPages,
      totalCount,
      nextPageUrl: data.next,
      prevPageUrl: data.previous
    });
  }, [buildRegularEndpoint, transformAssessment, getAssessments]);

  // AI assessments fetch logic
  const fetchAiAssessments = useCallback(async (pageNum: number) => {
    const endpoint = buildAiEndpoint();
    const raw: any = await getAiAssessments(endpoint, true).unwrap();

    // Try to be defensive about the API shape:
    // - standard paginated: { count, results: [...] }
    // - combined: { ai_assessments: [...] }
    // - bare array: [...]
    // - wrapped: { data: { ...same as above } }
    let list: AiAssessment[] = [];

    const extractList = (src: any): AiAssessment[] | null => {
      if (!src) return null;
      if (Array.isArray(src)) return src as AiAssessment[];
      if (Array.isArray(src.results)) return src.results as AiAssessment[];
      if (Array.isArray(src.ai_assessments)) return src.ai_assessments as AiAssessment[];
      return null;
    };
    list = extractList(raw) || extractList(raw.results?.data) || [];
    let transformed = list.map(transformAiAssessment);

    // Filter locally for AI assessments
    if (statusFilter !== "all") {
      transformed = transformed.filter(a =>
        a.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      transformed = transformed.filter((assessment: TransformedAiAssessment) =>
        assessment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assessment.roleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        assessment.experienceLevel.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // FIXED: Apply date filtering by START DATE only for AI assessments
    if (dateFrom && isValidDate(dateFrom)) {
      const fromDate = new Date(dateFrom + "T00:00:00");
      transformed = transformed.filter((assessment: TransformedAiAssessment) => {
        const assessmentStart = new Date(assessment.rawData.start_date);
        return assessmentStart >= fromDate;
      });
    }

    if (dateTo && isValidDate(dateTo)) {
      const toDate = new Date(dateTo + "T23:59:59");
      transformed = transformed.filter((assessment: TransformedAiAssessment) => {
        const assessmentStart = new Date(assessment.rawData.start_date);
        return assessmentStart <= toDate;
      });
    }

    // Apply pagination
    const totalCount = transformed.length;
    const totalPages = Math.ceil(totalCount / ROWS_PER_PAGE);
    const startIndex = (pageNum - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const paginatedAiAssessments = transformed.slice(startIndex, endIndex);

    setAiAssessments(paginatedAiAssessments);

    setAiPagination({
      currentPage: pageNum,
      totalPages,
      totalCount,
      nextPageUrl: null,
      prevPageUrl: null
    });
  }, [buildAiEndpoint, transformAiAssessment, searchQuery, statusFilter, dateFrom, dateTo, getAiAssessments]);

  // Initial data load effect
  // --- 1. NAYA CODE: Auto Save States ---
  useEffect(() => {
    sessionStorage.setItem("assess_tab", assessmentType);
    sessionStorage.setItem("assess_search", searchQuery);
    sessionStorage.setItem("assess_status", statusFilter);
    sessionStorage.setItem("assess_date_from", dateFrom);
    sessionStorage.setItem("assess_date_to", dateTo);
    sessionStorage.setItem("assess_reg_page", regularPagination.currentPage.toString());
    sessionStorage.setItem("assess_ai_page", aiPagination.currentPage.toString());
  }, [assessmentType, searchQuery, statusFilter, dateFrom, dateTo, regularPagination.currentPage, aiPagination.currentPage]);

  // --- 2. UPDATE: Initial data load effect ---
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      // Pehli baar me stored page use karein (1 nahi)
      const initialPage = assessmentType === "regular" ? regularPagination.currentPage : aiPagination.currentPage;
      fetchData(initialPage);
    }
  }, [fetchData, assessmentType, regularPagination.currentPage, aiPagination.currentPage]);


  // --- 3. UPDATE: Debounced search effect ---
  useEffect(() => {
    // if (!categoriesLoaded) return;

    // Naya logic: Load hote hi search effect run hokar page 1 na kare
    if (isFirstRenderSearch.current) {
      isFirstRenderSearch.current = false;
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSelectedRows([]);
      if (assessmentType === "regular") {
        setRegularPagination(prev => ({ ...prev, currentPage: 1 }));
        fetchData(1);
      } else {
        setAiPagination(prev => ({ ...prev, currentPage: 1 }));
        fetchData(1);
      }
    }, DEBOUNCE_DELAY);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchData, assessmentType]);

  // --- 4. UPDATE: Effect for status filter changes ---
  useEffect(() => {
    // if (!categoriesLoaded) return;

    // Naya logic: Load hote hi filter effect run hokar page 1 na kare
    if (isFirstRenderFilters.current) {
      isFirstRenderFilters.current = false;
      return;
    }

    setSelectedRows([]);
    if (assessmentType === "regular") {
      setRegularPagination(prev => ({ ...prev, currentPage: 1 }));
      fetchData(1);
    } else {
      setAiPagination(prev => ({ ...prev, currentPage: 1 }));
      fetchData(1);
    }
  }, [statusFilter, fetchData, assessmentType]);

  // Date filter change effect
  useEffect(() => {
    if (isFirstRenderDate.current) {
      isFirstRenderDate.current = false;
      return;
    }

    setSelectedRows([]);
    if (assessmentType === "regular") {
      setRegularPagination(prev => ({ ...prev, currentPage: 1 }));
      fetchData(1);
    } else {
      setAiPagination(prev => ({ ...prev, currentPage: 1 }));
      fetchData(1);
    }
  }, [dateFrom, dateTo, fetchData, assessmentType]);

  // Bulk delete handlers
  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedRows.length} ${assessmentType === "regular" ? "assessment(s)" : "AI assessment(s)"}?`
    );
    if (!confirmDelete) return;

    try {
      const assessmentIds = selectedRows.map(row => parseInt(row.id));
      if (assessmentType === "regular") {
        // Bulk delete regular assessments
        await bulkDeleteAssessments(assessmentIds).unwrap();
      } else {
        // Bulk delete AI assessments
        await bulkDeleteAiAssessments(assessmentIds).unwrap();
      }

      toast({
        title: "Success!",
        description: `Successfully deleted ${selectedRows.length} ${assessmentType === "regular" ? "assessment(s)" : "AI assessment(s)"}.`,
        variant: "success",
        duration: 3000,
      });

      // Clear selection and refresh data
      setToggleCleared(!toggleCleared);
      fetchData(currentPagination.currentPage, true);

    } catch (error: any) {
      console.error("Failed to delete assessments:", error);

      let errorMessage = "Failed to delete assessments. Please try again.";

      if (error.status) {
        if (error.status === 400) {
          errorMessage = "Invalid request. Please check the selected assessments.";
        } else if (error.status === 404) {
          errorMessage = "Bulk delete endpoint not found.";
        }

        if (error.data) {
          if (typeof error.data === 'string') {
            errorMessage = error.data;
          } else if (error.data.detail) {
            errorMessage = error.data.detail;
          } else if (error.data.assessment_ids) {
            errorMessage = Array.isArray(error.data.assessment_ids)
              ? error.data.assessment_ids[0]
              : error.data.assessment_ids;
          }
        }
      }

      toast({
        title: "Delete Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [selectedRows, assessmentType, currentPagination.currentPage, fetchData, toggleCleared, bulkDeleteAssessments, bulkDeleteAiAssessments]);

  const handleAssessmentTypeChange = (type: AssessmentType) => {
    if (type === assessmentType) return;

    setAssessmentType(type);
    sessionStorage.setItem("activeAssessmentTab", type);
    setStatusFilter("all");
    setSearchQuery("");
    setSelectedRows([]);
    setToggleCleared(!toggleCleared);

    // Reset pagination for both types
    if (type === "regular") {
      setRegularPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        nextPageUrl: null,
        prevPageUrl: null
      });
    } else {
      setAiPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        nextPageUrl: null,
        prevPageUrl: null
      });
    }

  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    // Don't fetch here - the useEffect will handle it
  };

  const handleDateFromChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setDateFrom(value);
    setSelectedRows([]);
    setToggleCleared(!toggleCleared);
  };

  const handleDateToChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setDateTo(value);
    setSelectedRows([]);
    setToggleCleared(!toggleCleared);
  };

  const handlePageChange = (pageNum: number) => {
    if (!isLoading) {
      fetchData(pageNum);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSelectedRows([]);
    setToggleCleared(!toggleCleared);
    sessionStorage.removeItem("assess_tab");
    sessionStorage.removeItem("assess_search");
    sessionStorage.removeItem("assess_status");
    sessionStorage.removeItem("assess_date_from");
    sessionStorage.removeItem("assess_date_to");
    sessionStorage.removeItem("assess_reg_page");
    sessionStorage.removeItem("assess_ai_page");
  };

  // Check if any filter is active
  const isFilterApplied = !!(searchQuery.trim() || statusFilter !== "all" || dateFrom || dateTo);
  const assessmentFilterChips: ActiveFilterChip[] = [
    ...(searchQuery.trim()
      ? [{
        id: "search",
        label: "Search",
        value: searchQuery,
        onRemove: () => setSearchQuery(""),
        tone: "blue" as const,
        quoteValue: true,
      }]
      : []),
    ...(statusFilter !== "all"
      ? [{
        id: "status",
        label: "Status",
        value: statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1),
        onRemove: () => setStatusFilter("all"),
        tone: "green" as const,
      }]
      : []),
    ...(dateFrom
      ? [{
        id: "dateFrom",
        label: "Start From",
        value: new Date(dateFrom + "T00:00:00").toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        onRemove: () => setDateFrom(""),
        tone: "amber" as const,
      }]
      : []),
    ...(dateTo
      ? [{
        id: "dateTo",
        label: "Start To",
        value: new Date(dateTo + "T00:00:00").toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        onRemove: () => setDateTo(""),
        tone: "amber" as const,
      }]
      : []),
  ];

  // Table columns for regular assessments
  const regularColumns: TableColumn<TransformedAssessment>[] = useMemo(() => [
    {
      name: 'Assessment',
      selector: (row: TransformedAssessment) => row.title,
      sortable: true,
      wrap: true,
      grow: 2,
      minWidth: '220px',
      cell: (row: TransformedAssessment) => {
        const categories = row.categories || [];
        return (
          <div className="min-w-0 py-1">
            <button
              onClick={() => navigate(`/admin/assessment/${row.id}`)}
              className="block w-full truncate text-left text-[13px] font-semibold text-slate-800 transition-colors hover:text-brand-violet"
              title={row.title}
            >
              {row.title}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {categories.length === 0 ? (
                <span className="text-[11px] italic text-slate-300">No category</span>
              ) : (
                <>
                  <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getCategoryColor(categories[0])}`}>
                    {categories[0]}
                  </span>
                  {categories.length > 1 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          +{categories.length - 1}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{categories.join(", ")}</TooltipContent>
                    </Tooltip>
                  )}
                </>
              )}
            </div>
          </div>
        );
      },
    },
    ...(canSeeCreator ? [{
      name: 'Created by',
      sortable: true,
      minWidth: '150px',
      selector: (row: TransformedAssessment) => row.rawData?.created_by_name || '',
      cell: (row: TransformedAssessment) => (
        <CreatedByCell name={row.rawData?.created_by_name} role={row.rawData?.created_by_role} />
      ),
    } as TableColumn<TransformedAssessment>] : []),
    {
      name: 'Status',
      selector: (row: TransformedAssessment) => row.status,
      sortable: true,
      minWidth: '120px',
      cell: (row) => <AssessStatusBadge status={row.status} />,
    },
    {
      name: 'Candidates',
      selector: (row: TransformedAssessment) => row.totalCandidates ?? 0,
      sortable: true,
      minWidth: '170px',
      cell: (row: TransformedAssessment) => (
        <CandidatesCell
          total={row.totalCandidates}
          completed={row.completedCount}
          inProgress={row.inProgressCount}
          notStarted={row.notStartedCount}
        />
      ),
    },
    {
      name: 'Questions',
      selector: (row: TransformedAssessment) => Number(row.questions) || 0,
      sortable: true,
      center: true,
      width: '110px',
      cell: (row: TransformedAssessment) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-bold text-brand-violet ring-1 ring-inset ring-violet-100">
          <FileText className="h-3.5 w-3.5" />
          {row.questions}
        </span>
      ),
    },
    {
      name: 'Duration',
      selector: (row: TransformedAssessment) => row.duration,
      sortable: true,
      width: '110px',
      cell: (row: TransformedAssessment) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          {row.duration}
        </span>
      ),
    },
    {
      name: 'Schedule',
      selector: (row: TransformedAssessment) => row.rawData?.start_date || '',
      sortable: true,
      minWidth: '130px',
      cell: (row: TransformedAssessment) => {
        const info = assessScheduleInfo(row.rawData?.start_date, row.rawData?.end_date, row.status);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-center gap-1.5 text-xs", info.cls)}>
                <CalendarDays className="h-3.5 w-3.5 opacity-70" />
                {info.text}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-0.5 text-xs">
                <div>Starts: {row.startDate}</div>
                <div>Ends: {row.endDate}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      name: 'Actions',
      cell: (row: TransformedAssessment) => (
        <div className="flex items-center justify-center gap-1">
          <ActionIconBtn
            label="Edit assessment"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/assessment/${row.id}/edit`); }}
            className="hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
          >
            <Edit className="h-4 w-4" />
          </ActionIconBtn>

          <ActionIconBtn
            label="View results"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/results/assessment-summary/${row.id}`); }}
            className="hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
          >
            <BarChart className="h-4 w-4" />
          </ActionIconBtn>

          <ActionIconBtn
            label={
              row.rawData?.status === "completed"
                ? "Cannot manage candidates on a completed assessment"
                : "Add / remove candidates"
            }
            onClick={(e) => {
              e.stopPropagation();

              if (row.rawData?.status === "completed") {
                return;
              }

              // Manage candidates inside the edit wizard's last step, where
              // admins can add or remove assignees.
              navigate(`/admin/assessment/${row.id}/edit?step=candidates`);
            }}
            className={
              row.rawData?.status === "completed"
                ? "cursor-not-allowed opacity-50"
                : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            }
          >
            <Users className="h-4 w-4" />
          </ActionIconBtn>

        </div>
      ),
      ignoreRowClick: true,
      minWidth: '140px',
      maxWidth: '160px',
      center: true,
    },
  ], [navigate, getCategoryColor, getStatusColor, canSeeCreator]);

  // Table columns for AI assessments
  const aiColumns: TableColumn<TransformedAiAssessment>[] = useMemo(() => [
    {
      name: 'Assessment',
      selector: (row: TransformedAiAssessment) => row.title,
      sortable: true,
      wrap: true,
      grow: 2,
      minWidth: '220px',
      cell: (row: TransformedAiAssessment) => (
        <div className="min-w-0 py-1">
          <button
            onClick={() => navigate(`/admin/ai-assessment/${row.id}`)}
            className="block w-full truncate text-left text-[13px] font-semibold text-slate-800 transition-colors hover:text-brand-violet"
            title={row.title}
          >
            {row.title}
          </button>
        </div>
      ),
    },
    ...(canSeeCreator ? [{
      name: 'Created by',
      sortable: true,
      minWidth: '150px',
      selector: (row: TransformedAiAssessment) => row.rawData?.created_by_name || '',
      cell: (row: TransformedAiAssessment) => (
        <CreatedByCell name={row.rawData?.created_by_name} role={row.rawData?.created_by_role} />
      ),
    } as TableColumn<TransformedAiAssessment>] : []),
    {
      name: 'Role & Level',
      selector: (row: TransformedAiAssessment) => row.roleType,
      wrap: true,
      minWidth: '170px',
      cell: (row: TransformedAiAssessment) => (
        <div className="flex flex-col items-start gap-1 py-1">
          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
            <Cpu className="h-3 w-3" />
            {row.roleType || "—"}
          </span>
          {row.experienceLevel ? (
            <span className="text-[11px] text-slate-500">{row.experienceLevel}</span>
          ) : null}
        </div>
      ),
    },
    {
      name: 'Status',
      selector: (row: TransformedAiAssessment) => row.status,
      sortable: true,
      minWidth: '120px',
      cell: (row: TransformedAiAssessment) => <AssessStatusBadge status={row.status} />,
    },
    {
      name: 'Candidates',
      selector: (row: TransformedAiAssessment) => row.totalCandidates,
      sortable: true,
      minWidth: '170px',
      cell: (row: TransformedAiAssessment) => (
        <CandidatesCell
          total={row.totalCandidates}
          completed={row.completedCount}
          inProgress={row.inProgressCount}
          notStarted={row.notStartedCount}
        />
      ),
    },
    {
      name: 'Questions',
      selector: (row: TransformedAiAssessment) => row.totalQuestions,
      sortable: true,
      center: true,
      width: '130px',
      cell: (row: TransformedAiAssessment) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-0.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-bold text-brand-violet ring-1 ring-inset ring-violet-100">
                <FileText className="h-3.5 w-3.5" />
                {row.totalQuestions}
              </span>
              <span className="text-[10px] text-slate-400">
                {row.aiQuestions} AI · {row.hardcodedQuestions} fixed
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-0.5 text-xs">
              <div>{row.totalQuestions} total questions</div>
              <div className="text-violet-600">{row.aiQuestions} AI-generated</div>
              <div className="text-emerald-600">{row.hardcodedQuestions} fixed</div>
            </div>
          </TooltipContent>
        </Tooltip>
      ),
    },
    {
      name: 'Schedule',
      selector: (row: TransformedAiAssessment) => row.rawData?.start_date || '',
      sortable: true,
      minWidth: '130px',
      cell: (row: TransformedAiAssessment) => {
        const info = assessScheduleInfo(row.rawData?.start_date, row.rawData?.end_date, row.status);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("inline-flex items-center gap-1.5 text-xs", info.cls)}>
                <CalendarDays className="h-3.5 w-3.5 opacity-70" />
                {info.text}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-0.5 text-xs">
                <div>Starts: {row.startDate}</div>
                <div>Ends: {row.endDate}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      name: 'Actions',
      cell: (row: TransformedAiAssessment) => (
        <div className="flex items-center justify-center gap-1">
          <ActionIconBtn
            label="Edit assessment"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/ai-assessment/${row.id}/edit`); }}
            className="hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
          >
            <Edit className="h-4 w-4" />
          </ActionIconBtn>
          <ActionIconBtn
            label="View results"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/results/ai-assessment/${row.id}`); }}
            className="hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
          >
            <BarChart className="h-4 w-4" />
          </ActionIconBtn>
          <ActionIconBtn
            label={
                      row.status === "Completed"
                        ? "Cannot manage candidates on a completed assessment"
                        : "Add / remove candidates"
                    }
            onClick={(e) => {
              e.stopPropagation();

              if (row.status === "Completed") {
                return;
              }

              // Manage candidates inside the edit wizard's last step.
              navigate(`/admin/ai-assessment/${row.id}/edit?step=candidates`);
            }}
            className={
              row.status === "Completed"
                ? "cursor-not-allowed opacity-50"
                : "hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            }
          >
            <Users className="h-4 w-4" />
          </ActionIconBtn>
        </div>
      ),
      ignoreRowClick: true,
      minWidth: '140px',
      maxWidth: '160px',
      center: true,
    },
  ], [navigate, getStatusColor, canSeeCreator]);

  // Adapt local PaginationState to DynamicTable's PaginationState
  const toDynamicTablePagination = (p: PaginationState): DynamicTablePaginationState => ({
    currentPage: p.currentPage,
    totalPages: p.totalPages,
    totalCount: p.totalCount,
    nextUrl: p.nextPageUrl,
    prevUrl: p.prevPageUrl,
  });

  const dynamicTablePagination = useMemo(
    () => toDynamicTablePagination(currentPagination),
    [currentPagination]
  );

  return (
    <AdminLayout>
      <TooltipProvider delayDuration={150}>
        <div className="w-full">
          <div className="mx-auto max-w-[1600px]">
            <PageHeader
              icon={BarChart}
              title="Assessments"
              description="Create, schedule, and track all assessments"
              className="mb-3"
            />

            {/* Assessment Type Tabs */}
            <div className="mb-4">
              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 shadow-inner">
                {[
                  { key: "regular" as const, label: "Regular Assessments", icon: BarChart },
                  { key: "ai" as const, label: "AI Assessments", icon: Cpu },
                ].map((tab) => {
                  const active = assessmentType === tab.key;
                  const TabIcon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleAssessmentTypeChange(tab.key)}
                      className={cn(
                        "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200",
                        active ? "text-brand-purple" : "text-slate-500 hover:text-brand-violet"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="assessTabIndicator"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          className="absolute inset-0 -z-0 rounded-lg bg-white shadow-[0_2px_8px_-2px_rgba(61,7,95,0.25)] ring-1 ring-black/5"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        <TabIcon className={cn("h-4 w-4", active ? "text-brand-violet" : "text-slate-400")} />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>


            {/* Main Content */}
            <div className="mb-3 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
              <ListPageToolbar
                className=" border-0 shadow-none rounded-none"
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder={
                  assessmentType === "regular"
                    ? "Search assessments…"
                    : "Search AI assessments…"
                }
                filterPanelOpen={filterPanelOpen}
                onFilterPanelToggle={() => setFilterPanelOpen((o) => !o)}
                sortValue={sortMode}
                onSortChange={(v) => setSortMode(v as AssessmentSortMode)}
                sortOptions={ASSESSMENT_SORT_OPTIONS}
                sortMenuLabel="Sort assessments"
                primaryAction={{
                  label: assessmentType === "regular" ? "Create Assessment" : "Create AI Assessment",
                  icon: <Plus className="h-4 w-4" />,
                  onClick: () =>
                    navigate(
                      assessmentType === "regular"
                        ? "/admin/assessment/create"
                        : "/admin/ai-assessment/create"
                    ),
                  className:
                    assessmentType === "ai"
                      ? "bg-gradient-to-r from-[#5b1a85] to-brand-purple"
                      : undefined,
                }}
                activeFilters={assessmentFilterChips}
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
                      options={[
                        { value: "all", label: "All Status" },
                        { value: "active", label: "Active" },
                        { value: "upcoming", label: "Upcoming" },
                        { value: "completed", label: "Completed" },
                      ] as DropdownOption<string>[]}
                      icon={BarChart}
                      className="w-[160px]"
                      buttonClassName="h-8 !py-0 text-xs"
                    />
                    <DateRangePicker
                      from={dateFrom}
                      to={dateTo}
                      onChange={(f, t) => {
                        handleDateFromChange(f);
                        handleDateToChange(t);
                      }}
                      placeholder="Start date: any"
                      className="w-[200px]"
                      buttonClassName="h-8 !py-0 text-xs"
                    />
                  </div>
                }
              />

              {/* DynamicTable Component */}
              <DynamicTable
                className="rounded-none border-0 shadow-none"
                customTableStyles={listPageTableStyles}
                data={sortedData}
                columns={assessmentType === "regular" ? regularColumns : aiColumns}
                pagination={dynamicTablePagination}
                rowsPerPage={ROWS_PER_PAGE}
                isLoading={showTableLoading}
                selectable
                onSelectionChange={(rows) => {
                  setSelectedRows(rows);
                }}
                toggleCleared={toggleCleared}
                onPageChange={(page) => handlePageChange(page)}
                itemLabel={assessmentType === "regular" ? "assessments" : "AI assessments"}
                loadingMessage={`Loading ${assessmentType === "regular" ? "assessments" : "AI assessments"}...`}
                noDataMessage={`No ${assessmentType === "regular" ? "assessments" : "AI assessments"} found`}
                isFilterApplied={isFilterApplied}
                onClearFilters={clearFilters}
                bulkActionBar={
                  selectedRows.length > 0 ? (
                    <div className="flex flex-col items-center justify-between gap-2 border-b border-slate-200 bg-violet-50/60 px-3 py-2.5 sm:flex-row sm:px-4">
                      <span className="text-center text-xs font-medium text-brand-violet sm:text-left">
                        {selectedRows.length} {assessmentType === "regular" ? "assessment(s)" : "AI assessment(s)"} selected
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleBulkDelete}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <Trash2 size={12} />
                          Delete Selected
                        </button>
                      </div>
                    </div>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      </TooltipProvider>
    </AdminLayout>
  );
};
