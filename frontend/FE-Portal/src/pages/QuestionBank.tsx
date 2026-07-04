import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Code,
  Trash2,
  Edit,
  Download,
  Upload,
  FileText,
  Sparkles,
  Filter,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import {
  DynamicTable,
  useTableState,
  TableColumn,
} from "@/components/DynamicTable";
import {
  useLazyGetQuestionsQuery,
  useDeleteQuestionMutation,
  useBulkDeleteQuestionsMutation,
  useGetCategoriesQuery,
  useLazyExportQuestionsQuery,
  useLazyGetAiMockQuestionsQuery,
  useGetStacksQuery,
  useDeleteAiMockQuestionMutation, 
} from "@/store";
import { formatDateValue } from "@/utils/commonFunctions";
import {
  ActiveFilterChip,
  FilterSelectConfig,
  SearchFilterPanel,
} from "@/components/common/SearchFilterPanel";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { ListPageToolbar, SortOption } from "@/components/common/ListPageToolbar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableRowActions } from "@/components/common/TableRowActions";
import { listPageTableStyles } from "@/utils/listPageTableStyles";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Question {
  id: string;
  title: string;
  description: string;
  question_type: string;
  difficulty: string;
  marks: number;
  category: number;
  category_name?: string;
  created_by: number;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  option5?: string;
  correct_answer?: string;
  sample_input?: string;
  sample_output?: string;
  tags?: string;
  created_at?: string | null;
  source?: string;
  stack?: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
}

interface DeleteConfirmationState {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: (() => Promise<void>) | null;
}

type ApiErrorWithDetail = {
  data?: {
    detail?: string;
  };
};

const ITEMS_PER_PAGE = 20;

type QuestionSortMode = "default" | "title_asc" | "title_desc" | "date_desc" | "date_asc";

const QUESTION_SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Default order" },
  { value: "title_asc", label: "Title (A–Z)" },
  { value: "title_desc", label: "Title (Z–A)" },
  { value: "date_desc", label: "Created (newest first)" },
  { value: "date_asc", label: "Created (oldest first)" },
];

