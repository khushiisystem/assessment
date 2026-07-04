import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ClipboardList,
  CircleCheckBig,
  TrendingUp,
  Trophy,
  GraduationCap,
  UserPlus,
  CircleCheck,
  Activity,
  Clock,
  CalendarClock,
  ArrowUpRight,
  CreditCard,
  Loader2,
  BookOpen,
} from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { useGetAdminDashboardQuery } from "@/store/api/assessmentsApi";
import { useGetCandidatesQuery } from "@/store/api/candidatesApi";
import { useGetAllCandidatesActivityQuery } from "@/store/api/technologiesApi";
import { useGetMySubscriptionQuery } from "@/store/api/authApi";
import { StatCard } from "@/components/dashboard/StatCard";
import { WorkforceFunnel, OrganizationHealth } from "@/components/dashboard/InsightPanels";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { timeAgo, pct } from "@/utils/commonFunctions";
import {
  CARD_SHADOW,
  BTN_PRIMARY,
  BTN_OUTLINE,
  SECTION_TITLE,
  SUBSECTION_TITLE,
  ACTIVITY_TONE,
} from "@/lib/uiStyles";

/* ════════════════════════════════════════════════════════════════════════
 * Organization Admin dashboard — manager of people, scoped to one org.
 * Same chart-free control-center style as the Super Admin view: KPIs, plan
 * usage, insight panels, activity feed. (Candidate list lives on
 * /admin/candidates with a per-candidate login Status column.)
 * ══════════════════════════════════════════════════════════════════════ */

/** This org's plan/usage — sample until a subscription endpoint feeds it. */
const ORG = {
  name: "Acme Technologies",
  plan: "Pro",
  expiryDate: "2026-12-31",
  candidatesInvited: 137,
  candidateLimit: 200,
  assessmentsUsed: 64,
  assessmentsLimit: 100,
  aiUsed: 22,
  aiLimit: 40,
};

/** Plan-usage meter row (no chart). limit null = unlimited. */
const UsageBar = ({ label, used, limit }: { label: string; used: number; limit: number | null }) => {
  const hasLimit = typeof limit === "number" && limit > 0;
  const pctUsed = hasLimit ? Math.min(100, Math.round((used / (limit as number)) * 100)) : 0;
  const near = pctUsed >= 90;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={cn("font-semibold tabular-nums", near ? "text-rose-600" : "text-slate-700")}>
          {hasLimit ? `${used.toLocaleString()} / ${(limit as number).toLocaleString()}` : `${used.toLocaleString()} · Unlimited`}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <span
          className={cn("block h-full rounded-full", near ? "bg-rose-500" : "bg-gradient-to-r from-brand-purple to-brand-violet")}
          style={{ width: `${hasLimit ? pctUsed : 100}%`, opacity: hasLimit ? 1 : 0.25 }}
        />
      </div>
    </div>
  );
};

