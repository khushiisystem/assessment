import { useState, useEffect, useMemo } from "react";
import {
    Plus,
    Edit,
    Trash2,
    UserPlus,
    Eye,
    BookOpen,
    Upload,
    AlertCircle,
    RefreshCw,
    Calendar,
    Search,
    Filter,
    ChevronDown,
    ArrowUpDown,
    Columns2,
    MoreHorizontal,
    GraduationCap,
    Layers,
    Users,
    ClipboardCheck,
} from "lucide-react";
import { Icon } from "@iconify/react";
import AdminLayout from "@/components/AdminLayout";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
    useGetTechnologiesQuery,
    useBulkDeleteTechnologiesMutation,
    useDeleteTechnologyMutation,
    useUpdateTechnologyMutation,
    useCreateTechnologyMutation,
    useGetAdminDashboardQuery,
} from "@/store";
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { useNavigate, useNavigationType } from "react-router-dom";
import { formatDateValue } from "@/utils/commonFunctions";
import { ActiveFilterChip, FilterSelectConfig, SearchFilterPanel } from "@/components/common/SearchFilterPanel";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useGetAllCandidatesActivityQuery } from "@/store/api/technologiesApi";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { listPageTableStyles } from "@/utils/listPageTableStyles";
import { TableRowActions } from "@/components/common/TableRowActions";
import { RowActionsMenu } from "@/components/common/RowActionsMenu";
import { RowActionIcon } from "@/components/common/RowActionIcon";

const ITEMS_PER_PAGE = 20;
/** Courses tab lists every course at once (no pagination) — request a high page size. */
const COURSES_PAGE_SIZE = 1000;

