import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import AdminLayout from "@/components/AdminLayout";
import {
  Users,
  BookOpen,
  TrendingUp,
  ClipboardList,
  BarChart2,
  GraduationCap,
  LayoutDashboard,
  Plus,
  UserPlus,
  ArrowUpRight,
  Crown,
  ArrowRight,
  ShieldCheck,
  Building2,
} from "lucide-react";
import TechnologyCard from "@/components/TechnologyCard";
import { useNavigate } from "react-router-dom";
import { useGetAdminDashboardQuery } from "@/store/api/assessmentsApi";
import { useGetProfileQuery } from "@/store";
import { useGetTechnologiesQuery } from "@/store/api/technologiesApi";
import { CourseFilterBar, type CourseSort } from "@/components/dashboard/CourseFilterBar";
import SuperAdminDashboard from "@/pages/SuperAdminDashboard";
import OrgAdminDashboard from "@/pages/OrgAdminDashboard";
import { CountUp } from "@/components/dashboard/chartKit";
import { cn } from "@/lib/utils";
import { tokenStorage } from "@/lib/tokenStorage";
import { CARD_SHADOW } from "@/lib/uiStyles";

interface Technology {
  id: string;
  name: string;
  description: string;
  category: string;
  questionCount: number;
  assignedUsersCount: number;
}

type Tone = "violet" | "purple" | "indigo" | "orange" | "emerald" | "fuchsia";

type Kpi = {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  tone: Tone;
  footnote?: string;
  share?: number;
  onClick: () => void;
};

