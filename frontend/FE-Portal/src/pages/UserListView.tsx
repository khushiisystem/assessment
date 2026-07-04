import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  Download,
  Plus,
  Upload,
  Trash2,
  FileText,
  ClipboardCheck,
  BookOpen,
  Calendar,
  Search,
  Filter,
  ArrowUpDown,
  Columns2,
  MoreHorizontal,
  ChevronDown,
  Check,
  Ban,
  Clock,
  CircleCheck,
  Menu,
  Phone,
  Users,
  Layers,
  SlidersHorizontal,
  Briefcase,
} from "lucide-react";
import { tokenStorage } from "@/lib/tokenStorage";
import AdminLayout from "@/components/AdminLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { RowActionIcon } from "@/components/common/RowActionIcon";
import { DateRangePicker } from "@/components/common/DateRangePicker";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatDateValue } from "@/utils/commonFunctions";
import { useNavigate, useNavigationType } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  useGetCandidatesQuery,
  useLazyGetCandidateResumeQuery,
  useDeleteCandidateMutation,
  useBulkDeleteCandidatesMutation,
  useGetTechnologiesQuery,
} from "@/store";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
import { PageHeader } from "@/components/common/PageHeader";
import { ActiveFilterChip } from "@/components/common/SearchFilterPanel";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
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

const ITEMS_PER_PAGE = 20;

const isValidDate = (date: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
};

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  profile: string;
  date_joined: string;
  last_login?: string | null;
  is_active?: boolean;
  resume_s3_url: string;
  learning_assignments: Array<{
    technology_id: number;
    technology_name: string;
  }>;
  assessment_assignments: unknown[];
}

type CandidatesResponse = {
  next?: string | null;
  results?: {
    candidates?: User[];
  };
};

interface Technology {
  id: number;
  name: string;
  category: string;
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

type StoredUserWithOrganization = {
  organization_id?: number | string | null;
  organizationId?: number | string | null;
  organization?: {
    id?: number | string | null;
  } | null;
};

type SortMode =
  | "default"
  | "name_asc"
  | "name_desc"
  | "email_asc"
  | "email_desc"
  | "joined_desc"
  | "joined_asc";

type ColumnVisibilityKey = "avatar" | "nameEmail" | "loginStatus" | "details" | "technologies" | "status" | "courses" | "assessments" | "resume" | "actions";

const AVATAR_PALETTES = [
  "bg-violet-500 text-white",
  "bg-emerald-500 text-white",
  "bg-sky-500 text-white",
  "bg-amber-500 text-white",
  "bg-rose-500 text-white",
  "bg-indigo-500 text-white",
];

function initialsFromUser(user: User): string {
  const a = (user.first_name || "").trim().charAt(0);
  const b = (user.last_name || "").trim().charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  const u = (user.username || user.email || "?").trim();
  return u.slice(0, 2).toUpperCase();
}

function avatarPaletteClass(id: number): string {
  return AVATAR_PALETTES[Math.abs(id) % AVATAR_PALETTES.length];
}

/** Short relative "joined" label. */
function joinedAgo(dateString?: string): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function getProfileDisplayName(profile: string | null | undefined): string {
  const raw = (profile ?? "").trim();
  if (!raw) return "Not set";
  const lower = raw.toLowerCase();
  if (lower === "none" || lower === "n/a" || lower === "-" || lower === "null") return "Not set";
  return raw;
}

function getOrganizationId(user: StoredUserWithOrganization | null): string | null {
  const value = user?.organization_id ?? user?.organizationId ?? user?.organization?.id;
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function escapeXml(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function columnName(index: number): string {
  let name = "";
  let num = index + 1;
  while (num > 0) {
    const rem = (num - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    num = Math.floor((num - 1) / 26);
  }
  return name;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function dateToDosTime(date: Date): { date: number; time: number } {
  return {
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function createZip(files: Array<{ name: string; content: string }>): Blob {
  const encoder = new TextEncoder();
  const now = dateToDosTime(new Date());
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, now.time);
    writeUint16(localView, 12, now.date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, contentBytes.length);
    writeUint32(localView, 22, contentBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    local.set(nameBytes, 30);

    chunks.push(local, contentBytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, now.time);
    writeUint16(centralView, 14, now.date);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, contentBytes.length);
    writeUint32(centralView, 24, contentBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    central.set(nameBytes, 46);

    centralChunks.push(central);
    offset += local.length + contentBytes.length;
  });

  const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return new Blob(
    [
      ...chunks.map((chunk) => new Uint8Array(chunk)),
      ...centralChunks.map((chunk) => new Uint8Array(chunk)),
      new Uint8Array(end),
    ],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );
}

function buildCandidatesXlsx(candidates: User[]): Blob {
  const headers = ["ID", "First Name", "Last Name", "Username", "Email", "Phone", "Profile", "Technologies", "Joined Date"];
  const rows = candidates.map((candidate) => [
    candidate.id,
    candidate.first_name,
    candidate.last_name,
    candidate.username,
    candidate.email,
    candidate.phone,
    candidate.profile,
    candidate.learning_assignments?.map((item) => item.technology_name).join(", "),
    candidate.date_joined,
  ]);

  const sheetRows = [headers, ...rows]
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const ref = `${columnName(cellIndex)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return createZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Candidates" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`,
    },
  ]);
}

function ProfileNameBadge({ profile }: { profile: string | null | undefined }) {
  const displayName = getProfileDisplayName(profile);
  const hasProfile = displayName !== "Not set";

  return (
    <span
      title={hasProfile ? displayName : "No profile assigned"}
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        hasProfile
          ? "bg-violet-50 text-brand-violet ring-violet-100"
          : "bg-slate-50 text-slate-400 ring-slate-100"
      )}
    >
      <Briefcase className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{displayName}</span>
    </span>
  );
}

