import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Users,
  ClipboardList,
  BookOpen,
  TrendingUp,
  ShieldCheck,
  Crown,
  UserPlus,
  Share2,
  Search,
  Bell,
  Activity,
  AlertTriangle,
  ShieldOff,
  Sparkles,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { useGetOrganizationsQuery } from "@/store/api/organizationsApi";
import { useGetAdminDashboardQuery } from "@/store/api/assessmentsApi";
import { useGetTechnologiesQuery, useGetAllCandidatesActivityQuery } from "@/store/api/technologiesApi";
import { cn } from "@/lib/utils";
import { timeAgo, pct } from "@/utils/commonFunctions";
import {
  CARD_SHADOW,
  BTN_OUTLINE,
  SECTION_TITLE,
  INPUT_CLASS,
  ALERT_STYLE,
  ACTIVITY_TONE,
} from "@/lib/uiStyles";

/* ════════════════════════════════════════════════════════════════════════
 * Super Admin dashboard — LIVE.
 * KPIs + organizations table use real data (organizations list incl.
 * candidates_count, platform counts from the admin-dashboard endpoint, course
 * count from technologies). Only the Activity feed remains sample (no endpoint).
 * ══════════════════════════════════════════════════════════════════════ */

const NeedsApi = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-inset ring-amber-200">
    Sample
  </span>
);


