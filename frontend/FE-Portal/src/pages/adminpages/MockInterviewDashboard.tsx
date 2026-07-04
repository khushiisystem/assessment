import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Layers,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Search,
  Star,
  CalendarDays,
  LayoutTemplate,
  Users,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import {
  useGetSessionsQuery,
  useGetMockCandidatesQuery,
  useGetTemplatesQuery,
  useDeleteSessionMutation,
  useDeleteMockCandidateMutation,
  useBulkDeleteSessionsMutation,
} from "@/store";
import { ActiveFilterChip } from "@/components/common/SearchFilterPanel";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { ListPageToolbar, SortOption } from "@/components/common/ListPageToolbar";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TableRowActions } from "@/components/common/TableRowActions";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";


/** Friendly relative schedule label for a session. */
function mockScheduleInfo(scheduled?: string): { text: string; cls: string } {
  if (!scheduled) return { text: "Not scheduled", cls: "text-slate-400" };
  const d = new Date(scheduled);
  if (isNaN(d.getTime())) return { text: "—", cls: "text-slate-400" };
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days > 1) return { text: `In ${days} days`, cls: "font-medium text-sky-600" };
  if (days === 1) return { text: "Tomorrow", cls: "font-medium text-sky-600" };
  if (days === 0) return { text: "Today", cls: "font-medium text-amber-600" };
  if (days === -1) return { text: "Yesterday", cls: "text-slate-500" };
  return { text: `${Math.abs(days)}d ago`, cls: "text-slate-500" };
}

export interface CandidateResponse {
  question_id: number;
  rating: number;
  notes: string;
}

export interface MockSession {
  id?: number;
  candidate_name: string;
  candidate_email?: string;
  candidate_id?: number;
  candidate_interviewer_name: string;
  candidate_interviewer_email: string;
  candidate_interviewer_id: number;
  stack: string;
  status: "active" | "completed";
  version_label: string;
  questions: number[];
  responses: Record<string, CandidateResponse>;
  overall_feedback?: string;
  created_at?: number;
  updated_at?: number;
  scheduled_at?: string;
}

export interface Candidate {
  id?: number;
  name: string;
  email: string;
  created_at?: number;
  updated_at?: number;
}

export interface InterviewTemplate {
  id?: number;
  name: string;
  questions: number[];
  created_at?: number;
  updated_at?: number;
}

interface DeleteConfirmationState {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: (() => Promise<void>) | null;
}

// Date validator function
type SessionSortMode =
  | "default"
  | "candidate_asc"
  | "candidate_desc"
  | "date_desc"
  | "date_asc"
  | "status_asc"
  | "status_desc";

const SESSION_SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Default order" },
  { value: "candidate_asc", label: "Candidate (A–Z)" },
  { value: "candidate_desc", label: "Candidate (Z–A)" },
  { value: "date_desc", label: "Date (newest first)" },
  { value: "date_asc", label: "Date (oldest first)" },
  { value: "status_asc", label: "Status (A–Z)" },
  { value: "status_desc", label: "Status (Z–A)" },
];

const isValidDate = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

// Safe timestamp parser
const getSafeTimestamp = (createdAt?: number): number | null => {
  if (!createdAt) return null;
  // Handle both seconds (Unix timestamp) and milliseconds
  return createdAt > 1000000000000 ? createdAt : createdAt * 1000;
    };

const MockInterviewDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStack, setFilterStack] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SessionSortMode>("default");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    onConfirm: null,
  });
  const itemsPerPage = 10;

  // RTK Query hooks
  const {
    data: sessionsResponse,
    isLoading: isSessionsLoading,
    isFetching: isSessionsFetching,
    isError: isSessionsError,
  } = useGetSessionsQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });
  const {
    data: candidatesResponse,
    isLoading: isCandidatesLoading,
    isFetching: isCandidatesFetching,
    isError: isCandidatesError,
  } = useGetMockCandidatesQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });
  const {
    data: templatesData,
    isLoading: isTemplatesLoading,
    isFetching: isTemplatesFetching,
    isError: isTemplatesError,
  } = useGetTemplatesQuery(undefined, {
    refetchOnMountOrArgChange: false,
  });
  const [deleteSessionMutation] = useDeleteSessionMutation();
  const [deleteCandidateMutation] = useDeleteMockCandidateMutation();
  const [bulkDeleteSessionsMutation] = useBulkDeleteSessionsMutation();

  const sessions = useMemo<MockSession[]>(
    () => (sessionsResponse?.results ?? sessionsResponse ?? []) as MockSession[],
    [sessionsResponse]
  );
  const candidates = useMemo<Candidate[]>(
    () => (candidatesResponse?.results ?? candidatesResponse ?? []) as Candidate[],
    [candidatesResponse]
  );
  const templates = useMemo<InterviewTemplate[]>(
    () => (templatesData?.results ?? templatesData ?? []) as InterviewTemplate[],
    [templatesData]
  );
  const isLoading = isSessionsLoading || isCandidatesLoading || isTemplatesLoading;
  const isRefreshing = isSessionsFetching || isCandidatesFetching || isTemplatesFetching;

  useEffect(() => {
    // Always check URL for page parameter when searchParams changes
    const pageFromUrl = searchParams.get('page');
    if (pageFromUrl) {
      const page = parseInt(pageFromUrl, 10);
      if (!isNaN(page) && page > 0) {
        setCurrentPage(page);
      }
    } else {
      setCurrentPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isSessionsError || isCandidatesError || isTemplatesError) {
      toast.error("Failed to load mock interview data");
    }
  }, [isSessionsError, isCandidatesError, isTemplatesError]);

  const openDeleteConfirmation = ({
    title,
    description,
    confirmText,
    onConfirm,
  }: Omit<DeleteConfirmationState, "open">) => {
    setDeleteConfirmation({
      open: true,
      title,
      description,
      confirmText,
      onConfirm,
    });
  };

  const closeDeleteConfirmation = () => {
    setIsDeleteActionLoading(false);
    setDeleteConfirmation((prev) => ({
      ...prev,
      open: false,
      onConfirm: null,
    }));
  };

  const handleDeleteConfirmation = async () => {
    if (!deleteConfirmation.onConfirm) return;
    setIsDeleteActionLoading(true);
    try {
      await deleteConfirmation.onConfirm();
      closeDeleteConfirmation();
    } finally {
      setIsDeleteActionLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    openDeleteConfirmation({
      title: "Are you sure?",
      description: "You want to delete this session?",
      confirmText: "Yes, delete it!",
      onConfirm: async () => {
        try {
          await deleteSessionMutation(id).unwrap();
          toast.success("Session deleted");
        } catch (error) {
          toast.error("Failed to delete session");
        }
      },
    });
  };

  // Handle Candidate Delete functionality
  const handleCandidateDelete = (e: React.MouseEvent, id: number) => {
    // Stops the click from bubbling up to the card
    e.stopPropagation();

    openDeleteConfirmation({
      title: "Are you sure?",
      description: "This will delete all their interview history.",
      confirmText: "Yes, delete candidate!",
      onConfirm: async () => {
        try {
          await deleteCandidateMutation(id).unwrap();
          toast.success("Candidate deleted successfully");
        } catch (error) {
          console.error(error);
          toast.error("Failed to delete candidate. Please check if backend allows this.");
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    openDeleteConfirmation({
      title: "Delete Sessions?",
      description: `Are you sure you want to delete ${selectedIds.size} sessions?`,
      confirmText: "Yes, delete them!",
      onConfirm: async () => {
        try {
          await bulkDeleteSessionsMutation(Array.from(selectedIds)).unwrap();
          toast.success(`Deleted ${selectedIds.size} sessions`);
          setSelectedIds(new Set());
        } catch (error) {
          toast.error("Failed to delete sessions");
        }
      },
    });
  };

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  //Fixed date handlers with validation
  const handleDateFromChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setDateFrom(value);
    setCurrentPage(1);
  };

  const handleDateToChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setDateTo(value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStack("all");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  const isFilterApplied = searchTerm.trim() !== "" || filterStack !== "all" || filterStatus !== "all" || dateFrom !== "" || dateTo !== "";
  const uniqueStacks = useMemo(
    () => Array.from(new Set(sessions.map((s) => s.stack))),
    [sessions]
  );
  const activeFilterChips: ActiveFilterChip[] = [
    ...(searchTerm.trim()
      ? [{
        id: "search",
        label: "Search",
        value: searchTerm,
        onRemove: () => setSearchTerm(""),
        tone: "blue" as const,
        quoteValue: true,
      }]
      : []),
    ...(filterStack !== "all"
      ? [{
        id: "stack",
        label: "Stack",
        value: filterStack,
        onRemove: () => setFilterStack("all"),
        tone: "green" as const,
      }]
      : []),
    ...(filterStatus !== "all"
      ? [{
        id: "status",
        label: "Status",
        value: filterStatus,
        onRemove: () => setFilterStatus("all"),
        tone: "purple" as const,
      }]
      : []),
    ...(dateFrom
      ? [{
        id: "dateFrom",
        label: "From",
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
        label: "To",
        value: new Date(dateTo + "T00:00:00").toLocaleDateString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric',
        }),
        onRemove: () => setDateTo(""),
        tone: "amber" as const,
      }]
      : []),
  ];

  // Complete filtered sessions logic with proper date handling
  const filteredSessions = sessions.filter(session => {
    const matchesSearch =!searchTerm ||
      session.candidate_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.candidate_email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStack = filterStack === "all" || session.stack === filterStack;
    const matchesStatus = filterStatus === "all" || session.status === filterStatus;
    // DATE FILTER LOGIC
    let matchesDate = true;

    if ((dateFrom && isValidDate(dateFrom)) || (dateTo && isValidDate(dateTo))) {
      // If no created_at, can't filter by date
      if (!session.created_at) {
        matchesDate = false;
      } else {
        const timestamp = getSafeTimestamp(session.created_at);
        if (!timestamp) {
          matchesDate = false;
        } else {
          const sessionDate = new Date(timestamp);

          if (dateFrom && isValidDate(dateFrom)) {
            const fromDate = new Date(dateFrom + "T00:00:00");
            if (sessionDate < fromDate) matchesDate = false;
          }

          if (dateTo && isValidDate(dateTo) && matchesDate) {
            const toDate = new Date(dateTo + "T23:59:59");
            if (sessionDate > toDate) matchesDate = false;
          }
        }
      }
    }

    return matchesSearch && matchesStack && matchesStatus && matchesDate;
  });

  const sortedSessions = useMemo(() => {
    const list = [...filteredSessions];
    const getDate = (session: MockSession) => getSafeTimestamp(session.created_at) ?? 0;

    switch (sortMode) {
      case "candidate_asc":
        return list.sort((a, b) => a.candidate_name.localeCompare(b.candidate_name));
      case "candidate_desc":
        return list.sort((a, b) => b.candidate_name.localeCompare(a.candidate_name));
      case "date_desc":
        return list.sort((a, b) => getDate(b) - getDate(a));
      case "date_asc":
        return list.sort((a, b) => getDate(a) - getDate(b));
      case "status_asc":
        return list.sort((a, b) => a.status.localeCompare(b.status));
      case "status_desc":
        return list.sort((a, b) => b.status.localeCompare(a.status));
      default:
        return list;
    }
  }, [filteredSessions, sortMode]);

  const activeSessions = sessions.filter((s) => s.status === "active");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  // const uniqueStacks = Array.from(new Set(sessions.map(s => s.stack)));

  const totalPages = Math.ceil(sortedSessions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, sortedSessions.length);
  const paginatedSessions = sortedSessions.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      navigate(`?page=${newPage}`);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      navigate(`?page=${newPage}`);
    }
  };

  const handleFirstPage = () => {
    setCurrentPage(1);
    navigate(`?page=1`);
  };

  const handleLastPage = () => {
    setCurrentPage(totalPages);
    navigate(`?page=${totalPages}`);
  };

  return (
    <AdminLayout>
      <TooltipProvider delayDuration={150}>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px]">
          <PageHeader
            icon={Play}
            title="Mock Interviews"
            description="Manage and track mock interview sessions and candidates."
            className="mb-5"
          />

          {/* Stats Cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} label="Total Sessions" value={sessions.length} icon={CalendarDays} gradient="from-brand-purple to-brand-violet" />
            <StatCard index={1} label="Templates" value={templates.length} icon={LayoutTemplate} gradient="from-[#0955a7] to-[#2f9cd4]" />
            <StatCard index={2} label="Completed" value={completedSessions.length} icon={CheckCircle} gradient="from-[#0e9f6e] to-[#23c366]" />
            <StatCard index={3} label="Candidates" value={candidates.length} icon={Users} gradient="from-[#5b21b6] to-[#9d5bd2]" />
          </div>

          <ListPageToolbar
            className=""
            searchValue={searchTerm}
            onSearchChange={(v) => {
              setSearchTerm(v);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search by name or email…"
            filterPanelOpen={filterPanelOpen}
            onFilterPanelToggle={() => setFilterPanelOpen((o) => !o)}
            sortValue={sortMode}
            onSortChange={(v) => setSortMode(v as SessionSortMode)}
            sortOptions={SESSION_SORT_OPTIONS}
            sortMenuLabel="Sort sessions"
            primaryAction={{
              label: "Schedule Interview",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => navigate("/admin/mock-interview/start"),
            }}
            moreMenuItems={
              <>
                <DropdownMenuItem onClick={() => navigate("/admin/mock-interview/questions")}>
                  <Database className="h-4 w-4" />
                  Question Bank
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/admin/mock-interview/templates")}>
                  <Layers className="h-4 w-4" />
                  Templates
                </DropdownMenuItem>
              </>
            }
            activeFilters={activeFilterChips}
            onClearAllFilters={clearFilters}
            filterPanel={
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                  <Search className="h-3.5 w-3.5" />
                  Filters
                </span>
                <Dropdown
                  value={filterStack}
                  onChange={(v) => { setFilterStack(v); setCurrentPage(1); }}
                  options={[
                    { value: "all", label: "All Stacks" },
                    ...uniqueStacks.map((stack) => ({ value: stack, label: stack })),
                  ] as DropdownOption<string>[]}
                  icon={Layers}
                  className="w-[170px]"
                  buttonClassName="h-8 !py-0 text-xs"
                />
                <Dropdown
                  value={filterStatus}
                  onChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "completed", label: "Completed" },
                  ] as DropdownOption<string>[]}
                  icon={CheckCircle}
                  className="w-[150px]"
                  buttonClassName="h-8 !py-0 text-xs"
                />
                <DateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onChange={(f, t) => {
                    handleDateFromChange(f);
                    handleDateToChange(t);
                  }}
                  placeholder="Schedule date: any"
                  className="w-[200px]"
                  buttonClassName="h-8 !py-0 text-xs"
                />
              </div>
            }
          />

          {/* Sessions Table */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between border-b border-slate-200 bg-violet-50/60 px-4 py-2.5">
                <span className="text-xs font-medium text-brand-violet">
                  {selectedIds.size} session(s) selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 size={12} />
                  Delete Selected
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-12 px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="accent-brand-violet"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(paginatedSessions.map((s) => s.id!)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        checked={selectedIds.size === paginatedSessions.length && paginatedSessions.length > 0}
                      />
                    </TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Candidate</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Interviewer</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Stack</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Questions</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Score</TableHead>
                    <TableHead className="px-4 py-2.5 text-xs font-semibold text-slate-700">Scheduled</TableHead>
                    <TableHead className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center">
                        <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet"></div>
                        <p className="text-sm text-slate-600">Loading sessions…</p>
                      </TableCell>
                    </TableRow>
                  ) : paginatedSessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center">
                          <Search className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-sm font-medium mb-1">No sessions found</p>
                          <p className="text-xs text-slate-400">
                            {isFilterApplied
                              ? "No sessions available for the selected filters. Try adjusting your filters or search query."
                              : "No interview sessions available yet. Start by creating your first session."}
                          </p>
                          {isFilterApplied && (
                            <button
                              onClick={clearFilters}
                              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-purple px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#ff5a1f]"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSessions.map((session) => {
                      // Calculate Score for this specific session
                      const responses = Object.values(session.responses || {});
                      let totalRating = 0;
                      let totalCount = 0;
                      responses.forEach((r) => {
                        if (r.rating > 0) {
                          totalRating += r.rating;
                          totalCount++;
                        }
                      });
                      const sessionScore = totalCount > 0 ? (totalRating / totalCount).toFixed(1) : null;

                      return (
                        <TableRow key={session.id} className="border-b border-slate-100 transition-colors hover:bg-violet-50/40">
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            <input
                              type="checkbox"
                              className="accent-brand-violet"
                              checked={selectedIds.has(session.id!)}
                              onChange={() => toggleSelection(session.id!)}
                            />
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-violet text-[11px] font-bold text-white">
                                {(session.candidate_name || "?").trim().split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div
                                  className="cursor-pointer truncate text-[13px] font-semibold text-slate-800 transition-colors hover:text-brand-violet"
                                  onClick={() => navigate(`/admin/mock-interview/session/${session.id}?page=${currentPage}`)}
                                >
                                  {session.candidate_name}
                                </div>
                                {session.candidate_email && (
                                  <div className="truncate text-[11px] text-slate-500">{session.candidate_email}</div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            {session.candidate_interviewer_name ? (
                              <div className="min-w-0">
                                <div className="truncate text-[13px] font-medium text-slate-700">{session.candidate_interviewer_name}</div>
                                {session.candidate_interviewer_email && (
                                  <div className="truncate text-[11px] text-slate-500">{session.candidate_interviewer_email}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
                              <Layers className="h-3 w-3" />
                              {session.stack}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            {session.status === "completed" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                                <CheckCircle className="h-3 w-3" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                                Active
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-100">
                                  {session.questions.length}
                                  <span className="font-normal text-slate-400">Q</span>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {session.questions.length} question{session.questions.length === 1 ? "" : "s"} · {totalCount} rated
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px] text-gray-900">
                            {sessionScore ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                    {sessionScore}
                                    <span className="font-normal text-amber-500/70">/5</span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Average of {totalCount} rated answer{totalCount === 1 ? "" : "s"}</TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-slate-400">Not rated</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-[13px]">
                            {(() => {
                              const info = mockScheduleInfo(session.scheduled_at);
                              return session.scheduled_at ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn("inline-flex items-center gap-1.5 text-xs", info.cls)}>
                                      <CalendarDays className="h-3.5 w-3.5 opacity-70" />
                                      {info.text}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{new Date(session.scheduled_at).toLocaleString("en-IN")}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-slate-400">Not scheduled</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end">
                              <RowActionsMenu>
                                {session.status === "active" ? (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/mock-interview/session/${session.id}?page=${currentPage}`); }}>
                                    <Play />
                                    Continue interview
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/mock-interview/session/${session.id}?page=${currentPage}`); }}>
                                    <Eye />
                                    View session
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => { e.stopPropagation(); handleDelete(session.id!); }}
                                  className="text-red-600 focus:bg-red-50 focus:text-red-600 [&>svg]:text-red-400 focus:[&>svg]:text-red-600"
                                >
                                  <Trash2 />
                                  Delete session
                                </DropdownMenuItem>
                              </RowActionsMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredSessions.length > 0 && (
              <div className="flex flex-col md:flex-row justify-between items-center p-3 border-t border-gray-200 gap-3">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{filteredSessions.length}</span> sessions
                  {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
                  {isRefreshing && !isLoading && " • Refreshing"}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFirstPage}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs transition-colors hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
                    title="First Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <ChevronLeft className="w-3 h-3 -ml-2" />
                  </button>

                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs transition-colors hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    Previous
                  </button>

                  <div className="px-2 py-1 text-xs text-slate-700">
                    Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                  </div>

                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages || isLoading}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs transition-colors hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
                    title="Next Page"
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={handleLastPage}
                    disabled={currentPage === totalPages || isLoading}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs transition-colors hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet disabled:cursor-not-allowed disabled:opacity-50"
                    title="Last Page"
                  >
                    <ChevronRight className="w-3 h-3" />
                    <ChevronRight className="w-3 h-3 -ml-2" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Candidates Section */}
          <div className="bg-white rounded shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium text-slate-800">Recent Candidates</h3>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {candidates.slice(0, 8).map((candidate, idx) => {
                  // Calculate Stats
                  const candidateSessions = sessions.filter(s => s.candidate_id === candidate.id);
                  const latestSession = [...candidateSessions].sort((a, b) => (b.created_at || 0) - (a.created_at || 0))[0];
                  const stack = latestSession?.stack;

                  let totalRating = 0;
                  let totalCount = 0;
                  candidateSessions.forEach(session => {
                    Object.values(session.responses || {}).forEach(r => {
                      if (r.rating > 0) {
                        totalRating += r.rating;
                        totalCount++;
                      }
                    });
                  });
                  const avgScore = totalCount > 0 ? (totalRating / totalCount).toFixed(1) : "0.0";

                  return (
                    <div
                      key={candidate.id || idx}
                      className="group relative p-3 border border-gray-200 rounded hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/mock-interview/candidate/${candidate.id}?page=${currentPage}`)}
                    >
                      <button
                        onClick={(e) => handleCandidateDelete(e, candidate.id!)}
                        className="absolute top-2 right-2 p-1.5 bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-full transition-all shadow-sm z-10"
                        title="Delete Candidate"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="font-medium text-sm text-slate-900 pr-6 truncate">{candidate.name}</div>
                      <div className="text-xs text-slate-500 truncate">{candidate.email}</div>

                      {/* Stack Badge and Score */}
                      <div className="flex items-center gap-2 mt-2 mb-1">
                        {stack && (
                          <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                            {stack}
                          </span>
                        )}
                        {parseFloat(avgScore) > 0 && (
                          <div className="flex items-center text-xs font-medium text-slate-700">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 mr-1" />
                            {avgScore}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-slate-400 mt-1">
                        {candidateSessions.length} session(s)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
      </TooltipProvider>

      <ConfirmationDialog
        open={deleteConfirmation.open}
        title={deleteConfirmation.title}
        description={deleteConfirmation.description}
        confirmText={deleteConfirmation.confirmText}
        isLoading={isDeleteActionLoading}
        loadingText="Deleting..."
        onOpenChange={(open) => {
          if (!open && !isDeleteActionLoading) {
            closeDeleteConfirmation();
          }
        }}
        onConfirm={handleDeleteConfirmation}
      />
    </AdminLayout>
  );
};

export default MockInterviewDashboard;

