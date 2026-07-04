import { motion } from "framer-motion";
import {
  Info,
  Filter,
  HeartPulse,
  GraduationCap,
  ClipboardList,
  Sparkles,
  Activity,
} from "lucide-react";

import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { SECTION_TITLE } from "@/lib/uiStyles";
import { cn } from "@/lib/utils";

/* ════════════════════════════════════════════════════════════════════════
 * Insight panels for the Org Admin dashboard — "Workforce Funnel" and
 * "Organization Health". Every row carries a plain-English tooltip so a
 * non-technical business user understands what each number means and why it
 * matters. Currently fed by MOCK DATA (design mode) — wire to a BE aggregate
 * endpoint later and pass the values in via props.
 * ══════════════════════════════════════════════════════════════════════ */

type IconType = React.ComponentType<{ className?: string }>;

/** Small "Needs API" pill — matches the dashboard's mock-data convention. */
const NeedsApi = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 ring-1 ring-inset ring-amber-200">
    Needs API
  </span>
);

/** Hoverable info icon → tooltip. Used on every metric label. */
const InfoHint = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <span
        role="img"
        aria-label="More information"
        className="cursor-help text-slate-300 transition-colors hover:text-brand-violet"
      >
        <Info className="h-3.5 w-3.5" />
      </span>
    </TooltipTrigger>
    <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
      {text}
    </TooltipContent>
  </Tooltip>
);

/* ───────────────────────── Workforce Funnel ───────────────────────── */

interface FunnelStep {
  key: string;
  label: string;
  value: number;
  icon: IconType;
  hint: string;
}

/** MOCK — replace with BE aggregate. Each step has fewer people than the one above. */
const FUNNEL: FunnelStep[] = [
  { key: "invited", label: "Invited", value: 450, icon: Filter, hint: "Total candidates you've sent an invitation to. This is the top of your pipeline — everyone you're trying to bring in." },
  { key: "registered", label: "Registered", value: 420, icon: Filter, hint: "Invited candidates who created an account and logged in at least once. The gap vs. Invited = people who never signed up." },
  { key: "course_started", label: "Course Started", value: 385, icon: Filter, hint: "Registered candidates who began at least one assigned course. The gap vs. Registered = signed up but never started learning." },
  { key: "course_completed", label: "Course Completed", value: 290, icon: Filter, hint: "Candidates who finished all modules of their assigned course(s). The gap vs. Course Started = dropped off mid-course." },
  { key: "assessment_done", label: "Assessment Done", value: 245, icon: Filter, hint: "Candidates who completed a standard assessment / exam." },
  { key: "ai_assessment", label: "AI Assessment", value: 198, icon: Filter, hint: "Candidates who completed an AI-based assessment (e.g. an AI interview)." },
];

/** Live shape from the API: [{ key, label, value }]. We keep our local
 *  icon/hint metadata and only swap in the live values, matched by key. */
type FunnelApiRow = { key: string; label?: string; value: number };