// Date validator function
const isValidDate = (date: string): boolean => {
    return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

const CATEGORY_CHOICES = [
    // 💻 Core Development
    { value: 'frontend', label: 'Frontend' },
    { value: 'backend', label: 'Backend' },
    { value: 'fullstack', label: 'Full Stack' },

    // 🗄️ Data & Databases
    { value: 'database', label: 'Database' },
    { value: 'big_data', label: 'Big Data' },
    { value: 'data_engineering', label: 'Data Engineering' },
    { value: 'data_science', label: 'Data Science' },

    // 🤖 AI & Machine Learning
    { value: 'ai_ml', label: 'AI / Machine Learning' },
    { value: 'deep_learning', label: 'Deep Learning' },
    { value: 'nlp', label: 'Natural Language Processing' },

    // ☁️ DevOps & Cloud
    { value: 'devops', label: 'DevOps' },
    { value: 'cloud', label: 'Cloud Computing' },
    { value: 'infrastructure', label: 'Infrastructure / Automation' },
    { value: 'security', label: 'Cybersecurity / Ethical Hacking' },

    // 📱 Mobile Development
    { value: 'mobile_android', label: 'Mobile (Android)' },
    { value: 'mobile_ios', label: 'Mobile (iOS)' },
    { value: 'mobile_cross_platform', label: 'Mobile (Cross Platform)' },

    // 🌐 Web & API
    { value: 'web', label: 'Web Development' },
    { value: 'api', label: 'API / Microservices' },

    // 🧩 Programming Languages
    { value: 'programming', label: 'Programming Language' },
    { value: 'scripting', label: 'Scripting Language' },

    // 🧠 Testing & QA
    { value: 'testing', label: 'Testing / QA' },
    { value: 'automation', label: 'Automation Testing' },

    // 🧰 Tools & Frameworks
    { value: 'framework', label: 'Framework / Library' },
    { value: 'version_control', label: 'Version Control / Git' },
    { value: 'ci_cd', label: 'CI/CD Tools' },

    // 🎨 Design & UI/UX
    { value: 'design', label: 'UI/UX Design' },
    { value: 'graphics', label: 'Graphics / Animation' },

    // 🧑‍💼 Project & Management
    { value: 'project_management', label: 'Project Management' },
    { value: 'agile', label: 'Agile / Scrum' },

    // 🪙 Emerging Tech
    { value: 'blockchain', label: 'Blockchain / Web3' },
    { value: 'iot', label: 'Internet of Things (IoT)' },
    { value: 'ar_vr', label: 'AR / VR / XR' },
    { value: 'robotics', label: 'Robotics' },

    // 📊 Business Intelligence
    { value: 'bi', label: 'Business Intelligence' },
    { value: 'analytics', label: 'Analytics / Reporting' },

    // 🧾 Miscellaneous
    { value: 'others', label: 'Others / General' },
];

type CourseSortMode =
    | "default"
    | "name_asc"
    | "name_desc"
    | "category_asc"
    | "category_desc"
    | "created_desc"
    | "created_asc"
    | "questions_desc"
    | "questions_asc";

type ActivitySortMode =
    | "default"
    | "name_asc"
    | "name_desc"
    | "course_asc"
    | "course_desc"
    | "progress_desc"
    | "progress_asc"
    | "status_asc"
    | "status_desc"
    | "assigned_desc"
    | "assigned_asc"
    | "due_desc"
    | "due_asc"
    | "last_active_desc"
    | "last_active_asc";

interface Technology {
    id: number;
    name: string;
    category: string;
    description: string;
    icon_url?: string;
    icon_key?: string;
    total_questions?: number;
    total_assigned_users?: number;
    created_at: string;
    updated_at?: string;
}

/** Short relative date for table cells (with exact date available via tooltip). */
function courseRelativeDate(dateString?: string): string {
    if (!dateString) return "—";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "—";
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

/** Friendly learning-stage metadata for the activity table. */
const ACTIVITY_STAGE: Record<string, { label: string; cls: string; dot: string; hint: string }> = {
    assigned: { label: "Not started", cls: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", hint: "Assigned but the candidate hasn't started yet." },
    in_progress: { label: "In progress", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", hint: "Actively working through the course." },
    completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", hint: "Finished every assigned question." },
};

/** Friendly deadline summary for the activity table. */
function activityDueInfo(due?: string, progress = 0): { text: string; cls: string } {
    if (progress >= 100) return { text: "Completed", cls: "text-emerald-600" };
    if (!due) return { text: "No deadline", cls: "text-slate-400" };
    const d = new Date(due);
    if (isNaN(d.getTime())) return { text: "No deadline", cls: "text-slate-400" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    const days = Math.round((dd.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return { text: `Overdue by ${Math.abs(days)}d`, cls: "font-semibold text-red-600" };
    if (days === 0) return { text: "Due today", cls: "font-medium text-amber-600" };
    if (days === 1) return { text: "Due tomorrow", cls: "font-medium text-amber-600" };
    if (days <= 7) return { text: `Due in ${days}d`, cls: "font-medium text-amber-600" };
    return { text: `Due in ${days}d`, cls: "text-slate-500" };
}

/** Initials for the candidate avatar. */
const activityInitials = (name?: string) =>
    (name || "?").trim().split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";

interface CourseCandidate {
    userId: string;
    name: string;
    email: string;
    progress: number;
    completed: number;
    total: number;
    last_active_at: string | null;
    user_notes: string | null;
}

interface CourseWithCandidates {
    id: string;
    name: string;
    category: string;
    description: string | null;
    total_questions: number;
    total_assigned_users: number;
    candidates: CourseCandidate[];
    created_at: string;
    updated_at: string;
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

const Technologies = () => {

    const navType = useNavigationType()

    const [currentPage, setCurrentPage] = useState(() => 
    navType === "POP" ? parseInt(sessionStorage.getItem("tech_page") || "1", 10) : 1
);

    // ✅ Move searchTerm & categoryFilter BEFORE the query (needed for debouncedSearch)
    const [searchTerm, setSearchTerm] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("tech_search") || "") : ""
    );
    const [categoryFilter, setCategoryFilter] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("tech_category") || "All Categories") : "All Categories"
    );
    
    // ADD DATE FILTERS FOR COURSE MANAGEMENT
    const [courseDateFrom, setCourseDateFrom] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("tech_date_from") || "") : ""
    );
    const [courseDateTo, setCourseDateTo] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("tech_date_to") || "") : ""
    );

    // ✅ Debounced search state
    const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // ✅ RTK Query with backend search
    const {
        data: techData,
        isLoading: techLoading,
        isError: isTechError,
        error: techQueryError,
        refetch: refetchTechnologies,
    } = useGetTechnologiesQuery({
        page: 1,
        page_size: COURSES_PAGE_SIZE,
        search: debouncedSearch,
    });

    // Platform-wide question total for the courses summary line.
    const { data: dashboardData } = useGetAdminDashboardQuery();
    const totalQuestions = dashboardData?.total_questions ?? 0;

    const [bulkDeleteTechnologies] = useBulkDeleteTechnologiesMutation();
    const [deleteTechnology] = useDeleteTechnologyMutation();
    const [updateTechnology] = useUpdateTechnologyMutation();
    const [createTechnology] = useCreateTechnologyMutation();

    // Derive data from cached query
    const technologies: Technology[] = useMemo(
        () => (Array.isArray(techData?.results) ? techData.results : []),
        [techData]
    );
   
    const [candidateSearchTerm, setCandidateSearchTerm] = useState(() => navType === "POP" ? (sessionStorage.getItem("act_search") || "") : "");
    const [activityCategoryFilter, setActivityCategoryFilter] = useState(() => navType === "POP" ? (sessionStorage.getItem("act_category") || "All Categories") : "All Categories");
    const [statusFilter, setStatusFilter] = useState(() => navType === "POP" ? (sessionStorage.getItem("act_status") || "all") : "all");
    const [activityDomainFilter, setActivityDomainFilter] = useState(() => localStorage.getItem("act_domain") || "all");
    const [emailDomains] = useState<string[]>(["all", "SkilTechy.com", "technomancerai.com", "beastpeers.com"]);
    
    // ADD DATE FILTERS FOR ACTIVITY TABLE (Assigned Date)
    const [activityDateFrom, setActivityDateFrom] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("act_date_from") || "") : ""
    );
    const [activityDateTo, setActivityDateTo] = useState(() => 
        navType === "POP" ? (sessionStorage.getItem("act_date_to") || "") : ""
    );

    const isLoading = techLoading;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTech, setEditingTech] = useState<Technology | null>(null);
    const [activeTab, setActiveTab] = useState<"courses" | "activities">(() => {
        if (navType !== "POP") return "courses";
        return (sessionStorage.getItem("activeCourseTab") as "courses" | "activities") || "courses";
    });
  
    const [expandedRows, setExpandedRows] = useState<string[]>([]);
    const navigate = useNavigate();
    
    // Use shared table state for courses table
    const courseTable = useTableState({ rowsPerPage: ITEMS_PER_PAGE });

    // Use shared table state for activities table
    const activityTable = useTableState({ rowsPerPage: ITEMS_PER_PAGE });

    // Restore pages from session on POP navigation
    const [candidateCurrentPage, setCandidateCurrentPage] = useState(() => navType === "POP" ? parseInt(sessionStorage.getItem("act_page") || "1", 10) : 1);
      const { data: activityData, isLoading: isLoadingCandidates, refetch: refetchActivity } = useGetAllCandidatesActivityQuery(
    { page: candidateCurrentPage, page_size: ITEMS_PER_PAGE },
    { skip: false }
    ); 

    const [formData, setFormData] = useState({
        name: "",
        category: "frontend",
        description: ""
    });

    // Icon state
    const [iconMode, setIconMode] = useState<'none' | 'upload' | 'iconify'>('none');
    const [iconFile, setIconFile] = useState<File | null>(null);
    const [iconKey, setIconKey] = useState('');
    const [iconPreview, setIconPreview] = useState('');
    const [existingIconUrl, setExistingIconUrl] = useState('');
    const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
        open: false,
        title: "",
        description: "",
        confirmText: "Confirm",
        onConfirm: null,
    });
    const [courseFilterPanelOpen, setCourseFilterPanelOpen] = useState(false);
    const [courseSortMode, setCourseSortMode] = useState<CourseSortMode>("default");
    const [courseColumnVisibility, setCourseColumnVisibility] = useState({
        name: true,
        category: true,
        questions: true,
        candidates: true,
        status: true,
        created: true,
        actions: true,
    });
    const [activityFilterPanelOpen, setActivityFilterPanelOpen] = useState(false);
    const [activitySortMode, setActivitySortMode] = useState<ActivitySortMode>("default");
    const [activityColumnVisibility, setActivityColumnVisibility] = useState({
        candidate: true,
        course: true,
        progress: true,
        status: true,
        done: true,
        assigned: true,
        due: true,
        lastActive: true,
        actions: true,
    });

    const handleTabChange = (tab: "courses" | "activities") => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    sessionStorage.setItem("activeCourseTab", tab);
  };

   


  

    // Store active tab in localStorage
    useEffect(() => {
        localStorage.setItem('technologiesActiveTab', activeTab);
    }, [activeTab]);

    

    useEffect(() => {
        sessionStorage.setItem("tech_search", searchTerm);
        sessionStorage.setItem("tech_category", categoryFilter);
        sessionStorage.setItem("tech_page", currentPage.toString());
        sessionStorage.setItem("tech_date_from", courseDateFrom);
        sessionStorage.setItem("tech_date_to", courseDateTo);
    }, [searchTerm, categoryFilter, currentPage, courseDateFrom, courseDateTo]);

    useEffect(() => {
        sessionStorage.setItem("act_search", candidateSearchTerm);
        sessionStorage.setItem("act_category", activityCategoryFilter);
        sessionStorage.setItem("act_status", statusFilter);
        sessionStorage.setItem("act_page", candidateCurrentPage.toString());
        sessionStorage.setItem("act_date_from", activityDateFrom);
        sessionStorage.setItem("act_date_to", activityDateTo);
        localStorage.setItem("act_domain", activityDomainFilter);
    }, [candidateSearchTerm, activityCategoryFilter, statusFilter, candidateCurrentPage, activityDateFrom, activityDateTo, activityDomainFilter]);

    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [currentPage]);

    // Also scroll for activity table pagination
    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [candidateCurrentPage]);
    // Handle search change - CLIENT-SIDE
    const handleSearchChange = (value: string) => {
        setSearchTerm(value);
        courseTable.clearSelection();
    };

    // Handle candidate search change - CLIENT-SIDE
    const handleCandidateSearchChange = (value: string) => {
        setCandidateSearchTerm(value);
        setCandidateCurrentPage(1);
        setExpandedRows([]);
    };

    // Handle category change - CLIENT-SIDE
    const handleCategoryChange = (value: string) => {
        setCategoryFilter(value);
        courseTable.clearSelection();
        setCurrentPage(1);
    };

    // Handle activity category change - CLIENT-SIDE
    const handleActivityCategoryChange = (value: string) => {
        setActivityCategoryFilter(value);
        setCandidateCurrentPage(1);
    };
    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setCandidateCurrentPage(1);
    };
    const handleActivityDomainFilterChange = (value: string) => {
    setActivityDomainFilter(value);
    localStorage.setItem("act_domain", value);
    setCandidateCurrentPage(1);
};

    //  COURSE DATE FILTER HANDLERS
    const handleCourseDateFromChange = (value: string) => {
        if (value && !isValidDate(value)) return;
        setCourseDateFrom(value);
        setCurrentPage(1);
        courseTable.clearSelection();
    };

    const handleCourseDateToChange = (value: string) => {
        if (value && !isValidDate(value)) return;
        setCourseDateTo(value);
        setCurrentPage(1);
        courseTable.clearSelection();
    };

    const clearCourseDateFilter = () => {
        setCourseDateFrom("");
        setCourseDateTo("");
        setCurrentPage(1);
        courseTable.clearSelection();
    };

    // ACTIVITY DATE FILTER HANDLERS
    const handleActivityDateFromChange = (value: string) => {
        if (value && !isValidDate(value)) return;
        setActivityDateFrom(value);
        setCandidateCurrentPage(1);
    };

    const handleActivityDateToChange = (value: string) => {
        if (value && !isValidDate(value)) return;
        setActivityDateTo(value);
        setCandidateCurrentPage(1);
    };

    const clearActivityDateFilter = () => {
        setActivityDateFrom("");
        setActivityDateTo("");
        setCandidateCurrentPage(1);
    };

    // Handle row selection - DATABASE-STYLE
    const handleRowSelected = (rows: Technology[]) => {
        courseTable.setSelectedRows(rows);
    };

    const openDeleteConfirmation = ({
        title,
        description,
        confirmText,
        onConfirm
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
        setDeleteConfirmation(prev => ({
            ...prev,
            open: false,
            onConfirm: null
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
        if (typeof apiError?.data?.detail === "string" && apiError.data.detail.trim()) {
            return apiError.data.detail;
        }
        return fallback;
    };

    // Handle bulk delete
    const handleDeleteSelected = () => {
        if (courseTable.selectedRows.length === 0) {
            toast({
                title: "No Selection",
                description: "Please select at least one technology to delete",
                duration: 3000
            });
            return;
        }

        openDeleteConfirmation({
            title: "Are you sure?",
            description: `You are about to delete ${courseTable.selectedRows.length} selected technology(ies)!`,
            confirmText: "Yes, delete them!",
            onConfirm: async () => {
                try {
                    const technologyIds = courseTable.selectedRows.map((row: Technology) => row.id);

                    await bulkDeleteTechnologies(technologyIds).unwrap();

                    toast({
                        title: "Success",
                        description: `${courseTable.selectedRows.length} technologies deleted successfully`,
                        duration: 3000,
                        variant: "success",
                    });

                    courseTable.clearSelection();
                    refetchTechnologies();
                } catch (error: unknown) {
                    console.error("Error deleting technologies:", error);

                    toast({
                        title: "Failed",
                        description: getDeleteErrorMessage(error, "Failed to delete technologies. Please try again."),
                        variant: "destructive",
                        duration: 3000
                    });
                }
            }
        });
    };

    // Handle single technology delete
    const handleDeleteTechnology = (id: number) => {
        const techName = technologies.find(t => t.id === id)?.name || 'this technology';
        openDeleteConfirmation({
            title: "Are you sure?",
            description: `Do you want to delete "${techName}"?`,
            confirmText: "Yes, delete it!",
            onConfirm: async () => {
                try {
                    await deleteTechnology(id).unwrap();
                    toast({
                        title: "Success",
                        description: "Technology deleted successfully",
                        variant: "success",
                        duration: 3000
                    });

                    refetchTechnologies();
                } catch (error: unknown) {
                    console.error("Error deleting technology:", error);

                    toast({
                        title: "Delete Failed",
                        description: getDeleteErrorMessage(error, "Failed to delete technology. Please try again."),
                        variant: "destructive",
                        duration: 3000,
                    });
                }
            }
        });
    };

    // Clear all filters - CLIENT-SIDE
    const clearFilters = () => {
        setSearchTerm("");
        setCategoryFilter("All Categories");
        setCourseDateFrom("");
        setCourseDateTo("");
        setCourseFilterPanelOpen(false);
        courseTable.clearSelection();
        setCurrentPage(1);

    
        sessionStorage.removeItem("tech_search");
        sessionStorage.removeItem("tech_category");
        sessionStorage.removeItem("tech_page");
        sessionStorage.removeItem("tech_date_from");
        sessionStorage.removeItem("tech_date_to");
    };

    // Clear candidate filters
    const clearCandidateFilters = () => {
        setCandidateSearchTerm("");
        setActivityCategoryFilter("All Categories");
        setStatusFilter("all");
        setActivityDateFrom("");
        setActivityDateTo("");
        setActivityDomainFilter("all");
        setActivityFilterPanelOpen(false);
        setCandidateCurrentPage(1);
        setExpandedRows([]);

        
        sessionStorage.removeItem("act_search");
        sessionStorage.removeItem("act_category");
        sessionStorage.removeItem("act_status");
        sessionStorage.removeItem("act_page");
        sessionStorage.removeItem("act_date_from");
        sessionStorage.removeItem("act_date_to");
        localStorage.removeItem("act_domain");
    };
    // Handle icon file selection
    const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIconFile(file);
            setIconPreview(URL.createObjectURL(file));
        }
    };

    // Handle form submission
    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast({
                title: "Validation Error",
                description: "Please enter a course name",
                variant: "destructive",
                duration: 3000
            });
            return;
        }

        setIsSubmitting(true);
        try {
            if (iconFile) {
                // Multipart: new image file being uploaded
                const fd = new FormData();
                fd.append('name', formData.name);
                fd.append('category', formData.category);
                fd.append('description', formData.description || '');
                fd.append('icon', iconFile);

                if (editingTech) {
                    await updateTechnology({ id: editingTech.id, data: fd }).unwrap();
                } else {
                    await createTechnology(fd).unwrap();
                }
            } else {
                // JSON payload
                const payload: Record<string, any> = {
                    name: formData.name,
                    category: formData.category,
                    description: formData.description || null,
                };

                if (iconMode === 'iconify' && iconKey.trim()) {
                    payload.icon_key = iconKey.trim();
                    if (editingTech && existingIconUrl) {
                        payload.clear_icon = true;
                    }
                } else if (iconMode === 'none') {
                    payload.icon_key = null;
                    if (editingTech && existingIconUrl) {
                        payload.clear_icon = true;
                    }
                }

                if (editingTech) {
                    await updateTechnology({ id: editingTech.id, data: payload }).unwrap();
                } else {
                    await createTechnology(payload).unwrap();
                }
            }

            if (editingTech) {
                toast({ title: "Success", description: "Course updated successfully", variant: "success", duration: 3000 });
            } else {
                toast({ title: "Success", description: "Course added successfully", variant: "success", duration: 3000 });
            }

            await refetchTechnologies();
            resetForm();
            setIsDialogOpen(false);

        } catch (error: any) {
            console.error("Error saving course:", error);

            let errorMessage = "Please try again.";
            if (error.data?.detail) {
                errorMessage = error.data.detail;
            } else if (error.data) {
                const fieldErrors = Object.values(error.data).flat();
                errorMessage = fieldErrors.join(', ');
            }

            toast({
                title: `Failed to ${editingTech ? 'update' : 'add'} course`,
                description: errorMessage,
                variant: "destructive",
                duration: 3000
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setFormData({
            name: "",
            category: "frontend",
            description: ""
        });
        setEditingTech(null);
        setIconMode('none');
        setIconFile(null);
        setIconKey('');
        setIconPreview('');
        setExistingIconUrl('');
    };

    // Handle edit
    const handleEdit = (tech: Technology) => {
        setEditingTech(tech);
        setFormData({
            name: tech.name,
            category: tech.category || "frontend",
            description: tech.description || ""
        });
        setIconFile(null);
        setIconPreview('');
        if (tech.icon_url) {
            setIconMode('upload');
            setExistingIconUrl(tech.icon_url);
            setIconKey('');
        } else if (tech.icon_key) {
            setIconMode('iconify');
            setIconKey(tech.icon_key);
            setExistingIconUrl('');
        } else {
            setIconMode('none');
            setIconKey('');
            setExistingIconUrl('');
        }
        setIsDialogOpen(true);
    };

    const handleRowClick = (tech: Technology) => {
        navigate(`/admin/technologies/${tech.id}`);
    };

    const handleAddNew = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    // Format date for display
    const formatDate = (dateString: string) =>
        formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, "Not Started");

    const getCategoryLabel = (categoryValue: string) => {
        if (!categoryValue) return "Not set";
        const category = CATEGORY_CHOICES.find(c => c.value === categoryValue);
        return category ? category.label : categoryValue;
    };

    const getCategoryColor = (category: string) => {
        if (!category) return "bg-slate-100 text-slate-700";

        const colorMap: Record<string, string> = {
            'frontend': 'bg-blue-100 text-blue-800',
            'backend': 'bg-green-100 text-green-800',
            'fullstack': 'bg-purple-100 text-purple-800',
            'database': 'bg-orange-100 text-orange-800',
            'devops': 'bg-red-100 text-red-800',
            'cloud': 'bg-cyan-100 text-cyan-800',
            'mobile_android': 'bg-emerald-100 text-emerald-800',
            'mobile_ios': 'bg-indigo-100 text-indigo-800',
            'programming': 'bg-pink-100 text-pink-800',
            'framework': 'bg-amber-100 text-amber-800',
        };

        return colorMap[category] || 'bg-slate-100 text-slate-700';
    };

    // Get status based on progress
    const getStatus = (progress: number) => {
        if (progress === 0) return 'assigned';
        if (progress >= 100) return 'completed';
        return 'in_progress';
    };

    // Get status display label
    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            'assigned': 'Assigned',
            'in_progress': 'In Progress',
            'completed': 'Completed'
        };
        return labels[status] || status;
    };

    // Get status color
    const getStatusColor = (status: string) => {
        const colorMap: Record<string, string> = {
            'assigned': 'bg-amber-100 text-amber-800',
            'in_progress': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800'
        };
        return colorMap[status] || 'bg-slate-100 text-slate-700';
    };

    // APPLY DATE FILTER TO COURSES (CLIENT-SIDE)
    const filteredTechnologies = useMemo(() => {
    let filtered = technologies;

    //  FIXED: Apply category filter first
    if (categoryFilter !== "All Categories") {
        // Find the category value that matches the selected label
        const selectedCategory = CATEGORY_CHOICES.find(c => c.label === categoryFilter);
        if (selectedCategory) {
            filtered = filtered.filter(tech => tech.category === selectedCategory.value);
        }
    }

    // Apply date filter by created_at
    if (courseDateFrom || courseDateTo) {
        filtered = filtered.filter(tech => {
            const createdDate = tech.created_at ? new Date(tech.created_at) : null;
            if (!createdDate) return false;

            if (courseDateFrom && isValidDate(courseDateFrom)) {
                const fromDate = new Date(courseDateFrom + "T00:00:00");
                if (createdDate < fromDate) return false;
            }

            if (courseDateTo && isValidDate(courseDateTo)) {
                const toDate = new Date(courseDateTo + "T23:59:59");
                if (createdDate > toDate) return false;
            }

            return true;
        });
    }

    return filtered;
}, [technologies, categoryFilter, courseDateFrom, courseDateTo]);

    const sortedCourseRows = useMemo(() => {
        if (courseSortMode === "default") return filteredTechnologies;
        const rows = [...filteredTechnologies];
        rows.sort((a, b) => {
            switch (courseSortMode) {
                case "name_asc":
                    return (a.name || "").localeCompare(b.name || "");
                case "name_desc":
                    return (b.name || "").localeCompare(a.name || "");
                case "category_asc":
                    return (a.category || "").localeCompare(b.category || "");
                case "category_desc":
                    return (b.category || "").localeCompare(a.category || "");
                case "created_desc": {
                    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return db - da;
                }
                case "created_asc": {
                    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
                    return da - db;
                }
                case "questions_desc":
                    return (b.total_questions || 0) - (a.total_questions || 0);
                case "questions_asc":
                    return (a.total_questions || 0) - (b.total_questions || 0);
                default:
                    return 0;
            }
        });
        return rows;
    }, [filteredTechnologies, courseSortMode]);

    // CLIENT-SIDE PAGINATION for courses
    const totalTechnologies = techData?.count ?? sortedCourseRows.length;
    const totalPages = Math.max(Math.ceil(totalTechnologies / ITEMS_PER_PAGE), 1);
    const paginatedTech = sortedCourseRows;

    // Sync client-side pagination into courseTable state for DynamicTable
    useEffect(() => {
        courseTable.updatePaginationFromResponse(
            totalTechnologies,
            currentPage < totalPages ? "next" : null,
            currentPage > 1 ? "prev" : null,
            currentPage
        );
    }, [totalTechnologies, totalPages, currentPage]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);
    // DynamicTable columns for courses
    const courseColumns: TableColumn<Technology>[] = useMemo(
        () => [
            {
                id: "name",
                name: "Course",
                selector: (row: Technology) => row.name,
                sortable: true,
                wrap: true,
                grow: 2,
                minWidth: "240px",
                omit: !courseColumnVisibility.name,
                cell: (row: Technology) => (
                    <div
                        onClick={() => handleRowClick(row)}
                        className="flex min-w-0 cursor-pointer items-center gap-3"
                    >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-100">
                            <TechnologyIcon name={row.name} iconUrl={row.icon_url} iconKey={row.icon_key} size={24} fallbackMonogram />
                        </span>
                        <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-slate-800 transition-colors hover:text-brand-violet">
                                {row.name}
                            </div>
                            {row.description ? (
                                <div className="mt-0.5 line-clamp-1 max-w-[280px] text-[11px] text-slate-400">{row.description}</div>
                            ) : (
                                <div className="mt-0.5 text-[11px] italic text-slate-300">No description</div>
                            )}
                        </div>
                    </div>
                ),
            },
            {
                id: "category",
                name: "Category",
                selector: (row: Technology) => row.category,
                sortable: true,
                minWidth: "140px",
                omit: !courseColumnVisibility.category,
                cell: (row: Technology) => (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getCategoryColor(row.category)}`}>
                        {getCategoryLabel(row.category)}
                    </span>
                ),
            },
            {
                id: "questions",
                name: "Questions",
                selector: (row: Technology) => row.total_questions || 0,
                sortable: true,
                center: true,
                width: "110px",
                omit: !courseColumnVisibility.questions,
                cell: (row: Technology) => {
                    const q = row.total_questions || 0;
                    return (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
                                q ? "bg-violet-50 text-brand-violet ring-violet-100" : "bg-amber-50 text-amber-600 ring-amber-100"
                            )}
                        >
                            <BookOpen className="h-3.5 w-3.5" />
                            {q}
                        </span>
                    );
                },
            },
            {
                id: "candidates",
                name: "Enrolled",
                selector: (row: Technology) => row.total_assigned_users || 0,
                sortable: true,
                center: true,
                width: "110px",
                omit: !courseColumnVisibility.candidates,
                cell: (row: Technology) => {
                    const u = row.total_assigned_users || 0;
                    return (
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
                                u ? "bg-sky-50 text-sky-700 ring-sky-100" : "bg-slate-50 text-slate-400 ring-slate-100"
                            )}
                        >
                            <Users className="h-3.5 w-3.5" />
                            {u}
                        </span>
                    );
                },
            },
            {
                id: "status",
                name: "Status",
                sortable: false,
                minWidth: "150px",
                omit: !courseColumnVisibility.status,
                cell: (row: Technology) => {
                    const q = row.total_questions || 0;
                    const u = row.total_assigned_users || 0;
                    const s =
                        q === 0
                            ? { label: "Setup needed", cls: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", hint: "Add questions to make this course usable." }
                            : u === 0
                                ? { label: "Ready", cls: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", hint: "Has questions but no candidates assigned yet." }
                                : { label: "Active", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", hint: "Has questions and assigned candidates." };
                    return (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", s.cls)}>
                                    <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                                    {s.label}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{s.hint}</TooltipContent>
                        </Tooltip>
                    );
                },
            },
            {
                id: "created",
                name: "Created",
                selector: (row: Technology) => row.created_at,
                sortable: true,
                width: "120px",
                omit: !courseColumnVisibility.created,
                cell: (row: Technology) => (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-600">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {courseRelativeDate(row.created_at)}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>{formatDate(row.created_at)}</TooltipContent>
                    </Tooltip>
                ),
            },
            {
                id: "actions",
                name: <div className="w-full text-right">Actions</div>,
                omit: !courseColumnVisibility.actions,
                cell: (row: Technology) => (
                    <div className="flex w-full items-center justify-end gap-1">
                        <RowActionIcon
                            label="View course"
                            onClick={() => navigate(`/admin/technologies/${row.id}`)}
                            className="hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet"
                        >
                            <Eye className="h-4 w-4" />
                        </RowActionIcon>
                        <RowActionIcon
                            label="Edit course"
                            onClick={() => handleEdit(row)}
                            className="hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
                        >
                            <Edit className="h-4 w-4" />
                        </RowActionIcon>
                        <RowActionIcon
                            label="Assign to candidates"
                            onClick={() => navigate(`/admin/assign-study-materials/${row.id}`)}
                            className="hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
                        >
                            <UserPlus className="h-4 w-4" />
                        </RowActionIcon>
                        <RowActionIcon
                            label="Delete course"
                            onClick={() => handleDeleteTechnology(row.id)}
                            className="hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                        >
                            <Trash2 className="h-4 w-4" />
                        </RowActionIcon>
                    </div>
                ),
                ignoreRowClick: true,
                minWidth: "180px",
                right: true,
            },
        ],
        [
            courseColumnVisibility,
            handleRowClick,
            handleEdit,
            navigate,
            handleDeleteTechnology,
            getCategoryLabel,
            getCategoryColor,
            formatDate,
        ]
    );

    const activityColumns: TableColumn<any>[] = useMemo(
        () => [
            {
                id: "candidate",
                name: "Candidate",
                selector: (row: any) => row.name,
                sortable: true,
                grow: 1.4,
                minWidth: "210px",
                omit: !activityColumnVisibility.candidate,
                cell: (row: any) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold text-white">
                            {activityInitials(row.name)}
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-slate-800">{row.name}</div>
                            <div className="truncate text-[11px] text-slate-500">{row.email}</div>
                        </div>
                    </div>
                ),
            },
            {
                id: "course",
                name: "Course",
                selector: (row: any) => row.courseName,
                sortable: true,
                minWidth: "160px",
                omit: !activityColumnVisibility.course,
                cell: (row: any) => (
                    <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 ring-1 ring-slate-100">
                            <TechnologyIcon name={row.courseName} size={16} fallbackMonogram />
                        </span>
                        <span className="truncate text-xs font-medium text-slate-700">{row.courseName}</span>
                    </div>
                ),
            },
            {
                id: "status",
                name: "Stage",
                selector: (row: any) => row.status || "",
                sortable: true,
                minWidth: "150px",
                omit: !activityColumnVisibility.status,
                cell: (row: any) => {
                    const meta = ACTIVITY_STAGE[row.status] || ACTIVITY_STAGE.assigned;
                    return (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", meta.cls)}>
                                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                                    {meta.label}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>{meta.hint}</TooltipContent>
                        </Tooltip>
                    );
                },
            },
            {
                id: "progress",
                name: "Progress",
                selector: (row: any) => row.progress || 0,
                sortable: true,
                minWidth: "160px",
                omit: !activityColumnVisibility.progress,
                cell: (row: any) => {
                    const p = Math.round(row.progress || 0);
                    return (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="w-full max-w-[150px]">
                                    <div className="mb-1 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-medium text-slate-500">{row.completed} of {row.total} questions</span>
                                        <span className="text-[11px] font-bold text-slate-700">{p}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                        <div
                                            className={cn("h-full rounded-full", p >= 100 ? "bg-emerald-500" : p >= 50 ? "bg-sky-500" : p > 0 ? "bg-amber-500" : "bg-slate-300")}
                                            style={{ width: `${p}%` }}
                                        />
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Completed {row.completed} of {row.total} questions ({p}%)</TooltipContent>
                        </Tooltip>
                    );
                },
            },
            {
                id: "done",
                name: "Questions",
                center: true,
                width: "110px",
                omit: !activityColumnVisibility.done,
                cell: (row: any) => (
                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-100">
                        {row.completed} / {row.total}
                    </span>
                ),
            },
            {
                id: "assigned",
                name: "Assigned",
                selector: (row: any) => row.assigned_at || "",
                sortable: true,
                width: "120px",
                omit: !activityColumnVisibility.assigned,
                cell: (row: any) =>
                    row.assigned_at ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-xs text-slate-600">{courseRelativeDate(row.assigned_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatDate(row.assigned_at)}</TooltipContent>
                        </Tooltip>
                    ) : (
                        <span className="text-xs text-slate-300">—</span>
                    ),
            },
            {
                id: "due",
                name: "Deadline",
                selector: (row: any) => row.due_at || "",
                sortable: true,
                minWidth: "130px",
                omit: !activityColumnVisibility.due,
                cell: (row: any) => {
                    const dl = activityDueInfo(row.due_at, row.progress || 0);
                    return (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className={cn("text-xs", dl.cls)}>{dl.text}</span>
                            </TooltipTrigger>
                            <TooltipContent>{row.due_at ? `Due ${formatDate(row.due_at)}` : "No deadline set"}</TooltipContent>
                        </Tooltip>
                    );
                },
            },
            {
                id: "lastActive",
                name: "Last Seen",
                selector: (row: any) => row.last_active_at || "",
                sortable: true,
                width: "120px",
                omit: !activityColumnVisibility.lastActive,
                cell: (row: any) =>
                    row.last_active_at ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-xs text-slate-600">{courseRelativeDate(row.last_active_at)}</span>
                            </TooltipTrigger>
                            <TooltipContent>Last active on {formatDate(row.last_active_at)}</TooltipContent>
                        </Tooltip>
                    ) : (
                        <span className="text-xs text-slate-400">Never opened</span>
                    ),
            },
            {
                id: "actions",
                name: <div className="mr-2 w-full text-right">Actions</div>,
                omit: !activityColumnVisibility.actions,
                cell: (row: any) => (
                    <div className="flex w-full items-center justify-end">
                        <RowActionsMenu>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/learner/${row.userId}`); }}>
                                <Eye />
                                View candidate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/admin/assign-study-materials/${row.userId}`); }}>
                                <BookOpen />
                                Assign courses
                            </DropdownMenuItem>
                        </RowActionsMenu>
                    </div>
                ),
                ignoreRowClick: true,
                width: "90px",
                right: true,
            },
        ],
        [activityColumnVisibility, navigate, formatDate]
    );

    const activityTableData = useMemo(() => {
        let rows: any[] = (activityData?.results || []).map((row: any) => ({
    ...row,
    status: getStatus(row.progress || 0),
}));
                    
          

        // Client-side filter based on candidateSearchTerm and category

        // Apply search filter
        if (candidateSearchTerm.trim()) {
            rows = rows.filter(row =>
                row?.name?.toLowerCase().includes(candidateSearchTerm.toLowerCase()) ||
                row?.email?.toLowerCase().includes(candidateSearchTerm.toLowerCase()) ||
                row?.courseName?.toLowerCase().includes(candidateSearchTerm.toLowerCase())
            );
        }

        // Apply category filter
        if (activityCategoryFilter !== "All Categories") {
            rows = rows.filter(row =>
                getCategoryLabel(row.category) === activityCategoryFilter
            );
        }

        // Apply status filter
        if (statusFilter !== "all") {
            rows = rows.filter(row => row.status === statusFilter);
        }
        if (activityDomainFilter !== "all") {
            rows = rows.filter(row =>
                row?.email?.toLowerCase().endsWith(`@${activityDomainFilter}`)
    );
}
        
        // APPLY DATE FILTER TO ACTIVITY TABLE (by assigned_at)
        if (activityDateFrom || activityDateTo) {
            rows = rows.filter(row => {
                const assignedDate = row.assigned_at ? new Date(row.assigned_at) : null;
                if (!assignedDate) return false;

                if (activityDateFrom && isValidDate(activityDateFrom)) {
                    const fromDate = new Date(activityDateFrom + "T00:00:00");
                    if (assignedDate < fromDate) return false;
                }

                if (activityDateTo && isValidDate(activityDateTo)) {
                    const toDate = new Date(activityDateTo + "T23:59:59");
                    if (assignedDate > toDate) return false;
                }

                return true;
            });
        }

        const ts = (d: string | null | undefined) => (d ? new Date(d).getTime() : 0);

        rows.sort((a, b) => {
            switch (activitySortMode) {
                case "default":
                case "last_active_desc":
                    return ts(b.last_active_at) - ts(a.last_active_at);
                case "last_active_asc":
                    return ts(a.last_active_at) - ts(b.last_active_at);
                case "name_asc":
                    return (a.name || "").localeCompare(b.name || "");
                case "name_desc":
                    return (b.name || "").localeCompare(a.name || "");
                case "course_asc":
                    return (a.courseName || "").localeCompare(b.courseName || "");
                case "course_desc":
                    return (b.courseName || "").localeCompare(a.courseName || "");
                case "progress_desc":
                    return (b.progress || 0) - (a.progress || 0);
                case "progress_asc":
                    return (a.progress || 0) - (b.progress || 0);
                case "status_asc":
                    return (a.status || "").localeCompare(b.status || "");
                case "status_desc":
                    return (b.status || "").localeCompare(a.status || "");
                case "assigned_desc":
                    return ts(b.assigned_at) - ts(a.assigned_at);
                case "assigned_asc":
                    return ts(a.assigned_at) - ts(b.assigned_at);
                case "due_desc":
                    return ts(b.due_at) - ts(a.due_at);
                case "due_asc":
                    return ts(a.due_at) - ts(b.due_at);
                default:
                    return ts(b.last_active_at) - ts(a.last_active_at);
            }
        });

        return rows;
    }, [activityData, candidateSearchTerm, activityCategoryFilter, statusFilter, activityDateFrom, activityDateTo, activityDomainFilter, activitySortMode]);

    // Calculate pagination for activity table
    const totalActivityRows = activityData?.count || 0;
    const totalActivityPages = Math.ceil(totalActivityRows / ITEMS_PER_PAGE);
    const paginatedActivityData = activityTableData;
     

    // Sync client-side pagination into activityTable state for DynamicTable
    useEffect(() => {
        activityTable.updatePaginationFromResponse(
            totalActivityRows,
            candidateCurrentPage < totalActivityPages ? "next" : null,
            candidateCurrentPage > 1 ? "prev" : null,
            candidateCurrentPage
        );
    }, [totalActivityRows, totalActivityPages, candidateCurrentPage]);

    // Check if activity filters are applied
    const isFilterApplied = searchTerm.trim() || categoryFilter !== "All Categories" || courseDateFrom || courseDateTo;
    const isActivityFilterApplied = candidateSearchTerm.trim() || activityCategoryFilter !== "All Categories" || statusFilter !== "all" || activityDateFrom || activityDateTo || activityDomainFilter !== "all";

    // Filter configs for courses
    const courseFilterConfigs: FilterSelectConfig[] = [
        {
            id: "course-category",
            label: "Category",
            value: categoryFilter,
            onChange: handleCategoryChange,
            options: [
                { value: "All Categories", label: "All Categories" },
                ...CATEGORY_CHOICES.map((category) => ({
                    value: category.label,
                    label: category.label,
                })),
            ],
        },
    ];

   

    // Check if activity filters are apply
    const activityFilterConfigs: FilterSelectConfig[] = [
        {
            id: "activity-category",
            label: "Category",
            value: activityCategoryFilter,
            onChange: handleActivityCategoryChange,
            options: [
                { value: "All Categories", label: "All Categories" },
                ...CATEGORY_CHOICES.map((category) => ({
                    value: category.label,
                    label: category.label,
                })),
            ],
        },
        
        {
            id: "activity-status",
            label: "Status",
            value: statusFilter,
            onChange: handleStatusFilterChange,
            options: [
                { value: "all", label: "All Status" },
                { value: "assigned", label: "Assigned" },
                { value: "in_progress", label: "In Progress" },
                { value: "completed", label: "Completed" },
            ],
        },
        {
            id: "activity-domain",
            label: "Filter by Email Domain",
            value: activityDomainFilter,
            onChange: handleActivityDomainFilterChange,
            options: emailDomains.map((domain) => ({
                value: domain,
                label: domain === "all" ? "All Domains" : domain,
            })),
        },
    ];

    // Filter chips for courses
    const courseFilterChips: ActiveFilterChip[] = [
        ...(searchTerm.trim()
            ? [{
                id: "course-search",
                label: "Search",
                value: searchTerm,
                onRemove: () => setSearchTerm(""),
                tone: "blue" as const,
                quoteValue: true,
            }]
            : []),
        ...(categoryFilter !== "All Categories"
            ? [{
                id: "course-category",
                label: "Category",
                value: categoryFilter,
                onRemove: () => setCategoryFilter("All Categories"),
                tone: "green" as const,
            }]
            : []),
        ...(courseDateFrom
            ? [{
                id: "course_date_from",
                label: "Created From",
                value: new Date(courseDateFrom + "T00:00:00").toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
                onRemove: () => clearCourseDateFilter(),
                tone: "amber" as const,
            }]
            : []),
        ...(courseDateTo
            ? [{
                id: "course_date_to",
                label: "Created To",
                value: new Date(courseDateTo + "T00:00:00").toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
                onRemove: () => clearCourseDateFilter(),
                tone: "amber" as const,
            }]
            : []),
    ];

    // Filter chips for activities
   
    const activityFilterChips: ActiveFilterChip[] = [
        ...(candidateSearchTerm.trim()
            ? [{
                id: "activity-search",
                label: "Search",
                value: candidateSearchTerm,
                onRemove: () => setCandidateSearchTerm(""),
                tone: "blue" as const,
                quoteValue: true,
            }]
            : []),
        ...(activityCategoryFilter !== "All Categories"
            ? [{
                id: "activity-category",
                label: "Category",
                value: activityCategoryFilter,
                onRemove: () => setActivityCategoryFilter("All Categories"),
                tone: "emerald" as const,
            }]
            : []),
        ...(statusFilter !== "all"
            ? [{
                id: "activity-status",
                label: "Status",
                value: getStatusLabel(statusFilter),
                onRemove: () => setStatusFilter("all"),
                tone: "purple" as const,
            }]
            : []),
        ...(activityDateFrom
            ? [{
                id: "activity_date_from",
                label: "Assigned From",
                value: new Date(activityDateFrom + "T00:00:00").toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
                onRemove: () => clearActivityDateFilter(),
                tone: "amber" as const,
            }]
            : []),
        ...(activityDateTo
            ? [{
                id: "activity_date_to",
                label: "Assigned To",
                value: new Date(activityDateTo + "T00:00:00").toLocaleDateString('en-GB', {
                    day: '2-digit', month: 'short', year: 'numeric',
                }),
                onRemove: () => clearActivityDateFilter(),
                tone: "amber" as const,
            }]
            : []),
        ...(activityDomainFilter !== "all"
            ? [{
                id: "activity-domain",
                label: "Domain",
                value: activityDomainFilter,
                onRemove: () => {
                    setActivityDomainFilter("all");
                    localStorage.removeItem("act_domain");
                },
                tone: "blue" as const,
            }]
            : []),
    ];

    const technologiesErrorMessage = useMemo(() => {
        const queryError = techQueryError as ApiErrorWithDetail | undefined;
        return queryError?.data?.detail || "Failed to load technologies data. Please try again.";
    }, [techQueryError]);

    if (isTechError) {
        return (
            <AdminLayout>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                    <div className="max-w-9xl mx-auto">
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center">
                            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-600" />
                            <h1 className="text-base font-semibold text-red-900">
                                Unable to load technologies
                            </h1>
                            <p className="mt-1 text-sm text-red-700">
                                {technologiesErrorMessage}
                            </p>
                            <button
                                onClick={() => refetchTechnologies()}
                                className="mx-auto mt-4 inline-flex items-center gap-2 rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-100"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <TooltipProvider delayDuration={150}>
            <div className="w-full">
                <div className="mx-auto max-w-[1600px] space-y-6">
                    {/* Branded header */}
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                            <GraduationCap className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold text-slate-900">Courses</h1>
                            {activeTab === "courses" ? (
                                <p className="text-xs text-slate-500">
                                    Showing{" "}
                                    <span className="font-semibold text-slate-700">{paginatedTech.length}</span> of{" "}
                                    <span className="font-semibold text-slate-700">{totalTechnologies}</span> courses
                                    {totalQuestions > 0 ? (
                                        <>
                                            {" "}· <span className="font-semibold text-slate-700">{totalQuestions}</span> questions
                                        </>
                                    ) : null}
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500">Manage courses, categories, candidate enrolments &amp; learning activity.</p>
                            )}
                        </div>
                    </div>

                    {/* KPI cards */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <StatCard index={0} label="Total Courses" value={totalTechnologies} icon={GraduationCap} gradient="from-brand-purple to-brand-violet" />
                        <StatCard index={1} label="Enrolments" value={totalActivityRows} icon={Users} gradient="from-[#0955a7] to-[#2f9cd4]" />
                        <StatCard index={2} label="Categories" value={CATEGORY_CHOICES.length} icon={Layers} gradient="from-[#0e9f6e] to-[#23c366]" />
                        <StatCard index={3} label="Showing" value={activeTab === "courses" ? paginatedTech.length : paginatedActivityData.length} icon={ClipboardCheck} gradient="from-[#5b21b6] to-[#9d5bd2]" />
                    </div>

                    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200/70 bg-slate-100/80 p-1 shadow-inner">
                        {[
                            { key: "courses" as const, label: "Courses", icon: GraduationCap, count: totalTechnologies },
                            { key: "activities" as const, label: "Activity", icon: Users, count: totalActivityRows },
                        ].map((tab) => {
                            const active = activeTab === tab.key;
                            const TabIcon = tab.icon;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleTabChange(tab.key)}
                                    className={cn(
                                        "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200",
                                        active ? "text-brand-purple" : "text-slate-500 hover:text-brand-violet"
                                    )}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="techTabIndicator"
                                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                            className="absolute inset-0 -z-0 rounded-lg bg-white shadow-[0_2px_8px_-2px_rgba(61,7,95,0.25)] ring-1 ring-black/5"
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-2">
                                        <TabIcon className={cn("h-4 w-4", active ? "text-brand-violet" : "text-slate-400")} />
                                        {tab.label}
                                        <span
                                            className={cn(
                                                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                                                active ? "bg-violet-100 text-brand-violet" : "bg-slate-200 text-slate-500"
                                            )}
                                        >
                                            {tab.count}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {activeTab === "courses" && (
                        <>
                            <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
                                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="relative min-w-0 flex-1">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                            aria-hidden
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search by course name or category…"
                                            value={searchTerm}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                            aria-label="Search courses"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-9 gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                                >
                                                    <ArrowUpDown className="h-4 w-4" />
                                                    Sort
                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Sort courses</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={courseSortMode}
                                                    onValueChange={(v) => setCourseSortMode(v as CourseSortMode)}
                                                >
                                                    <DropdownMenuRadioItem value="default">Default order</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="name_asc">Name (A–Z)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="name_desc">Name (Z–A)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="category_asc">Category (A–Z)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="category_desc">Category (Z–A)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="created_desc">Created (newest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="created_asc">Created (oldest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="questions_desc">Questions (high to low)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="questions_asc">Questions (low to high)</DropdownMenuRadioItem>
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white shadow-sm"
                                                    aria-label="Column visibility"
                                                >
                                                    <Columns2 className="h-4 w-4 text-slate-600" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.name}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, name: Boolean(c) }))
                                                    }
                                                >
                                                    Name
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.category}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, category: Boolean(c) }))
                                                    }
                                                >
                                                    Category
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.questions}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, questions: Boolean(c) }))
                                                    }
                                                >
                                                    Questions
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.candidates}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, candidates: Boolean(c) }))
                                                    }
                                                >
                                                    Enrolled
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.status}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, status: Boolean(c) }))
                                                    }
                                                >
                                                    Status
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.created}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, created: Boolean(c) }))
                                                    }
                                                >
                                                    Created
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={courseColumnVisibility.actions}
                                                    onCheckedChange={(c) =>
                                                        setCourseColumnVisibility((prev) => ({ ...prev, actions: Boolean(c) }))
                                                    }
                                                >
                                                    Actions
                                                </DropdownMenuCheckboxItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-violet px-4 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
                                            onClick={handleAddNew}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Course
                                        </Button>

                                        {/* <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white shadow-sm"
                                                    aria-label="More page actions"
                                                >
                                                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => void refetchTechnologies()}>
                                                    <RefreshCw className="h-4 w-4" />
                                                    Refresh list
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu> */}
                                    </div>
                                </div>

                                <DynamicTable
                                    data={paginatedTech}
                                    columns={courseColumns}
                                    horizontalScroll
                                    pagination={courseTable.pagination}
                                    showPagination={false}
                                    rowsPerPage={COURSES_PAGE_SIZE}
                                    isLoading={isLoading || isLoadingCandidates}
                                    selectable
                                    onSelectionChange={handleRowSelected}
                                    toggleCleared={courseTable.toggleCleared}
                                    onRowClick={handleRowClick}
                                    itemLabel="technologies"
                                    loadingMessage="Loading technologies..."
                                    noDataMessage="No technologies found"
                                    noDataSubMessage={
                                        isFilterApplied
                                            ? "No technologies match the applied filters. Try adjusting or clearing your filters."
                                            : "No technology data available yet. Start by adding your first course."
                                    }
                                    isFilterApplied={!!isFilterApplied}
                                    onClearFilters={clearFilters}
                                    className="rounded-none border-0 shadow-none"
                                    customTableStyles={listPageTableStyles}
                                    bulkActionBar={
                                        courseTable.selectedRows.length > 0 ? (
                                            <div className="flex items-center justify-between border-b border-slate-200 bg-violet-50/60 px-4 py-2.5">
                                                <span className="text-xs font-medium text-brand-violet">
                                                    {courseTable.selectedRows.length} course(s) selected
                                                </span>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteSelected}
                                                        className="flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
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
                        </>
                    )}
                    {activeTab === "activities" && (
                        <>
                            <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]">
                                <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                    <div className="relative min-w-0  flex-1 w-full">
                                        <Search
                                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                                            aria-hidden
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search by candidate name, email, or course…"
                                            value={candidateSearchTerm}
                                            onChange={(e) => handleCandidateSearchChange(e.target.value)}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                            aria-label="Search activity"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    className="h-9 gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                                                >
                                                    <ArrowUpDown className="h-4 w-4" />
                                                    Sort
                                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Sort activity</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuRadioGroup
                                                    value={activitySortMode}
                                                    onValueChange={(v) => setActivitySortMode(v as ActivitySortMode)}
                                                >
                                                    <DropdownMenuRadioItem value="default">Default (last active)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="name_asc">Candidate (A–Z)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="name_desc">Candidate (Z–A)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="course_asc">Course (A–Z)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="course_desc">Course (Z–A)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="progress_desc">Progress (high to low)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="progress_asc">Progress (low to high)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="status_asc">Status (A–Z)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="status_desc">Status (Z–A)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="assigned_desc">Assigned (newest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="assigned_asc">Assigned (oldest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="due_asc">Due date (soonest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="due_desc">Due date (latest first)</DropdownMenuRadioItem>
                                                    <DropdownMenuRadioItem value="last_active_asc">Last active (oldest first)</DropdownMenuRadioItem>
                                                </DropdownMenuRadioGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white shadow-sm"
                                                    aria-label="Column visibility"
                                                >
                                                    <Columns2 className="h-4 w-4 text-slate-600" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.candidate}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, candidate: Boolean(c) }))
                                                    }
                                                >
                                                    Candidate
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.course}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, course: Boolean(c) }))
                                                    }
                                                >
                                                    Course
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.progress}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, progress: Boolean(c) }))
                                                    }
                                                >
                                                    Progress
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.status}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, status: Boolean(c) }))
                                                    }
                                                >
                                                    Status
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.done}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, done: Boolean(c) }))
                                                    }
                                                >
                                                    Questions
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.assigned}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, assigned: Boolean(c) }))
                                                    }
                                                >
                                                    Assigned
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.due}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, due: Boolean(c) }))
                                                    }
                                                >
                                                    Due
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.lastActive}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, lastActive: Boolean(c) }))
                                                    }
                                                >
                                                    Last active
                                                </DropdownMenuCheckboxItem>
                                                <DropdownMenuCheckboxItem
                                                    checked={activityColumnVisibility.actions}
                                                    onCheckedChange={(c) =>
                                                        setActivityColumnVisibility((prev) => ({ ...prev, actions: Boolean(c) }))
                                                    }
                                                >
                                                    Actions
                                                </DropdownMenuCheckboxItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 gap-1.5 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
                                            onClick={() => navigate("/admin/candidate/add")}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Candidate
                                        </Button>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white shadow-sm"
                                                    aria-label="More page actions"
                                                >
                                                    <MoreHorizontal className="h-4 w-4 text-slate-600" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => void refetchActivity()}>
                                                    <RefreshCw className="h-4 w-4" />
                                                    Refresh list
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() =>
                                                        navigate("/admin/bulk-upload", { state: { defaultTab: "candidates" } })
                                                    }
                                                >
                                                    <Upload className="h-4 w-4" />
                                                    Import candidates
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu> */}
                                    </div>
                                </div>

                                {/* Filters — compact and always visible */}
                                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
                                    <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                                        <Filter className="h-3.5 w-3.5" />
                                        Filters
                                    </span>
                                    <Dropdown
                                        value={activityCategoryFilter}
                                        onChange={handleActivityCategoryChange}
                                        options={[
                                            { value: "All Categories", label: "All Categories" },
                                            ...CATEGORY_CHOICES.map((category) => ({ value: category.label, label: category.label })),
                                        ] as DropdownOption<string>[]}
                                        icon={Layers}
                                        className="w-[170px]"
                                        buttonClassName="h-8 !py-0 text-xs"
                                    />
                                    <Dropdown
                                        value={statusFilter}
                                        onChange={handleStatusFilterChange}
                                        options={[
                                            { value: "all", label: "All Status" },
                                            { value: "assigned", label: "Assigned" },
                                            { value: "in_progress", label: "In Progress" },
                                            { value: "completed", label: "Completed" },
                                        ] as DropdownOption<string>[]}
                                        icon={ClipboardCheck}
                                        className="w-[150px]"
                                        buttonClassName="h-8 !py-0 text-xs"
                                    />
                                    <Dropdown
                                        value={activityDomainFilter}
                                        onChange={handleActivityDomainFilterChange}
                                        options={emailDomains.map((domain) => ({
                                            value: domain,
                                            label: domain === "all" ? "All Domains" : domain,
                                        })) as DropdownOption<string>[]}
                                        icon={Filter}
                                        className="w-[160px]"
                                        buttonClassName="h-8 !py-0 text-xs"
                                    />
                                    <DateRangePicker
                                        from={activityDateFrom}
                                        to={activityDateTo}
                                        onChange={(f, t) => {
                                            handleActivityDateFromChange(f);
                                            handleActivityDateToChange(t);
                                        }}
                                        placeholder="Assigned: any date"
                                        className="w-[200px]"
                                        buttonClassName="h-8 !py-0 text-xs"
                                    />

                                    {activityFilterChips.length > 0 && (
                                        <>
                                            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
                                            {activityFilterChips.map((chip) => (
                                                <span
                                                    key={chip.id}
                                                    className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-brand-violet ring-1 ring-inset ring-violet-100"
                                                >
                                                    <span className="opacity-70">{chip.label}:</span>
                                                    {chip.quoteValue ? `"${chip.value}"` : chip.value}
                                                    <button
                                                        type="button"
                                                        onClick={chip.onRemove}
                                                        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
                                                        aria-label={`Remove ${chip.label}`}
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={clearCandidateFilters}
                                                className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                                            >
                                                Clear all
                                            </button>
                                        </>
                                    )}
                                </div>

                                <DynamicTable
                                    data={paginatedActivityData}
                                    columns={activityColumns}
                                    horizontalScroll
                                    pagination={activityTable.pagination}
                                    rowsPerPage={ITEMS_PER_PAGE}
                                    isLoading={isLoading || isLoadingCandidates}
                                    onPageChange={(page) => setCandidateCurrentPage(page)}
                                    itemLabel="activities"
                                    loadingMessage="Loading activity data..."
                                    noDataMessage="No activity found"
                                    noDataSubMessage={
                                        isActivityFilterApplied
                                            ? "No data available for the selected filters. Try adjusting your filters or search query."
                                            : "No activity data available yet."
                                    }
                                    isFilterApplied={!!isActivityFilterApplied}
                                    onClearFilters={clearCandidateFilters}
                                    className="rounded-none border-0 shadow-none"
                                    customTableStyles={listPageTableStyles}
                                />
                            </div>
                        </>
                    )}

                    {/* Add/Edit Dialog */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent className="max-w-lg gap-0 rounded-2xl p-0">
                            <DialogHeader className="space-y-0 border-b border-slate-100 px-6 py-5 text-left">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                                        <GraduationCap className="h-5 w-5" />
                                    </span>
                                    <div className="min-w-0">
                                        <DialogTitle className="text-lg font-bold tracking-tight text-slate-900">
                                            {editingTech ? 'Edit Course' : 'Add New Course'}
                                        </DialogTitle>
                                        <DialogDescription className="mt-0.5 text-sm text-slate-500">
                                            {editingTech
                                                ? "Update this course's details and icon."
                                                : 'Create a course that candidates can be assigned to.'}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-5 px-6 py-5">
                                {/* Course name */}
                                <div>
                                    <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Course Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g. React, Node.js, AWS"
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                    />
                                    <p className="mt-1 text-xs text-slate-400">The technology or skill this course covers.</p>
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Category</label>
                                    <Dropdown
                                        value={formData.category}
                                        onChange={(v) => setFormData({ ...formData, category: v })}
                                        options={CATEGORY_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
                                        placeholder="Select a category"
                                        buttonClassName="h-10"
                                    />
                                    <p className="mt-1 text-xs text-slate-400">Used to group and filter courses across the platform.</p>
                                </div>

                                {/* Description */}
                                <div>
                                    <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-slate-700">
                                        Short Description
                                    </label>
                                    <textarea
                                        id="description"
                                        rows={3}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="What does this course cover? (optional)"
                                        className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                    />
                                </div>

                                {/* Display icon group */}
                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                    <p className="text-sm font-semibold text-slate-700">Display Icon</p>
                                    <p className="mb-3 mt-0.5 text-xs text-slate-400">Shown on course cards and lists — choose how to set it.</p>

                                    {/* Mode segmented control */}
                                    <div className="mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                                        {(['none', 'upload', 'iconify'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => {
                                                    setIconMode(mode);
                                                    if (mode !== 'upload') { setIconFile(null); setIconPreview(''); }
                                                    if (mode !== 'iconify') setIconKey('');
                                                }}
                                                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${iconMode === mode ? 'bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {mode === 'none' ? 'Auto' : mode === 'upload' ? 'Upload' : 'Iconify'}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Upload mode */}
                                    {iconMode === 'upload' && (
                                        <div className="space-y-2">
                                            {(iconPreview || existingIconUrl) && (
                                                <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2">
                                                    <img
                                                        src={iconPreview || existingIconUrl}
                                                        alt="icon preview"
                                                        className="h-9 w-9 rounded-md border border-slate-200 object-contain p-0.5"
                                                    />
                                                    <span className="flex-1 truncate text-xs text-slate-500">
                                                        {iconFile?.name || 'Current icon'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setIconFile(null); setIconPreview(''); setExistingIconUrl(''); setIconMode('none'); }}
                                                        className="text-xs font-semibold text-rose-500 hover:text-rose-700"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            )}
                                            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-brand-violet/50 hover:bg-violet-50/60 hover:text-brand-violet">
                                                <Upload className="h-4 w-4" />
                                                Choose image
                                                <input
                                                    type="file"
                                                    accept="image/*,.svg"
                                                    className="hidden"
                                                    onChange={handleIconFileChange}
                                                />
                                            </label>
                                            <p className="text-xs text-slate-400">PNG, SVG, or JPG.</p>
                                        </div>
                                    )}

                                    {/* Iconify mode */}
                                    {iconMode === 'iconify' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    value={iconKey}
                                                    onChange={(e) => setIconKey(e.target.value)}
                                                    placeholder="e.g. logos:react"
                                                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                                />
                                                {iconKey.trim() && (
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white">
                                                        <Icon icon={iconKey.trim()} width={24} height={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">
                                                Browse names at{' '}
                                                <a href="https://icon-sets.iconify.design" target="_blank" rel="noopener noreferrer" className="font-medium text-brand-violet underline">
                                                    iconify.design
                                                </a>
                                            </p>
                                        </div>
                                    )}

                                    {/* Auto mode — live preview */}
                                    {iconMode === 'none' && (
                                        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white p-2">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200">
                                                <TechnologyIcon name={formData.name || 'help'} size={24} />
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                {formData.name.trim()
                                                    ? `Auto-resolved from "${formData.name}"`
                                                    : 'Enter a course name to preview the auto icon.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <DialogFooter className="gap-2 border-t border-slate-100 px-6 py-4">
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || !formData.name.trim()}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isSubmitting
                                        ? (editingTech ? 'Updating…' : 'Adding…')
                                        : (editingTech ? 'Update Course' : 'Add Course')}
                                </button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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

export default Technologies;