const OrgAdminDashboard = ({ userName = "Admin", orgName }: { userName?: string; orgName?: string }) => {
  const navigate = useNavigate();
  const org = { ...ORG, name: orgName || ORG.name };

  // Live, org-scoped data.
  const { data: dash } = useGetAdminDashboardQuery();
  const { data: candData } = useGetCandidatesQuery("/my-admin/candidates/");

  // Live org-scoped activity (candidate learning progress).
  const { data: activityData, isLoading: actLoading } = useGetAllCandidatesActivityQuery({ page: 1, page_size: 6 });
  const activityRows = useMemo(() => {
    const list = activityData?.results ?? [];
    return list.map((a: any, i: number) => {
      const done = (a.total ?? 0) > 0 && (a.completed ?? 0) >= a.total;
      return {
        id: `${a.userId}-${a.courseId}-${i}`,
        name: a.name?.trim() || a.email || "Candidate",
        course: a.courseName || "a course",
        progress: a.progress ?? 0,
        completed: a.completed ?? 0,
        total: a.total ?? 0,
        organization: a.organization || null,
        when: a.last_active_at,
        done,
      };
    });
  }, [activityData]);

  /* ── KPIs from the live dashboard endpoint (0 until it loads) ── */
  const assessmentsAssigned = dash?.total_assessments ?? 0;
  const completedCount = dash?.completed_assessments ?? 0;
  const completionRate = Math.round(dash?.completion_rate ?? 0);
  const avgScore = Math.round(dash?.average_pass_score ?? 0);

  /* ── Top Performers (live, org-scoped) ── */
  const topPerformers: { id: number; name: string; score: number }[] = dash?.top_performers ?? [];

  /* ── Plan usage (real): invites from the candidates API, assessments/AI from subscription ── */
  const { data: sub } = useGetMySubscriptionQuery();
  const usage = sub?.usage ?? null;
  const candidateLimit: number | null = dash?.candidate_limit ?? null;
  const invitesUsed = candData?.count ?? dash?.total_candidates ?? 0;

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const expiry = new Date(org.expiryDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 pb-10 md:px-8">
          {/* ── Header ── */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn("relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white px-5 py-4", CARD_SHADOW)}
          >
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-40 w-40 rounded-full bg-violet-300/25 blur-3xl" />

            <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
                  <Users className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-violet">{org.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                      <CreditCard className="h-3 w-3" /> {org.plan} plan
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      <CalendarClock className="h-3 w-3" /> Renews {expiry}
                    </span>
                  </div>
                  <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                    Welcome back, {userName}
                  </h1>
                  <p className="text-xs text-slate-500">{today}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button className={cn(BTN_PRIMARY, "gap-1.5 px-3 py-1.5 text-xs")} onClick={() => navigate("/admin/org/users/create")}>
                  <UserPlus className="h-3.5 w-3.5" /> Invite Candidate
                </button>
                <button className={cn(BTN_OUTLINE, "gap-1.5 px-3 py-1.5 text-xs")} onClick={() => navigate("/admin/results")}>
                  <CircleCheckBig className="h-3.5 w-3.5" /> View Results
                </button>
              </div>
            </div>
          </motion.header>

          {/* ── KPI strip ── */}
          <TooltipProvider delayDuration={150}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard compact={true} index={0} label="Assessments Assigned" value={assessmentsAssigned} icon={ClipboardList} gradient="from-[#4338ca] to-[#6366f1]" tone="indigo" onClick={() => navigate("/admin/assessments")} hint="How many assessments you've assigned to candidates in your organization." />
            <StatCard compact={true} index={1} label="Assessments Completed" value={completedCount} icon={TrendingUp} gradient="from-[#0955a7] to-[#2f9cd4]" tone="sky" hint="Assigned assessments that candidates have finished and submitted." />
            <StatCard compact={true} index={2} label="Completion Rate" value={completionRate} suffix="%" icon={CircleCheckBig} gradient="from-[#0e9f6e] to-[#23c366]" tone="emerald" share={completionRate} footnote="of assigned" hint="Share of assigned assessments that have been completed (Completed ÷ Assigned)." />
            <StatCard compact={true} index={3} label="Average Score" value={avgScore} suffix="%" icon={GraduationCap} gradient="from-brand-violet to-[#a855f7]" tone="fuchsia" share={avgScore} hint="Average score candidates achieved across their completed assessments." />
          </div>
          </TooltipProvider>

          {/* ── Insights row: Workforce Funnel + Organization Health + Top Performers ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <WorkforceFunnel funnel={dash?.workforce_funnel} />
            <OrganizationHealth health={dash?.org_health} />

            {/* Top Performers */}
            <SurfaceCard>
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <Trophy className="h-4 w-4 text-amber-500" />
                <h2 className={SECTION_TITLE}>Top Performers</h2>
              </div>
              <div className="divide-y divide-slate-50">
                {topPerformers.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-slate-400">No completed assessments yet.</p>
                ) : (
                  topPerformers.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                        i === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      )}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{p.name}</span>
                      <span className="text-sm font-bold tabular-nums text-emerald-600">{p.score}%</span>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>
          </div>

          {/* ── Plan usage ── */}
          <SurfaceCard>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-brand-violet" />
                <h2 className={SECTION_TITLE}>Plan Usage</h2>
              </div>
              <button className="inline-flex items-center gap-1 text-xs font-semibold text-brand-violet hover:underline" onClick={() => navigate("/admin/subscription")}>
                Manage subscription <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <UsageBar label="Candidate invites" used={invitesUsed} limit={candidateLimit} />
              {usage ? (
                <>
                  <UsageBar label="Assessments" used={usage.assessments_used ?? 0} limit={usage.assessments_limit ?? null} />
                  <UsageBar label="AI interviews" used={usage.ai_interviews_used ?? 0} limit={usage.ai_interviews_limit ?? null} />
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center text-xs text-slate-400">No active subscription plan.</div>
              )}
            </div>
            <div className="border-t border-slate-100 px-5 py-3">
              <p className="text-xs text-slate-500">
                {sub?.subscription?.plan_name ? <><b className="text-slate-700">{sub.subscription.plan_name}</b>{sub.subscription.end_date ? ` · renews ${new Date(sub.subscription.end_date).toLocaleDateString()}` : ""} · </> : null}
                {candidateLimit != null ? `${Math.max(0, candidateLimit - invitesUsed)} candidate invites remaining.` : "Unlimited candidate invites."}
              </p>
            </div>
          </SurfaceCard>

          {/* ── Recent activity ── */}
          <SurfaceCard>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-violet" />
                <h2 className={SECTION_TITLE}>Recent Activity</h2>
              </div>
              <span className={SUBSECTION_TITLE}>
                <span className="text-xs font-normal text-slate-400">org-scoped</span>
              </span>
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
                      {a.done ? <CircleCheck className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {a.name} {a.done ? "completed" : "progressed in"} {a.course}
                      </p>
                      <p className="truncate text-xs text-slate-400">{a.organization ? `${a.organization} · ` : ""}{a.completed}/{a.total} modules · {a.progress}%</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.when)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SurfaceCard>
        </div>
      </div>
    </AdminLayout>
  );
};

export default OrgAdminDashboard;