export const WorkforceFunnel = ({ funnel }: { funnel?: FunnelApiRow[] | null }) => {
  const live = Array.isArray(funnel) && funnel.length > 0;
  const valueByKey = new Map((funnel ?? []).map((f) => [f.key, f.value]));
  const steps: FunnelStep[] = FUNNEL.map((s) => ({
    ...s,
    value: live ? valueByKey.get(s.key) ?? 0 : s.value,
  }));
  const top = steps[0]?.value || 1;

  // The first four stages are a true sequential funnel (each a subset of the
  // one above). "Assessment Done" and "AI Assessment" are PARALLEL outcomes —
  // a candidate can do one without the other — so they are not subsets and
  // must not drive step-over-step conversion or drop-off maths.
  const SEQUENTIAL = new Set(["invited", "registered", "course_started", "course_completed"]);

  // Largest drop-off, considered only across the sequential funnel stages.
  let biggest = { from: "", to: "", lost: 0 };
  for (let i = 1; i < steps.length; i++) {
    if (!SEQUENTIAL.has(steps[i - 1].key) || !SEQUENTIAL.has(steps[i].key)) continue;
    const lost = steps[i - 1].value - steps[i].value;
    if (lost > biggest.lost) biggest = { from: steps[i - 1].label, to: steps[i].label, lost };
  }

  return (
    <SurfaceCard className="flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-violet" />
          <h2 className={SECTION_TITLE}>Workforce Funnel</h2>
          <InfoHint text="The share next to each stage is the % of invited candidates who reached it. Invited → Registered → Course Started → Course Completed is a sequential funnel; Assessment Done and AI Assessment are parallel outcomes (a candidate can do either independently)." />
        </div>
        {live ? null : <NeedsApi />}
      </div>

      <div className="space-y-3 p-5">
        {steps.map((s, i) => {
          // Reach rate = share of invited candidates who got to this stage.
          // Always 0–100% regardless of stage ordering, so parallel stages
          // (Assessment / AI) can't produce a misleading >100% figure.
          const reach = Math.round((s.value / top) * 100);
          const widthPct = reach;
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-600">
                  {s.label}
                  <InfoHint text={s.hint} />
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-bold tabular-nums text-slate-900">{s.value.toLocaleString()}</span>
                  {i > 0 && (
                    <span
                      className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-500"
                      title={`${reach}% of invited candidates reached "${s.label}"`}
                    >
                      {reach}%
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <motion.span
                  className="block h-full rounded-full bg-gradient-to-r from-brand-purple to-brand-violet"
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-auto border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-500">
          {biggest.lost > 0 ? (
            <>
              Biggest drop-off:{" "}
              <b className="text-slate-700">
                {biggest.from} → {biggest.to}
              </b>{" "}
              ({biggest.lost.toLocaleString()} candidates lost). Focus here to improve throughput.
            </>
          ) : (
            "No drop-off between stages."
          )}
        </p>
      </div>
    </SurfaceCard>
  );
};

/* ──────────────────────── Organization Health ─────────────────────── */

interface HealthMetric {
  key: string;
  label: string;
  score: number; // 0–100
  icon: IconType;
  hint: string;
}

/** MOCK — replace with BE aggregate. */
const HEALTH: HealthMetric[] = [
  { key: "learning", label: "Learning", score: 84, icon: GraduationCap, hint: "How well candidates are progressing through and completing their assigned courses. Higher = better follow-through on learning." },
  { key: "assessment", label: "Assessment", score: 76, icon: ClipboardList, hint: "Average performance on standard assessments / exams across your candidates." },
  { key: "ai_assessment", label: "AI Assessment", score: 74, icon: Sparkles, hint: "Average performance on AI-based assessments (e.g. AI interviews)." },
  { key: "engagement", label: "Engagement", score: 78, icon: Activity, hint: "How actively candidates use the platform — logins and activity over the last 30 days. Low engagement is an early warning sign." },
];

/** score → colour band (green healthy / amber watch / rose at-risk). */
const band = (score: number) =>
  score >= 80
    ? { text: "text-emerald-600", bar: "from-emerald-500 to-emerald-400", ring: "text-emerald-500" }
    : score >= 65
    ? { text: "text-amber-600", bar: "from-amber-500 to-amber-400", ring: "text-amber-500" }
    : { text: "text-rose-600", bar: "from-rose-500 to-rose-400", ring: "text-rose-500" };

/** Live shape from the API. Keys match the HEALTH metric keys + overall_score. */
type HealthApi = {
  overall_score?: number;
  learning?: number;
  assessment?: number;
  ai_assessment?: number;
  engagement?: number;
};

export const OrganizationHealth = ({ health }: { health?: HealthApi | null }) => {
  const live = !!health;
  const metrics: HealthMetric[] = HEALTH.map((m) => ({
    ...m,
    score: live ? Math.round(Number((health as Record<string, number>)[m.key] ?? 0)) : m.score,
  }));
  // Overall = API value when live, else the average of the categories.
  const overall =
    live && typeof health?.overall_score === "number"
      ? Math.round(health.overall_score)
      : metrics.length
      ? Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length)
      : 0;
  const ob = band(overall);
  const circumference = 2 * Math.PI * 34; // r=34
  const dash = (overall / 100) * circumference;

  return (
    <SurfaceCard className="flex flex-col">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-brand-violet" />
          <h2 className={SECTION_TITLE}>Organization Health</h2>
          <InfoHint text="A 0–100 health check of your program. The Overall Score is the average of the categories below — 80+ is healthy, 65–79 worth watching, under 65 needs attention." />
        </div>
        {live ? null : <NeedsApi />}
      </div>

      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        {/* Overall score ring */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative h-[88px] w-[88px]">
            <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-slate-100" />
              <motion.circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                className={ob.ring}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - dash }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold leading-none tabular-nums", ob.text)}>{overall}</span>
              <span className="text-[10px] font-medium text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="sm:hidden">
            <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
              Overall Score <InfoHint text="Average of the four categories on the right." />
            </p>
            <p className="text-xs text-slate-400">Higher is better</p>
          </div>
        </div>

        {/* Category bars */}
        <div className="flex-1 space-y-3">
          <p className="hidden items-center gap-1 text-sm font-semibold text-slate-700 sm:flex">
            Overall Score <InfoHint text="Average of the four categories below." />
          </p>
          {metrics.map((m, i) => {
            const mb = band(m.score);
            return (
              <div key={m.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600">
                    <m.icon className="h-3.5 w-3.5 text-slate-400" />
                    {m.label}
                    <InfoHint text={m.hint} />
                  </span>
                  <span className={cn("font-bold tabular-nums", mb.text)}>{m.score}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <motion.span
                    className={cn("block h-full rounded-full bg-gradient-to-r", mb.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${m.score}%` }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.05, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SurfaceCard>
  );
};

/** Both panels side-by-side, wrapped in a tooltip provider for snappy hovers.
 *  Pass `funnel`/`health` from the dashboard API; omit them to show mock data. */
export const InsightPanels = ({
  funnel,
  health,
}: {
  funnel?: FunnelApiRow[] | null;
  health?: HealthApi | null;
}) => (
  <TooltipProvider delayDuration={150}>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <WorkforceFunnel funnel={funnel} />
      <OrganizationHealth health={health} />
    </div>
  </TooltipProvider>
);