const SuperAdminDashboard = ({ userName = "Admin" }: { userName?: string }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  /* ── live data ── */
  const { data: orgs = [], isLoading: orgsLoading } = useGetOrganizationsQuery();
  const { data: dash } = useGetAdminDashboardQuery();
  const { data: tech } = useGetTechnologiesQuery({ page: 1, page_size: 1 });
  const { data: activityData, isLoading: actLoading } = useGetAllCandidatesActivityQuery({ page: 1, page_size: 6 });

  const activityRows = useMemo(() => {
    const list = activityData?.results ?? [];
    return list.map((a: any, i: number) => {
      const done = (a.total ?? 0) > 0 && (a.completed ?? 0) >= a.total;
      return {
        id: `${a.userId}-${a.courseId}-${i}`,
        name: a.name?.trim() || a.email || "Candidate",
        course: a.courseName || "a course",
        organization: a.organization || null,
        progress: a.progress ?? 0,
        when: a.last_active_at,
        done,
      };
    });
  }, [activityData]);

  /* ── derived KPIs (all from real data available now) ── */
  const totalOrgs = orgs.length;
  const activeOrgs = orgs.filter((o) => o.is_active).length;
  const totalCandidates = dash?.total_candidates ?? orgs.reduce((s, o) => s + (o.candidates_count ?? 0), 0);
  const totalAssessments = dash?.total_assessments ?? 0;
  const totalCourses = tech?.count ?? 0;
  const newOrgs30d = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return orgs.filter((o) => o.created_at && new Date(o.created_at).getTime() >= cutoff).length;
  }, [orgs]);

  /* ── alerts derived from live org data ── */
  const alerts = useMemo(() => {
    const out: { id: string; severity: string; icon: any; title: string; desc: string }[] = [];
    const disabled = orgs.filter((o) => !o.is_active).length;
    const atLimit = orgs.filter((o) => o.candidate_limit != null && (o.candidates_count ?? 0) >= o.candidate_limit).length;
    const empty = orgs.filter((o) => (o.candidates_count ?? 0) === 0).length;
    if (atLimit) out.push({ id: "limit", severity: "danger", icon: AlertTriangle, title: `${atLimit} org${atLimit > 1 ? "s" : ""} at invite limit`, desc: "Candidates can't be invited until the limit is raised." });
    if (disabled) out.push({ id: "disabled", severity: "warn", icon: ShieldOff, title: `${disabled} organization${disabled > 1 ? "s" : ""} disabled`, desc: "These tenants currently have no access." });
    if (empty) out.push({ id: "empty", severity: "info", icon: Users, title: `${empty} org${empty > 1 ? "s" : ""} with no candidates`, desc: "Newly registered or not yet onboarded." });
    return out;
  }, [orgs]);

  const filteredOrgs = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return orgs;
    return orgs.filter(
      (o) => o.name.toLowerCase().includes(t) || (o.organization_type || "").toLowerCase().includes(t) || (o.primary_email || "").toLowerCase().includes(t)
    );
  }, [orgs, search]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 pb-10 md:px-8">
          {/* ── Header ── */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn("relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-7", CARD_SHADOW)}
          >
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-violet-300/25 blur-3xl" />
            <span aria-hidden className="pointer-events-none absolute -bottom-24 right-1/4 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
                  <Crown className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-violet">Platform Overview</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Crown className="h-3 w-3" /> Super Admin
                    </span>
                  </div>
                  <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Welcome back, {userName}</h1>
                  <p className="mt-1 text-sm text-slate-500">{today}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className={BTN_OUTLINE} onClick={() => navigate("/admin/shared-content")}>
                  <Share2 className="h-4 w-4" /> Manage Catalog
                </button>
              </div>
            </div>
          </motion.header>

          {/* ── KPI strip ── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard compact={false} index={0} label="Total Organizations" value={totalOrgs} icon={Building2} gradient="from-brand-purple to-brand-violet" tone="violet" onClick={() => navigate("/admin/organizations")} />
            <StatCard compact={false} index={1} label="Active Organizations" value={activeOrgs} icon={ShieldCheck} gradient="from-[#0e9f6e] to-[#23c366]" tone="emerald" share={pct(activeOrgs, totalOrgs)} footnote={`${pct(activeOrgs, totalOrgs)}% of total`} onClick={() => navigate("/admin/organizations")} />
            <StatCard compact={false} index={2} label="Total Candidates" value={totalCandidates} icon={Users} gradient="from-[#4338ca] to-[#6366f1]" tone="indigo" onClick={() => navigate("/admin/candidates")} />
            <StatCard compact={false} index={3} label="Assessments" value={totalAssessments} icon={ClipboardList} gradient="from-[#0955a7] to-[#2f9cd4]" tone="sky" onClick={() => navigate("/admin/assessments")} />
            <StatCard compact={false} index={4} label="Total Courses" value={totalCourses} icon={BookOpen} gradient="from-brand-violet to-[#a855f7]" tone="fuchsia" onClick={() => navigate("/admin/technologies")} />
            <StatCard compact={false} index={5} label="New Orgs (30d)" value={newOrgs30d} icon={TrendingUp} gradient="from-[#c2790b] to-[#eab40b]" tone="amber" onClick={() => navigate("/admin/organizations")} />
          </div>

          {/* ── Organizations table (live) ── */}
          <SurfaceCard shadow="deep" className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h2 className={SECTION_TITLE}>Organizations</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{filteredOrgs.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search organizations…" className={cn(INPUT_CLASS, "h-9 w-full pl-9 sm:w-64")} />
                </div>
                <button className={cn(BTN_OUTLINE, "h-9 px-3 py-0")} onClick={() => navigate("/admin/organizations")}>Manage</button>
              </div>
            </div>

            {orgsLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-semibold">Organization</th>
                      <th className="px-3 py-3 font-semibold">Type</th>
                      <th className="px-3 py-3 font-semibold">Candidates</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map((o) => (
                      <tr key={o.id} onClick={() => navigate("/admin/organizations")} className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold text-white">
                              {o.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">{o.name}</p>
                              <p className="truncate text-xs text-slate-400">{o.primary_email || `/${o.slug}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{o.organization_type}</td>
                        <td className="px-3 py-3 tabular-nums text-slate-600">{(o.candidates_count ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", o.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
                            {o.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </td>
                      </tr>
                    ))}
                    {filteredOrgs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                          {orgs.length === 0 ? "No organizations yet." : "No organizations match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>

          {/* ── Activity + Alerts ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Activity feed — live, across all organizations */}
            <SurfaceCard className="lg:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-violet" />
                  <h2 className={SECTION_TITLE}>Recent Activity</h2>
                </div>
                <span className="text-xs text-slate-400">all organizations</span>
              </div>
              {actLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
                </div>
              ) : activityRows.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">No recent activity yet.</p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {activityRows.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", a.done ? ACTIVITY_TONE.emerald : ACTIVITY_TONE.violet)}>
                        {a.done ? <CheckCircle2 className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {a.name} {a.done ? "completed" : "progressed in"} {a.course}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {a.organization ? <span className="font-medium text-brand-violet">{a.organization}</span> : "—"} · {a.progress}%
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.when)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>

            {/* Alerts — derived from live org data */}
            <SurfaceCard>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <h2 className={SECTION_TITLE}>Alerts</h2>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">{alerts.length}</span>
              </div>
              <div className="space-y-2.5 p-4">
                {alerts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">All clear — no alerts.</p>
                ) : (
                  alerts.map((al) => {
                    const s = ALERT_STYLE[al.severity];
                    return (
                      <div key={al.id} className={cn("flex items-start gap-3 rounded-xl border p-3", s.wrap)}>
                        <al.icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.icon)} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{al.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{al.desc}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </SurfaceCard>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