const UserListView = () => {
  const navigate = useNavigate();
  // Direct add + bulk import are Super-Admin only; org admins invite instead.
  const isSuperAdmin = tokenStorage.getUser<{ role?: string }>()?.role === "super_admin";
  const navType = useNavigationType();
  const { toast } = useToast();

  const [searchName, setSearchName] = useState(() => (navType === "POP" ? sessionStorage.getItem("cand_search") || "" : ""));
  const [filterProfile, setFilterProfile] = useState(() => (navType === "POP" ? sessionStorage.getItem("cand_profile") || "all" : "all"));
  const [filterTechnology, setFilterTechnology] = useState(() => (navType === "POP" ? sessionStorage.getItem("cand_tech") || "all" : "all"));
  const [joinedDateFrom, setJoinedDateFrom] = useState(() => (navType === "POP" ? sessionStorage.getItem("cand_date_from") || "" : ""));
  const [joinedDateTo, setJoinedDateTo] = useState(() => (navType === "POP" ? sessionStorage.getItem("cand_date_to") || "" : ""));
  const [filterDomain, setFilterDomain] = useState(() => localStorage.getItem("cand_domain") || "all");
  const [currentPage, setCurrentPage] = useState(() => (navType === "POP" ? parseInt(sessionStorage.getItem("cand_page") || "1", 10) : 1));
  const [emailDomains] = useState<string[]>(["all", "Zecdata.com" ,"SkilTechy.com", "technomancerai.com", "bestpeers.com"]);
  const [profiles, setProfiles] = useState<string[]>([]);
  const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnVisibilityKey, boolean>>({
    avatar: true,
    nameEmail: true,
    loginStatus: true,
    status: true,
    technologies: true,
    courses: true,
    assessments: true,
    resume: true,
    details: true,
    actions: true,
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    onConfirm: null,
  });

  const [debouncedSearch, setDebouncedSearch] = useState(searchName);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchName), 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchName]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch, filterProfile, filterTechnology, filterDomain, joinedDateFrom, joinedDateTo]);

  const candidatesEndpoint = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
    if (filterProfile !== "all") params.append("profile", filterProfile);
    if (filterTechnology !== "all" && filterTechnology) params.append("technology", filterTechnology);
    if (filterDomain !== "all" && filterDomain) {
  if (filterDomain === "SkilTechy.com") {
    ["Zecdata.com", "technomancerai.com", "bestpeers.com"].forEach((d) =>
      params.append("exclude_email_domains", d)
    );
    } else {
      params.append("email_domains", filterDomain);
    }
  }
    if (joinedDateFrom && isValidDate(joinedDateFrom)) params.append("joined_from", joinedDateFrom);
    if (joinedDateTo && isValidDate(joinedDateTo)) params.append("joined_to", joinedDateTo);
    if (currentPage > 1) params.append("page", currentPage.toString());
    const qs = params.toString();
    return `/my-admin/candidates/${qs ? `?${qs}` : ""}`;
  }, [debouncedSearch, filterProfile, filterTechnology, filterDomain, joinedDateFrom, joinedDateTo, currentPage]);

  const { data: candidatesData, isLoading: candidatesLoading, isFetching, error: candidatesError, refetch: refetchCandidates } =
    useGetCandidatesQuery(candidatesEndpoint);

  const { data: techData } = useGetTechnologiesQuery({});
  const [deleteCandidate] = useDeleteCandidateMutation();
  const [bulkDeleteCandidates] = useBulkDeleteCandidatesMutation();
  const [getCandidateResume] = useLazyGetCandidateResumeQuery();
  const technologies = useMemo(() => (techData?.results || []) as Technology[], [techData]);

  const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });

  const users = useMemo(() => candidatesData?.results?.candidates || [], [candidatesData]);

  const sortedUsers = useMemo(() => {
    if (sortMode === "default") return users;
    const list = [...users];
    const nameKey = (u: User) => `${u.first_name || ""} ${u.last_name || ""}`.trim().toLowerCase() || (u.username || "").toLowerCase();
    const emailKey = (u: User) => (u.email || "").toLowerCase();
    const joinedKey = (u: User) => new Date(u.date_joined || 0).getTime();
    switch (sortMode) {
      case "name_asc":
        list.sort((a, b) => nameKey(a).localeCompare(nameKey(b)));
        break;
      case "name_desc":
        list.sort((a, b) => nameKey(b).localeCompare(nameKey(a)));
        break;
      case "email_asc":
        list.sort((a, b) => emailKey(a).localeCompare(emailKey(b)));
        break;
      case "email_desc":
        list.sort((a, b) => emailKey(b).localeCompare(emailKey(a)));
        break;
      case "joined_desc":
        list.sort((a, b) => joinedKey(b) - joinedKey(a));
        break;
      case "joined_asc":
        list.sort((a, b) => joinedKey(a) - joinedKey(b));
        break;
      default:
        break;
    }
    return list;
  }, [users, sortMode]);

  useEffect(() => {
    if (!candidatesData) return;
    const totalCount = candidatesData.count || 0;
    const next = candidatesData.next || null;
    const previous = candidatesData.previous || null;
    table.updatePaginationFromResponse(totalCount, next, previous, currentPage);

    const candidates = candidatesData.results?.candidates || [];
    const uniqueProfiles = [...new Set(candidates.map((c: User) => (c.profile === null || c.profile === "" ? "__EMPTY__" : c.profile)))];
    const mapped = uniqueProfiles.map((p: string) => (p === "__EMPTY__" ? "" : p));
    setProfiles((prev) => {
      const merged = [...new Set([...prev, ...mapped])];
      merged.sort((a: string, b: string) => {
        if (a === "" && b !== "") return 1;
        if (b === "" && a !== "") return -1;
        return a.localeCompare(b);
      });
      return merged;
    });

    sessionStorage.setItem("cand_search", searchName);
    sessionStorage.setItem("cand_profile", filterProfile);
    sessionStorage.setItem("cand_tech", filterTechnology);
    localStorage.setItem("cand_domain", filterDomain);
    sessionStorage.setItem("cand_page", currentPage.toString());
    sessionStorage.setItem("cand_date_from", joinedDateFrom);
    sessionStorage.setItem("cand_date_to", joinedDateTo);
  }, [candidatesData, currentPage]);

  useEffect(() => {
    table.setIsLoading(candidatesLoading || isFetching);
  }, [candidatesLoading, isFetching]);

  useEffect(() => {
    if (candidatesError) {
      toast({ title: "Failed", description: "Failed to fetch candidates", variant: "destructive", duration: 3000 });
    }
  }, [candidatesError]);

  const handleAssignClick = useCallback((user: User) => {
    navigate(`/admin/assign-assessment/${user.id}`);
  }, [navigate]);

  const handleSearchChange = (value: string) => {
    setSearchName(value);
    table.clearSelection();
  };

  const handleProfileFilterChange = (value: string) => {
    setFilterProfile(value);
    table.clearSelection();
  };

  const handleTechnologyFilterChange = (value: string) => {
    setFilterTechnology(value);
    table.clearSelection();
  };

  const handleDomainFilterChange = (value: string) => {
    setFilterDomain(value);
    table.clearSelection();
  };

  const handleJoinedDateFromChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setJoinedDateFrom(value);
    table.clearSelection();
    setCurrentPage(1);
  };

  const handleJoinedDateToChange = (value: string) => {
    if (value && !isValidDate(value)) return;
    setJoinedDateTo(value);
    table.clearSelection();
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setJoinedDateFrom("");
    setJoinedDateTo("");
    table.clearSelection();
    setCurrentPage(1);
    sessionStorage.removeItem("cand_date_from");
    sessionStorage.removeItem("cand_date_to");
  };

  const clearFilters = () => {
    setSearchName("");
    setFilterProfile("all");
    setFilterTechnology("all");
    setFilterDomain("all");
    setJoinedDateFrom("");
    setJoinedDateTo("");
    setCurrentPage(1);
    table.clearSelection();

    sessionStorage.removeItem("cand_search");
    sessionStorage.removeItem("cand_profile");
    sessionStorage.removeItem("cand_tech");
    localStorage.removeItem("cand_domain");
    sessionStorage.removeItem("cand_page");
    sessionStorage.removeItem("cand_date_from");
    sessionStorage.removeItem("cand_date_to");
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
    if (typeof apiError?.data?.detail === "string" && apiError.data.detail.trim()) {
      return apiError.data.detail;
    }
    return fallback;
  };

  const handlePageChange = (pageNum: number) => {
    setCurrentPage(pageNum);
  };

  const deleteSingle = (id: number) => {
    openDeleteConfirmation({
      title: "Are you sure?",
      description: "Do You Want To Delete This!",
      confirmText: "Yes, delete it!",
      onConfirm: async () => {
        try {
          await deleteCandidate(id).unwrap();
          toast({
            title: "Success",
            description: "Candidate deleted successfully",
            duration: 3000,
            variant: "success",
          });
          refetchCandidates();
        } catch (error: unknown) {
          console.error(error);
          toast({
            title: "Failed",
            description: getDeleteErrorMessage(error, "Failed to delete candidate"),
            variant: "destructive",
            duration: 3000,
          });
        }
      },
    });
  };

  const bulkDelete = () => {
    if (table.selectedRows.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one candidate to delete",
        duration: 3000,
      });
      return;
    }

    openDeleteConfirmation({
      title: "Delete All Selected?",
      description: `Do You Want To  delete ${table.selectedRows.length} candidates!`,
      confirmText: "Yes, delete them!",
      onConfirm: async () => {
        try {
          const candidateIds = table.selectedRows.map((row: User) => row.id);

          await bulkDeleteCandidates(candidateIds).unwrap();

          toast({
            title: "Success",
            description: `${table.selectedRows.length} candidates deleted successfully`,
            duration: 3000,
            variant: "success",
          });
          refetchCandidates();
          table.clearSelection();
        } catch (error: unknown) {
          console.error(error);
          toast({
            title: "Failed",
            description: getDeleteErrorMessage(error, "Failed to delete candidates"),
            variant: "destructive",
            duration: 3000,
          });
        }
      },
    });
  };

  const handleExportCandidates = async () => {
    try {
      const params = new URLSearchParams();
      const user = tokenStorage.getUser<StoredUserWithOrganization>();
      const organizationId = getOrganizationId(user);

      if (organizationId) params.append("organization_id", organizationId);
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      if (filterProfile !== "all") params.append("profile", filterProfile);
      if (filterTechnology !== "all" && filterTechnology) params.append("technology", filterTechnology);
      if (filterDomain !== "all" && filterDomain) {
        if (filterDomain === "SkilTechy.com") {
          ["Zecdata.com", "technomancerai.com", "bestpeers.com"].forEach((d) =>
            params.append("exclude_email_domains", d)
          );
        } else {
          params.append("email_domains", filterDomain);
        }
      }
      if (joinedDateFrom && isValidDate(joinedDateFrom)) params.append("joined_from", joinedDateFrom);
      if (joinedDateTo && isValidDate(joinedDateTo)) params.append("joined_to", joinedDateTo);

      const token = tokenStorage.getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/v1/";
      const headers = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(organizationId ? { "X-Organization-Id": organizationId } : {}),
      };
      const exportedCandidates: User[] = [];
      let nextUrl: string | null = `${baseUrl}my-admin/candidates/${params.toString() ? `?${params.toString()}` : ""}`;

      while (nextUrl) {
        const response = await fetch(nextUrl, { method: "GET", headers });
        if (!response.ok) throw new Error("Export failed");

        const data = (await response.json()) as CandidatesResponse;
        exportedCandidates.push(...(data.results?.candidates || []));

        nextUrl = data.next || null;
      }

      const blob = buildCandidatesXlsx(exportedCandidates);
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", "candidates.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);

      toast({ title: "Success", description: "Candidates exported successfully!", variant: "success", duration: 3000 });
    } catch (error) {
      console.error(error);
      toast({ title: "Failed", description: "Failed to export candidates.", variant: "destructive", duration: 3000 });
    }
  };

  const formatDate = useCallback(
    (dateString: string) =>
      formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, dateString),
    []
  );

  const handleUserClick = useCallback((user: User) => {
    navigate(`/admin/learner/${user.id}`);
  }, [navigate]);

  const isFilterApplied = Boolean(
    searchName.trim() || filterProfile !== "all" || filterTechnology !== "all" || filterDomain !== "all" || joinedDateFrom || joinedDateTo
  );

  const activeFilterChips: ActiveFilterChip[] = useMemo(
    () => [
      ...(searchName.trim()
        ? [
            {
              id: "search",
              label: "Search",
              value: searchName,
              onRemove: () => setSearchName(""),
              tone: "blue" as const,
              quoteValue: true,
            },
          ]
        : []),
      ...(filterProfile !== "all"
        ? [
            {
              id: "profile",
              label: "Profile",
              value: filterProfile || "Empty Profile",
              onRemove: () => setFilterProfile("all"),
              tone: "green" as const,
            },
          ]
        : []),
      ...(filterTechnology !== "all"
        ? [
            {
              id: "technology",
              label: "Technology",
              value: filterTechnology,
              onRemove: () => setFilterTechnology("all"),
              tone: "purple" as const,
            },
          ]
        : []),
      ...(filterDomain !== "all"
        ? [
            {
              id: "domain",
              label: "Domain",
              value: filterDomain,
              onRemove: () => setFilterDomain("all"),
              tone: "amber" as const,
            },
          ]
        : []),
      ...(joinedDateFrom
        ? [
            {
              id: "joined_date_from",
              label: "Joined From",
              value: new Date(joinedDateFrom + "T00:00:00").toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              onRemove: () => clearDateFilter(),
              tone: "amber" as const,
            },
          ]
        : []),
      ...(joinedDateTo
        ? [
            {
              id: "joined_date_to",
              label: "Joined To",
              value: new Date(joinedDateTo + "T00:00:00").toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
              onRemove: () => clearDateFilter(),
              tone: "amber" as const,
            },
          ]
        : []),
    ],
    [searchName, filterProfile, filterTechnology, filterDomain, joinedDateFrom, joinedDateTo]
  );

  const openResume = useCallback(
    async (row: User) => {
      try {
        const data = await getCandidateResume(row.id).unwrap();
        if (data?.url) window.open(data.url, "_blank");
      } catch {
        toast({ title: "Error", description: "Failed to download resume.", variant: "destructive" });
      }
    },
    [getCandidateResume, toast]
  );

  const columns: TableColumn<User>[] = useMemo(
    () => [
      {
        id: "avatar",
        name: "",
        width: "48px",
        omit: !columnVisibility.avatar,
        sortable: false,
        cell: (row: User) => (
          <div className="flex justify-center">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold tracking-tight text-white shadow-sm"
              aria-hidden
            >
              {initialsFromUser(row)}
            </div>
          </div>
        ),
      },
      {
        id: "nameEmail",
        name: "Candidate",
        selector: (row: User) => `${row.first_name} ${row.last_name}`,
        sortable: false,
        grow: 1.4,
        minWidth: "210px",
        omit: !columnVisibility.nameEmail,
        wrap: true,
        cell: (row: User) => {
          const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.username;
          return (
            <button
              type="button"
              onClick={() => handleUserClick(row)}
              className="w-full rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/50 focus-visible:ring-offset-2"
            >
              <div className="font-semibold leading-tight text-slate-800 transition-colors hover:text-brand-violet">{fullName}</div>
              <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-500">{row.email}</div>
              {row.phone ? (
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                  <Phone className="h-3 w-3 shrink-0" />
                  {row.phone}
                </div>
              ) : null}
            </button>
          );
        },
      },
      {
        id: "status",
        name: "Role",
        minWidth: "150px",
        omit: !columnVisibility.status,
        sortable: false,
        cell: (row: User) => <ProfileNameBadge profile={row.profile} />,
      },
      {
        id: "loginStatus",
        name: "Status",
        minWidth: "130px",
        omit: !columnVisibility.loginStatus,
        sortable: false,
        cell: (row: User) => {
          const active = row.is_active !== false;
          // Disabled account → highest priority. Otherwise: logged in once vs.
          // invited-but-never-logged-in ("Pending").
          if (!active) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    <Ban className="h-3.5 w-3.5" />
                    Disabled
                  </span>
                </TooltipTrigger>
                <TooltipContent>Account is disabled — the candidate can't log in.</TooltipContent>
              </Tooltip>
            );
          }
          if (row.last_login) {
            return (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                    <CircleCheck className="h-3.5 w-3.5" />
                    Logged in
                  </span>
                </TooltipTrigger>
                <TooltipContent>Last login: {formatDate(row.last_login)}</TooltipContent>
              </Tooltip>
            );
          }
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
                  <Clock className="h-3.5 w-3.5" />
                  Pending
                </span>
              </TooltipTrigger>
              <TooltipContent>Invited {formatDate(row.date_joined)} — hasn't logged in yet.</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: "technologies",
        name: "Technologies",
        omit: !columnVisibility.technologies,
        sortable: false,
        grow: 1,
        minWidth: "180px",
        cell: (row: User) => {
          const techNames = row.learning_assignments?.map((a) => a.technology_name) ?? [];
          if (techNames.length === 0) {
            return <span className="text-xs text-slate-300">—</span>;
          }
          const max = 2;
          const shown = techNames.slice(0, max);
          const rest = techNames.length - shown.length;
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {shown.map((tech, index) => (
                <span
                  key={`${tech}-${index}`}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-1.5 pr-2 text-xs font-medium text-slate-700"
                >
                  <TechnologyIcon name={tech} size={16} />
                  <span className="max-w-[100px] truncate">{tech}</span>
                </span>
              ))}
              {rest > 0 && (
                <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                  +{rest}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "courses",
        name: "Courses",
        omit: !columnVisibility.courses,
        sortable: false,
        center: true,
        width: "94px",
        cell: (row: User) => {
          const n = row.learning_assignments?.length || 0;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
                n ? "bg-violet-50 text-brand-violet ring-violet-100" : "bg-slate-50 text-slate-400 ring-slate-100"
              )}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {n}
            </span>
          );
        },
      },
      {
        id: "assessments",
        name: "Tests",
        omit: !columnVisibility.assessments,
        sortable: false,
        center: true,
        width: "90px",
        cell: (row: User) => {
          const n = Array.isArray(row.assessment_assignments) ? row.assessment_assignments.length : 0;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset",
                n ? "bg-sky-50 text-sky-700 ring-sky-100" : "bg-slate-50 text-slate-400 ring-slate-100"
              )}
            >
              <ClipboardCheck className="h-3.5 w-3.5" />
              {n}
            </span>
          );
        },
      },
      {
        id: "resume",
        name: "Résumé",
        omit: !columnVisibility.resume,
        sortable: false,
        center: true,
        width: "104px",
        ignoreRowClick: true,
        cell: (row: User) =>
          row.resume_s3_url ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void openResume(row); }}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100 transition-colors hover:bg-emerald-100"
            >
              <FileText className="h-3.5 w-3.5" />
              View
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5" />
              —
            </span>
          ),
      },
      {
        id: "details",
        name: "Joined",
        omit: !columnVisibility.details,
        sortable: false,
        width: "130px",
        cell: (row: User) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex w-fit items-center gap-1.5 text-xs text-slate-600">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {joinedAgo(row.date_joined)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{formatDate(row.date_joined)}</TooltipContent>
          </Tooltip>
        ),
      },
      {
        id: "actions",
        name: "Actions",
        omit: !columnVisibility.actions,
        sortable: false,
        right: true,
        minWidth: "210px",
        ignoreRowClick: true,
        cell: (row: User) => (
          <div className="flex items-center justify-end gap-1">
            <RowActionIcon
              label="Assign assessment"
              onClick={() => handleAssignClick(row)}
              className="hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600"
            >
              <ClipboardCheck className="h-4 w-4" />
            </RowActionIcon>
            <RowActionIcon
              label="Assign study materials"
              onClick={() => navigate(`/admin/assign-study-materials/${row.id}`)}
              className="hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
            >
              <BookOpen className="h-4 w-4" />
            </RowActionIcon>
            <RowActionIcon
              label="Delete candidate"
              onClick={() => deleteSingle(row.id)}
              className="hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-4 w-4" />
            </RowActionIcon>
          </div>
        ),
      },
    ],
    [columnVisibility, navigate, handleUserClick, handleAssignClick, openResume, formatDate]
  );

  return (
    <AdminLayout>
      <div className="w-full font-sans antialiased text-slate-900">
        <TooltipProvider delayDuration={150}>
        <div className="mx-auto max-w-[1600px] space-y-6">
          {/* Branded header */}
          <PageHeader
            icon={Users}
            title="Candidates"
            description="View and manage all candidates and their learning progress."
          />

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} label="Total Candidates" value={candidatesData?.count || 0} icon={Users} gradient="from-brand-purple to-brand-violet" />
            <StatCard index={1} label="Showing" value={sortedUsers.length} icon={SlidersHorizontal} gradient="from-[#0955a7] to-[#2f9cd4]" />
            <StatCard index={2} label="Profiles" value={profiles.filter(Boolean).length} icon={ClipboardCheck} gradient="from-[#0e9f6e] to-[#23c366]" />
            <StatCard index={3} label="Courses" value={technologies.length} icon={Layers} gradient="from-[#5b21b6] to-[#9d5bd2]" />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={searchName}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                  aria-label="Search by name or email"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-lg border-slate-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      Sort
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Sort list</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
                      <DropdownMenuRadioItem value="default">Default order</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name_asc">Name (A–Z)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name_desc">Name (Z–A)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="email_asc">Email (A–Z)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="email_desc">Email (Z–A)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="joined_desc">Joined (newest first)</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="joined_asc">Joined (oldest first)</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-slate-200 bg-white shadow-sm"
                      aria-label="Column visibility"
                    >
                      <Columns2 className="h-4 w-4 text-gray-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.avatar}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, avatar: Boolean(c) }))}
                    >
                      Avatar
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.nameEmail}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, nameEmail: Boolean(c) }))}
                    >
                      Candidate
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.status}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, status: Boolean(c) }))}
                    >
                      Role
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.loginStatus}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, loginStatus: Boolean(c) }))}
                    >
                      Status
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.technologies}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, technologies: Boolean(c) }))}
                    >
                      Technologies
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.courses}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, courses: Boolean(c) }))}
                    >
                      Courses
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.assessments}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, assessments: Boolean(c) }))}
                    >
                      Tests
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.resume}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, resume: Boolean(c) }))}
                    >
                      Résumé
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.details}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, details: Boolean(c) }))}
                    >
                      Joined
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={columnVisibility.actions}
                      onCheckedChange={(c) => setColumnVisibility((prev) => ({ ...prev, actions: Boolean(c) }))}
                    >
                      Actions
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg bg-gradient-to-r from-brand-purple to-brand-violet px-4 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
                  onClick={() => navigate(isSuperAdmin ? "/admin/candidate/add" : "/admin/org/users/create")}
                >
                  <Plus className="h-4 w-4" />
                  {isSuperAdmin ? "Add Candidate" : "Invite Candidate"}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-lg border-slate-200 bg-white shadow-sm"
                      aria-label="More page actions"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-700" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {isSuperAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigate("/admin/bulk-upload", { state: { defaultTab: "candidates" } })}
                      >
                        <Upload className="h-4 w-4" />
                        Import candidates
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => void handleExportCandidates()}>
                      <Download className="h-4 w-4" />
                      Export candidates
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Filters — compact and always visible */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
              <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                <Filter className="h-3.5 w-3.5" />
                Filters
              </span>
              <Dropdown
                value={filterProfile}
                onChange={handleProfileFilterChange}
                options={[
                  { value: "all", label: "All Profiles" },
                  ...profiles.map((p) => ({ value: p || "", label: p || "Empty Profile" })),
                ] as DropdownOption<string>[]}
                icon={ClipboardCheck}
                className="w-[160px]"
                buttonClassName="h-8 !py-0 text-xs"
              />
              <Dropdown
                value={filterTechnology}
                onChange={handleTechnologyFilterChange}
                options={[
                  { value: "all", label: "All Technologies" },
                  ...technologies.map((tech) => ({ value: tech.name, label: tech.name })),
                ] as DropdownOption<string>[]}
                icon={Layers}
                className="w-[180px]"
                buttonClassName="h-8 !py-0 text-xs"
              />
              <Dropdown
                value={filterDomain}
                onChange={handleDomainFilterChange}
                options={emailDomains.map((domain) => ({
                  value: domain,
                  label: domain === "all" ? "All Domains" : domain,
                })) as DropdownOption<string>[]}
                icon={Filter}
                className="w-[160px]"
                buttonClassName="h-8 !py-0 text-xs"
              />
              <DateRangePicker
                from={joinedDateFrom}
                to={joinedDateTo}
                onChange={(f, t) => {
                  handleJoinedDateFromChange(f);
                  handleJoinedDateToChange(t);
                }}
                placeholder="Joined: any date"
                className="w-[200px]"
                buttonClassName="h-8 !py-0 text-xs"
              />

              {activeFilterChips.length > 0 && (
                <>
                  <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
                  {activeFilterChips.map((chip) => (
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
                  <button type="button" onClick={clearFilters} className="text-[11px] font-semibold text-red-600 hover:text-red-700">
                    Clear all
                  </button>
                </>
              )}
            </div>

            <DynamicTable
              data={sortedUsers}
              columns={columns}
              pagination={table.pagination}
              rowsPerPage={ITEMS_PER_PAGE}
              isLoading={table.isLoading}
              selectable
              onSelectionChange={(rows) => table.setSelectedRows(rows)}
              toggleCleared={table.toggleCleared}
              onPageChange={(page) => handlePageChange(page)}
              onRowClick={handleUserClick}
              itemLabel="candidates"
              loadingMessage="Loading candidates..."
              noDataMessage="No candidates found"
              isFilterApplied={Boolean(isFilterApplied)}
              onClearFilters={clearFilters}
              className="rounded-none border-0 shadow-none"
              customTableStyles={listPageTableStyles}
              bulkActionBar={
                table.selectedRows.length > 0 ? (
                  <div className="flex flex-col gap-3 border-b border-slate-200 bg-violet-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-brand-purple to-brand-violet text-white"
                        aria-hidden
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        {table.selectedRows.length} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled
                        className="h-9 gap-1.5 rounded-lg bg-blue-600 px-3 text-white opacity-50 shadow-sm"
                        title="Bulk approve is not available for candidates."
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled
                        className="h-9 gap-1.5 rounded-lg bg-orange-500 px-3 text-white opacity-50 shadow-sm"
                        title="Bulk reject is not available for candidates."
                      >
                        <Ban className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="h-9 gap-1.5 rounded-lg border-0 bg-rose-100 px-3 font-semibold text-rose-700 shadow-sm hover:bg-rose-200"
                        onClick={bulkDelete}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : undefined
              }
            />
          </div>
        </div>
        </TooltipProvider>
      </div>

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
export default UserListView;