/* Soft per-tone styling so each card wears a light wash of its own brand color. */
const TINTS: Record<Tone, { surface: string; border: string; ring: string; chip: string }> = {
  violet: { surface: "from-white to-violet-50/70", border: "border-violet-100", ring: "ring-violet-100/70", chip: "bg-violet-100 text-violet-700" },
  purple: { surface: "from-white to-purple-50/70", border: "border-purple-100", ring: "ring-purple-100/70", chip: "bg-purple-100 text-purple-700" },
  indigo: { surface: "from-white to-indigo-50/70", border: "border-indigo-100", ring: "ring-indigo-100/70", chip: "bg-indigo-100 text-indigo-700" },
  orange: { surface: "from-white to-orange-50/70", border: "border-orange-100", ring: "ring-orange-100/70", chip: "bg-orange-100 text-orange-700" },
  emerald: { surface: "from-white to-emerald-50/70", border: "border-emerald-100", ring: "ring-emerald-100/70", chip: "bg-emerald-100 text-emerald-700" },
  fuchsia: { surface: "from-white to-fuchsia-50/70", border: "border-fuchsia-100", ring: "ring-fuchsia-100/70", chip: "bg-fuchsia-100 text-fuchsia-700" },
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<CourseSort>("featured");

  // Subscription (org_admin only) — preserved from develop
  const [currentSub, setCurrentSub] = useState<{ plan_name: string; plan_type: string; is_active: boolean; end_date: string | null } | null>(null);
  const [subUsage, setSubUsage] = useState<{ assessments_used: number; ai_interviews_used: number; assessments_limit: number; ai_interviews_limit: number } | null>(null);

  const user = tokenStorage.getUser<{ role: string; name?: string; email?: string }>();
  const isOrgAdmin = user?.role === "org_admin";
  const isSuperAdmin = user?.role === "super_admin";

  const { data: profile } = useGetProfileQuery();
  // Greet by first name; if there's no first name, fall back to the email.
  const userName =
    profile?.first_name ||
    user?.first_name ||
    user?.email ||
    profile?.email ||
    "Admin";

  // Access label: "Super Admin" for platform admins, org name (or "Organization Admin") for org admins
  const accessLabel = isSuperAdmin
    ? "Super Admin"
    : profile?.organization_name || (isOrgAdmin ? "Organization Admin" : "Admin");

  useEffect(() => {
    if (!isOrgAdmin) return;
    const fetchSub = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        if (!token) return;
        const res = await fetch("/v1/api/subscription/me/", {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentSub(data.subscription);
          setSubUsage(data.usage);
        }
      } catch {
        /* silent */
      }
    };
    fetchSub();
  }, [isOrgAdmin]);

  // Auto-fetch + cache — won't re-call on page revisit
  const { data: dashboardData, isLoading: dashLoading } = useGetAdminDashboardQuery();
  // Load all courses for the dashboard grid (browse + search across the full catalog, scrollable).
  const { data: techData, isLoading: techLoading } = useGetTechnologiesQuery({ page: 1, page_size: 1000 });

  const dashboardStats = dashboardData ?? {
    total_candidates: 0,
    total_assessments: 0,
    active_assessments: 0,
    total_questions: 0,
    completed_assessments: 0,
  };

  const technologies: Technology[] = useMemo(() => {
    const results = techData?.results || [];
    return results.map((tech: any) => ({
      id: tech.id,
      name: tech.name,
      description: tech.description,
      category: tech.category,
      questionCount: tech.total_questions ?? 0,
      assignedUsersCount: tech.total_assigned_users ?? 0,
    }));
  }, [techData]);

  /** True total course count from the API (not just the loaded page). */
  const totalCourses = techData?.count ?? technologies.length;

  const isLoading = dashLoading || techLoading;

  /* ----------------------------- derived data ----------------------------- */

  const completionRate = pct(
    dashboardStats.completed_assessments,
    dashboardStats.total_assessments
  );

  const activeShare = pct(
    dashboardStats.active_assessments,
    dashboardStats.total_assessments
  );

  /* ----------------------------- KPI cards ----------------------------- */

  const stats: Kpi[] = [
    {
      label: "Total Candidates",
      value: dashboardStats.total_candidates,
      icon: Users,
      gradient: "from-brand-purple to-brand-violet",
      tone: "violet",
      onClick: () => navigate("/admin/candidates"),
    },
    {
      label: "Total Assessments",
      value: dashboardStats.total_assessments,
      icon: ClipboardList,
      gradient: "from-[#5b21b6] to-[#8b5cf6]",
      tone: "purple",
      onClick: () => navigate("/admin/assessments"),
    },
    {
      label: "Total Questions",
      value: dashboardStats.total_questions,
      icon: BookOpen,
      gradient: "from-[#4338ca] to-[#6366f1]",
      tone: "indigo",
      onClick: () => navigate("/admin/questions"),
    },
    {
      label: "Active Assessments",
      value: dashboardStats.active_assessments,
      icon: BarChart2,
      gradient: "from-[#ff5a1f] to-[#ff8a4c]",
      tone: "orange",
      footnote: `of all assessments`,
      share: activeShare,
      onClick: () => navigate("/admin/assessments?status=active"),
    },
    {
      label: "Completed Assessments",
      value: dashboardStats.completed_assessments,
      icon: TrendingUp,
      gradient: "from-[#0e9f6e] to-[#23c366]",
      tone: "emerald",
      footnote: `completion rate`,
      share: completionRate,
      onClick: () => navigate("/admin/assessments?status=completed"),
    },
    {
      label: "Courses",
      value: technologies.length,
      icon: GraduationCap,
      gradient: "from-brand-violet to-[#a855f7]",
      tone: "fuchsia",
      onClick: () => navigate("/admin/technologies"),
    },
  ];

  // Distinct categories present in the data (with counts) for the filter bar
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    technologies.forEach((t) => {
      const key = (t.category || "").toLowerCase();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }, [technologies]);

  const filteredTechnologies = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const list = technologies.filter((tech) => {
      const matchesSearch = tech.name.toLowerCase().includes(term);
      const matchesCategory =
        categoryFilter === "all" || (tech.category || "").toLowerCase() === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    switch (sort) {
      case "name":
        return [...list].sort((a, b) => a.name.localeCompare(b.name));
      case "questions":
        return [...list].sort((a, b) => b.questionCount - a.questionCount);
      case "candidates":
        return [...list].sort((a, b) => b.assignedUsersCount - a.assignedUsersCount);
      default:
        return list; // "featured" — keep API order
    }
  }, [technologies, searchTerm, categoryFilter, sort]);

  const handleTechClick = (techId: string) => navigate(`/admin/technologies/${techId}`);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Super Admins get a platform-level control center (organizations, not the
  // org-scoped course/assessment view below). Branch after all hooks so hook
  // order stays stable across renders.
  if (isSuperAdmin) {
    return <SuperAdminDashboard userName={userName} />;
  }

  // Org Admins get the org-scoped people/assessment control center.
  if (isOrgAdmin) {
    return <OrgAdminDashboard userName={userName} orgName={profile?.organization_name} />;
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-6">
          {/* ----------------------------- Welcome header ----------------------------- */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-7",
              CARD_SHADOW
            )}
          >
            {/* subtle on-brand accent glow */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-violet-300/25 blur-3xl"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-24 right-1/4 h-44 w-44 rounded-full bg-[#ff5a1f]/10 blur-3xl"
            />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
                  <LayoutDashboard className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-violet">
                    Admin Control Center
                  </p>
                  <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Welcome back, {userName}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                        isSuperAdmin
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : "bg-violet-50 text-brand-violet ring-1 ring-violet-200"
                      )}
                    >
                      {isSuperAdmin ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5" />
                      )}
                      {accessLabel}
                    </span>
                    <span className="text-sm text-slate-500">{today}</span>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => navigate("/admin/assessment/create")}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4" />
                  Create Assessment
                </button>
                <button
                  onClick={() => navigate("/admin/candidate/add")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Candidate
                </button>
              </div>
            </div>
          </motion.header>

          {/* ----------------------------- Subscription (org_admin) ----------------------------- */}
          {isOrgAdmin && (
            <div
              className={`flex flex-col justify-between gap-4 rounded-2xl border p-4 md:flex-row md:items-center ${
                currentSub && currentSub.plan_type !== "free" && currentSub.is_active
                  ? "border-green-200 bg-green-50"
                  : "border-blue-200 bg-blue-50"
              }`}
            >
              <div className="flex items-center gap-3">
                <Crown
                  className={`h-6 w-6 ${
                    currentSub && currentSub.plan_type !== "free" && currentSub.is_active
                      ? "text-green-600"
                      : "text-blue-600"
                  }`}
                />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {currentSub ? currentSub.plan_name : "Free Tier Plan"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {currentSub?.end_date
                      ? `Valid until ${new Date(currentSub.end_date).toLocaleDateString()}`
                      : "No expiration"}
                  </p>
                </div>
              </div>
              {subUsage && (
                <div className="flex gap-6 text-xs text-slate-600">
                  <span>
                    Assessments:{" "}
                    <strong>
                      {subUsage.assessments_used}/{subUsage.assessments_limit}
                    </strong>
                  </span>
                  <span>
                    AI Interviews:{" "}
                    <strong>
                      {subUsage.ai_interviews_used}/{subUsage.ai_interviews_limit}
                    </strong>
                  </span>
                </div>
              )}
              <button
                onClick={() => navigate("/admin/subscription")}
                className={`inline-flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-all ${
                  currentSub && currentSub.plan_type !== "free" && currentSub.is_active
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-gradient-to-r from-brand-purple to-brand-violet text-white hover:brightness-110"
                }`}
              >
                {currentSub && currentSub.plan_type !== "free" && currentSub.is_active
                  ? "Manage Plan"
                  : "Upgrade Plan"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ----------------------------- KPI grid ----------------------------- */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((stat, i) => (
              <KpiCard key={stat.label} stat={stat} index={i} />
            ))}
          </div>

          {/* ----------------------------- Courses ----------------------------- */}
          <section className={cn("overflow-hidden rounded-3xl border border-slate-200/70 bg-white", CARD_SHADOW)}>
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Courses</h2>
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-700">{filteredTechnologies.length}</span>{" "}
                    of <span className="font-semibold text-slate-700">{totalCourses}</span> courses ·{" "}
                    <span className="font-semibold text-slate-700">{dashboardStats.total_questions}</span> questions
                  </p>
                </div>
              </div>

              <CourseFilterBar
                categories={categoryOptions}
                totalCount={technologies.length}
                activeCategory={categoryFilter}
                onCategoryChange={setCategoryFilter}
                search={searchTerm}
                onSearchChange={setSearchTerm}
                sort={sort}
                onSortChange={setSort}
              />
            </div>

            <div className="p-5 sm:p-6">
              {isLoading ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet" />
                  <p className="text-sm text-slate-500">Loading courses…</p>
                </div>
              ) : filteredTechnologies.length === 0 ? (
                <div className="py-12 text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    {searchTerm || categoryFilter !== "all"
                      ? "No courses match your filters."
                      : "No technologies found."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 items-start gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredTechnologies.map((tech, index) => (
                    <TechnologyCard
                      key={tech.id}
                      index={index}
                      id={tech.id}
                      name={tech.name}
                      description={tech.description}
                      questionCount={tech.questionCount}
                      assignedUsersCount={tech.assignedUsersCount}
                      onClick={handleTechClick}
                      category={tech.category}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

/* Premium KPI tile — tinted surface, ringed brand icon, trend chip, progress meter */
function KpiCard({ stat, index }: { stat: Kpi; index: number }) {
  const Icon = stat.icon;
  const tint = TINTS[stat.tone];
  const hasShare = typeof stat.share === "number";
  return (
    <motion.button
      type="button"
      onClick={stat.onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left",
        "transition-shadow duration-300",
        tint.surface,
        tint.border,
        CARD_SHADOW,
        "hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_38px_-18px_rgba(61,7,95,0.5)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm ring-4",
            stat.gradient,
            tint.ring
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>

        {hasShare ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
              tint.chip
            )}
          >
            <ArrowUpRight className="h-3 w-3" />
            {Math.max(0, Math.min(100, stat.share as number))}%
          </span>
        ) : (
          <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors duration-300 group-hover:text-brand-violet" />
        )}
      </div>

      <p className="mt-3.5 text-[26px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">
        <CountUp value={stat.value} />
      </p>
      <p className="mt-1.5 text-xs font-semibold text-slate-500">{stat.label}</p>

      {hasShare && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/70 ring-1 ring-inset ring-slate-200/60">
            <motion.span
              className={cn("block h-full rounded-full bg-gradient-to-r", stat.gradient)}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(0, Math.min(100, stat.share as number))}%` }}
              transition={{ duration: 0.9, delay: 0.2 + index * 0.05, ease: "easeOut" }}
            />
          </div>
          {stat.footnote && <p className="mt-1.5 text-[11px] font-medium text-slate-400">{stat.footnote}</p>}
        </div>
      )}
    </motion.button>
  );
}

export default AdminDashboard;