export const QuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isInitialLoad = useRef(true);

  // Use shared table state
  const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });
  const isTabSwitching = useRef(false);

  // RTK Query hooks
  const [getQuestions] = useLazyGetQuestionsQuery();
  const [deleteQuestionMut] = useDeleteQuestionMutation();
  const [bulkDeleteQuestionsMut] = useBulkDeleteQuestionsMutation();
  const { data: categoriesData, error: categoriesError } = useGetCategoriesQuery();
  const [exportQuestions] = useLazyExportQuestionsQuery();

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("All Levels");
  const [typeFilter, setTypeFilter] = useState<string>("All Sub Categories");

  // Data states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [hasFetchedInitialData, setHasFetchedInitialData] = useState(false);

  const [questionTab, setQuestionTab] = useState("regular");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<QuestionSortMode>("default");
  const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
      open: false,
      title: "",
      description: "",
      confirmText: "Confirm",
      onConfirm: null,
    });
  const [getAiMockQuestions] = useLazyGetAiMockQuestionsQuery();

  const [deleteAiMockQuestionMut] = useDeleteAiMockQuestionMutation();
  const { data: stacksData } = useGetStacksQuery();
  const availableStacks = stacksData || [];

  // Derive categories from RTK Query
  const categories: Category[] = categoriesData || [];

  const questionTabRef = useRef(questionTab);
  useEffect(() => {
    questionTabRef.current = questionTab;
  }, [questionTab]);

  // Show toast if categories fetch failed
  useEffect(() => {
    if (categoriesError) {
      console.error("Failed to fetch categories:", categoriesError);
      toast({
        title: "Failed",
        description: "Failed to load categories",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [categoriesError, toast]);

  // Build API URL with filters
  const buildApiUrl = useCallback(
    (page: number = 1) => {
      const params = new URLSearchParams();
      const currentTab = questionTabRef.current;

      params.append("page", page.toString());
      params.append("page_size", ITEMS_PER_PAGE.toString());

      const search = table.searchQuery?.trim() ?? "";
      if (search) {
        params.append("search", search);
      }

      if (categoryFilter !== "all" && categoryFilter) {
        const selectedCategory = categories.find(
          (cat) =>
            cat.id.toString() === categoryFilter ||
            cat.name.toLowerCase() === categoryFilter.toLowerCase(),
        );
        if (selectedCategory) {
          params.append("categories", selectedCategory.id.toString());
        } else {
          params.append("category__name__iexact", categoryFilter);
        }
      }

      if (levelFilter !== "All Levels" && levelFilter) {
        params.append("difficulty", levelFilter.toLowerCase());
      }

      if (typeFilter !== "All Sub Categories" && typeFilter) {
        const typeMap: Record<string, string> = {
          "MCQ Single": "mcq_single",
          "MCQ Multiple": "mcq_multiple",
          SQL: "sql",
          Subjective: "subjective",
          Coding: "coding",
          "Fill in Blank": "fill_blank",
          "True/False": "true_false",
        };
        params.append("question_type", typeMap[typeFilter] || typeFilter);
      }

      if (questionTabRef.current === "regular") {
        params.append("source", "regular");
      } else if (questionTabRef.current === "ai_mock") {
        params.append("source", "ai_mock");
      }

      return `/my-admin/questions/?${params.toString()}`;
    },
    [table.searchQuery, categoryFilter, levelFilter, typeFilter, categories],
  );

  // Fetch questions
  const fetchQuestions = useCallback(
    async (page: number = 1) => {
      table.setIsLoading(true);
      const currentTab = questionTabRef.current;
      try {
        if (currentTab === "ai_mock") {
          const params: any = { page, page_size: ITEMS_PER_PAGE };

          if (categoryFilter === "coding") {
            // no stack param = coding only
          } else if (categoryFilter !== "all") {
            params.stack = categoryFilter;
          }

          if (
            levelFilter !== "All Levels" &&
            levelFilter !== "all_difficulties"
          ) {
            params.difficulty = levelFilter.toLowerCase();
          }
          if (table.searchQuery?.trim()) {
            params.search = table.searchQuery.trim();
          }
          // "all" = no stack param (backend returns all)

          const response = await getAiMockQuestions(params).unwrap();

          const fetched = response?.results?.questions || response?.questions || [];
          const total = response?.results?.total || response?.count || 0;

          const formatted = fetched.map((q: any) => ({
            id: q.id,
            //source: q.source,
            source: "ai_mock",
            title: q.title || q.question_text,
            question_type: q.question_type,
            difficulty: q.difficulty || "medium",
            marks: q.marks || 1,
            stack: (q.stack || q.category_name || "").trim(),
            category_name:
              q.source === "core"
                ? "Coding"
                : q.category_name || q.stack || "-",
            created_at: q.created_at
              ? typeof q.created_at === "number"
                ? new Date(q.created_at * 1000).toISOString()
                : q.created_at
              : null,
          }));

          setQuestions(formatted);
          table.updatePaginationFromResponse(
            total,
            response?.next || null,
            response?.previous || null,
            page,
          );
        } else {
          const endpoint = buildApiUrl(page);
          const data = await getQuestions(endpoint, true).unwrap();
          setQuestions(data.results.questions || []);
          table.updatePaginationFromResponse(
            data.count || 0,
            data.next,
            data.previous,
            page,
          );
        }
      } catch (error) {
        console.error("Failed to fetch questions:", error);
      } finally {
        table.setIsLoading(false);
        setHasFetchedInitialData(true);
      }
    },
    [
      buildApiUrl,
      getQuestions,
      getAiMockQuestions,
      categoryFilter,
      levelFilter,
      table.searchQuery,
    ],
  );
  // Initial data fetch (categories auto-fetched by useGetCategoriesQuery)
  useEffect(() => {
    const savedPage = sessionStorage.getItem("questionBankPage");
    if (savedPage) {
      sessionStorage.removeItem("questionBankPage");
      fetchQuestions(parseInt(savedPage));
    } else {
      fetchQuestions(1);
    }
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    if (isTabSwitching.current) return;
    const timer = setTimeout(() => {
      const savedPage = sessionStorage.getItem("questionBankPage");
      if (!savedPage) {
        fetchQuestions(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [table.searchQuery, categoryFilter, levelFilter, typeFilter, questionTab]);

  useEffect(() => {
    table.clearSelection();
    if (questionTab === "ai_mock") {
      setTypeFilter("All Sub Categories");
      setCategoryFilter("all");
    }
    setTimeout(() => {
      isTabSwitching.current = false;
    }, 0);
  }, [questionTab]);

  // Handle search change
  const handleSearchChange = (value: string) => {
    table.setSearchQuery(value);
    table.clearSelection();
  };

  // Handle filter changes
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    table.clearSelection();
  };

  const handleLevelChange = (value: string) => {
    setLevelFilter(value);
    table.clearSelection();
  };

  const handleTypeChange = (value: string) => {
    setTypeFilter(value);
    table.clearSelection();
  };

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

  const getDeleteErrorMessage = (error: unknown, fallback: string) => {
    const apiError = error as ApiErrorWithDetail;
    if (
      typeof apiError?.data?.detail === "string" &&
      apiError.data.detail.trim()
    ) {
      return apiError.data.detail;
    }
    return fallback;
  };

  // Handle bulk delete
  const handleDeleteSelected = () => {
    if (table.selectedRows.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one question to delete",
        duration: 3000,
      });
      return;
    }

    openDeleteConfirmation({
      title: "Are you sure?",
      description: `You are about to delete ${table.selectedRows.length} selected question(s)!`,
      confirmText: "Yes, delete them!",
      onConfirm: async () => {
        try {
          const questionIds = table.selectedRows.map((row: Question) => row.id) as any[];
          await bulkDeleteQuestionsMut(questionIds).unwrap();

          toast({
            title: "Success",
            description: `${table.selectedRows.length} question(s) deleted successfully`,
            variant: "success",
            duration: 3000,
          });

          table.clearSelection();
          fetchQuestions(table.pagination.currentPage);
        } catch (error: unknown) {
          console.error("Error deleting questions:", error);

          toast({
            title: "Failed",
            description: getDeleteErrorMessage(
              error,
              "Failed to delete questions. Please try again."
            ),
            variant: "destructive",
            duration: 3000,
          });
        }
      },
    });
  };

  // Handle single question delete
  const handleDeleteQuestion = (id: string, source?: string) => {
    //const isAiMock = source === "ai_mock";
    const isAiMock =
      questionTabRef.current === "ai_mock" || source === "ai_mock";
    openDeleteConfirmation({
      title: "Are you sure?",
      description: "Do you want to delete this question?",
      confirmText: "Yes, delete it!",
      onConfirm: async () => {
        try {
          //await deleteQuestionMut(id as any).unwrap();
          if (isAiMock) {
            // AI Mock Delete
            const numericId = parseInt(id.replace("mock_", ""));
            await deleteAiMockQuestionMut(numericId).unwrap(); // ✅ RTK mutation
          } else {
            await deleteQuestionMut(id as any).unwrap();
          }
          toast({
            title: "Success!",
            description: "Question deleted successfully.",
            duration: 3000,
          });

          fetchQuestions(table.pagination.currentPage);
        } catch (error: unknown) {
          console.error("Failed to delete question:", error);

          toast({
            title: "Delete Failed",
            description: getDeleteErrorMessage(
              error,
              "Failed to delete question. Please try again."
            ),
            variant: "destructive",
            duration: 3000,
          });
        }
      },
    });
  };

  // Clear all filters
  const clearFilters = () => {
    table.setSearchQuery("");
    setCategoryFilter("all");
    setLevelFilter("All Levels");
    setTypeFilter("All Sub Categories");
    table.clearSelection();
  };

  // Get category options

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...[...categories]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((cat) => ({ value: cat.id.toString(), label: cat.name })),
  ];

  // Get type options
  const typeOptions = useCallback(() => {
    const defaultTypes = [
      "MCQ Single",
      "MCQ Multiple",
      "Coding",
      "SQL",
      "Subjective",
      "Fill in Blank",
      "True/False",
    ];
    return [
      "All Sub Categories",
      ...[...defaultTypes].sort((a, b) => a.localeCompare(b))
    ];
  }, []);

  // Get difficulty color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "hard":
        return "bg-red-100 text-red-800";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // Get type color
  const getTypeColor = (questionType: string) => {
    if (questionType.includes("mcq")) {
      return questionType === "mcq_single"
        ? "bg-cyan-100 text-cyan-800"
        : "bg-purple-100 text-purple-800";
    } else if (questionType === "coding") {
      return "bg-blue-100 text-blue-800";
    } else if (questionType === "sql") {
      return "bg-orange-100 text-orange-800";
    } else if (questionType === "subjective") {
      return "bg-indigo-100 text-indigo-800";
    }
    return "bg-slate-100 text-slate-700";
  };

  // Get type display
  const getTypeDisplay = (questionType: string) => {
    const typeMap: Record<string, string> = {
      mcq_single: "MCQ Single",
      mcq_multiple: "MCQ Multiple",
      coding: "Coding",
      sql: "SQL",
      subjective: "Subjective",
      fill_blank: "Fill in Blank",
      true_false: "True/False",
    };
    return typeMap[questionType] || questionType.charAt(0).toUpperCase() + questionType.slice(1);
  };

  // Format date
  const formatDate = (dateString: string) =>
    formatDateValue(
      dateString,
      { year: "numeric", month: "short", day: "numeric" },
      "-",
    );

  // Export function
  const handleExportQuestions = async () => {
    try {
      const blob = await exportQuestions().unwrap();

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "questions.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast({
        title: "Success",
        description: "Questions exported successfully!",
        duration: 3000,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Failed",
        description: "Failed to export questions. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  // Column definitions
  const columns: TableColumn<Question>[] = [
    {
      name: "Question",
      selector: (row: Question) => row.title,
      sortable: true,
      wrap: true,
      grow: 2,
      cell: (row: Question) => (
        <div
          className="font-medium text-xs whitespace-normal break-words cursor-pointer"
          onClick={() => {
            sessionStorage.setItem("questionBankPage", table.pagination.currentPage.toString());
            navigate(`/admin/question/${row.id}/edit`, { state: { question: row } });
          }}
        >
          {row.title}
          {row.tags && (
            <div className="text-xs text-slate-500 mt-0.5">
              Tags: {row.tags}
            </div>
          )}
        </div>
      ),
    },
    {
      name: "Type",
      selector: (row: Question) => row.question_type,
      cell: (row: Question) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${getTypeColor(row.question_type)}`}
        >
          {getTypeDisplay(row.question_type)}
        </span>
      ),
      width: "120px",
    },
    {
      name: "Category",
      selector: (row: Question) => row.category_name || "-",
      cell: (row: Question) => 
      <div className="text-xs text-slate-600">{row.category_name || "-"}</div>,
      grow: 0.5,
    },
    {
      name: "Difficulty",
      selector: (row: Question) => row.difficulty,
      cell: (row: Question) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs ${getDifficultyColor(row.difficulty)}`}
        >
          {row.difficulty.charAt(0).toUpperCase() + row.difficulty.slice(1)}
        </span>
      ),
      grow: 0.5,
    },
    {
      name: "Marks",
      selector: (row: Question) => row.marks,
      sortable: true,
      cell: (row: Question) => 
      <span className="font-medium text-xs">{row.marks}</span>,
      width: "80px",
      center: true,
    },
    {
      name: "Created",
      selector: (row: Question) => row.created_at,
      sortable: true,
      cell: (row: Question) => 
        <div className="text-xs text-slate-600">
          {formatDate(row.created_at)}
        </div>,
      width: "100px",
    },
    {
      name: "Actions",
      cell: (row: Question) => (
        <div className="flex items-center justify-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Edit question"
                onClick={() => {
                  sessionStorage.setItem("questionBankPage", table.pagination.currentPage.toString());
                  navigate(`/admin/question/${row.id}/edit`, { state: { question: row } });
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
              >
                <Edit className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Edit question</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Delete question"
                onClick={() => handleDeleteQuestion(row.id, row.source)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete question</TooltipContent>
          </Tooltip>
        </div>
      ),
      ignoreRowClick: true,
      width: "120px",
      center: true,
    },
  ];

  const isFilterApplied =
    !!(table.searchQuery?.trim() ?? "") ||
    categoryFilter !== "all" ||
    levelFilter !== "All Levels" ||
    typeFilter !== "All Sub Categories";

  const questionFilterConfigs: FilterSelectConfig[] = [
    {
      id: "category",
      label: "Category",
      value: categoryFilter,
      onChange: handleCategoryChange,
      options:
        questionTab === "ai_mock"
          ? [
              { value: "all", label: "All Categories" },
              { value: "coding", label: "Coding" },
              ...availableStacks.map((s: any) => ({
                value: s.name || s,
                label: s.name || s,
              })),
            ]
          : categoryOptions,
    },

    ...(questionTab !== "ai_mock"
      ? [
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onChange: handleTypeChange,
            options: typeOptions().map((type) => ({
              value: type,
              label: type
            })),
          },
        ]
      : []),
    {
      id: "difficulty",
      label: "Difficulty",
      value: levelFilter,
      onChange: handleLevelChange,
      options: [
        { value: "All Levels", label: "All Levels" },
        { value: "Easy", label: "Easy" },
        { value: "Medium", label: "Medium" },
        { value: "Hard", label: "Hard" },
      ],
    },
  ];

  const activeFilterChips: ActiveFilterChip[] = [
    ...((table.searchQuery?.trim() ?? "")
      ? [
          {
            id: "search",
            label: "Search",
            value: table.searchQuery,
            onRemove: () => table.setSearchQuery(""),
            tone: "blue" as const,
            quoteValue: true,
          },
        ]
      : []),
    ...(categoryFilter !== "all"
      ? [
          {
            id: "category",
            label: "Category",
            value:
              categoryOptions.find((option) => option.value === categoryFilter)
                ?.label || categoryFilter,
            onRemove: () => setCategoryFilter("all"),
            tone: "green" as const,
          },
        ]
      : []),
    ...(levelFilter !== "All Levels"
      ? [
          {
            id: "difficulty",
            label: "Difficulty",
            value: levelFilter,
            onRemove: () => setLevelFilter("All Levels"),
            tone: "yellow" as const,
          },
        ]
      : []),
    ...(typeFilter !== "All Sub Categories"
      ? [
          {
            id: "type",
            label: "Type",
            value: typeFilter,
            onRemove: () => setTypeFilter("All Sub Categories"),
            tone: "purple" as const,
          },
        ]
      : []),
  ];

  const sortedQuestions = useMemo(() => {
    const list = [...questions];
    switch (sortMode) {
      case "title_asc":
        return list.sort((a, b) => a.title.localeCompare(b.title));
      case "title_desc":
        return list.sort((a, b) => b.title.localeCompare(a.title));
      case "date_desc":
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case "date_asc":
        return list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      default:
        return list;
    }
  }, [questions, sortMode]);

  const showTableLoading = !hasFetchedInitialData || table.isLoading;

  return (
    <AdminLayout>
      <TooltipProvider delayDuration={150}>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px]">
        <PageHeader
          icon={FileText}
          title="Questions"
          description="Create, organize, and manage your question bank"
          className="mb-4"
        />

        <div className="mb-4">
          <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 shadow-inner">
            {[
              { key: "regular" as const, label: "Regular Questions", icon: FileText },
              { key: "ai_mock" as const, label: "AI & Mock Questions", icon: Sparkles },
            ].map((tab) => {
              const active = questionTab === tab.key;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setQuestionTab(tab.key)}
                  className={cn(
                    "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200",
                    active ? "text-brand-purple" : "text-slate-500 hover:text-brand-violet"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="qbTabIndicator"
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

        <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
          <ListPageToolbar
            className="border-0 shadow-none rounded-none"
            searchValue={table.searchQuery}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search questions…"
            filterPanelOpen={filterPanelOpen}
            onFilterPanelToggle={() => setFilterPanelOpen((o) => !o)}
            sortValue={sortMode}
            onSortChange={(v) => setSortMode(v as QuestionSortMode)}
            sortOptions={QUESTION_SORT_OPTIONS}
            sortMenuLabel="Sort questions"
            primaryAction={{
              label: "Add Question",
              icon: <Plus className="h-4 w-4" />,
              onClick: () => {
                sessionStorage.setItem("questionBankPage", table.pagination.currentPage.toString());
                if (questionTab === "ai_mock") {
                  navigate("/admin/question/add", { state: { source: "ai_mock" } });
                } else {
                  navigate("/admin/question/add");
                }
              },
            }}
            moreMenuItems={
              <>
                <DropdownMenuItem
                  onClick={() => {
                    sessionStorage.setItem("questionBankPage", table.pagination.currentPage.toString());
                    if (questionTab === "ai_mock") {
                      navigate("/admin/question/add", { state: { questionType: "coding", source: "ai_mock" } });
                    } else {
                      navigate("/admin/question/add", { state: { questionType: "coding" } });
                    }
                  }}
                >
                  <Code className="h-4 w-4" />
                  Add coding question
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate("/admin/bulk-upload", {
                      state: { defaultTab: "questions" },
                    })
                  }
                >
                  <Upload className="h-4 w-4" />
                  Import questions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleExportQuestions()}>
                  <Download className="h-4 w-4" />
                  Export questions
                </DropdownMenuItem>
              </>
            }
            activeFilters={activeFilterChips}
            onClearAllFilters={clearFilters}
            filterPanel={
              <div className="flex flex-wrap items-center gap-2">
                <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                </span>
                {questionFilterConfigs.map((filter) => (
                  <Dropdown
                    key={filter.id}
                    value={filter.value}
                    onChange={filter.onChange}
                    options={filter.options as DropdownOption<string>[]}
                    className="w-[170px]"
                    buttonClassName="h-8 !py-0 text-xs"
                  />
                ))}
              </div>
            }
          />

          <DynamicTable
            className="rounded-none border-0 shadow-none"
            customTableStyles={listPageTableStyles}
            data={sortedQuestions}
            columns={columns}
            pagination={table.pagination}
            rowsPerPage={ITEMS_PER_PAGE}
            isLoading={showTableLoading}
            selectable
            onSelectionChange={(rows) => table.setSelectedRows(rows)}
            toggleCleared={table.toggleCleared}
            onPageChange={(page) => fetchQuestions(page)}
            itemLabel="questions"
            loadingMessage="Loading questions..."
            noDataMessage="No questions found"
            isFilterApplied={isFilterApplied}
            onClearFilters={clearFilters}
            bulkActionBar={
              table.selectedRows.length > 0 ? (
                <div className="flex items-center justify-between border-b border-slate-200 bg-violet-50/60 px-4 py-2.5">
                  <span className="text-xs font-medium text-brand-violet">
                    {table.selectedRows.length} question(s) selected
                  </span>
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    <Trash2 size={12} />
                    Delete Selected
                  </button>
                </div>
              ) : undefined
            }
          />
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
          if (!open && !isDeleteActionLoading) closeDeleteConfirmation();
        }}
        onConfirm={handleDeleteConfirmation}
      />
    </AdminLayout>
  );
};
export default QuestionBank;
