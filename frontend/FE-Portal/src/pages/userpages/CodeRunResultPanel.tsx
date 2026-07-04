import React, { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Check,
  X,
  AlertTriangle,
  Lock,
  ChevronDown,
  Clock,
  Cpu,
  Sparkles,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type RunResult =
  | {
      kind: "tests"
      summary: {
        passedCount: number
        totalCases: number
        earnedPoints: number
        totalPoints: number
        percentage: number
      }
      cases: Array<{
        index: number
        passed: boolean
        isHidden: boolean
        earned: number
        points: number
        input?: string
        expected?: string
        actual?: string
        status?: string
        error?: string
        time?: number
        memory?: number
      }>
    }
  | {
      kind: "single"
      status: "Accepted" | "Compilation Error" | "Runtime Error" | "Error"
      stdout?: string
      stderr?: string
      time?: number
      memory?: number
      error?: string
    }
  | {
      kind: "raw"
      text: string
    }

interface CodeRunResultPanelProps {
  result: RunResult | null
  dark: boolean
}

/**
 * LeetCode/HackerRank-style structured result for the code run output.
 * The parent owns the visibility / theme; this is pure presentational.
 */
const CodeRunResultPanel: React.FC<CodeRunResultPanelProps> = ({ result, dark }) => {
  if (!result) {
    return (
      <div className={cn("flex items-center gap-2 italic", dark ? "text-slate-500" : "text-slate-400")}>
        <span className={cn("h-1 w-1 rounded-full", dark ? "bg-slate-600" : "bg-slate-300")} />
        Run your code to see results here…
      </div>
    )
  }

  if (result.kind === "raw") {
    return (
      <pre className={cn("whitespace-pre-wrap", dark ? "text-[#d4d4d4]" : "text-slate-800")}>
        <span className={cn("select-none", dark ? "text-slate-500" : "text-slate-400")}>$ </span>
        {result.text}
      </pre>
    )
  }

  if (result.kind === "single") {
    return <SingleResult result={result} dark={dark} />
  }

  return <TestResults result={result} dark={dark} />
}

// ─────────────────────────────────────────────────────────────────────────
// Single execution (no test cases)
// ─────────────────────────────────────────────────────────────────────────
const SingleResult: React.FC<{
  result: Extract<RunResult, { kind: "single" }>
  dark: boolean
}> = ({ result, dark }) => {
  const ok = result.status === "Accepted"
  const tone = ok ? "emerald" : result.status === "Compilation Error" ? "amber" : "rose"
  return (
    <div className="space-y-3">
      <VerdictBanner
        tone={tone}
        title={ok ? "Code executed" : result.status}
        subtitle={ok ? "Output below" : "See details below"}
        right={
          (result.time || result.memory) && (
            <div className="flex items-center gap-3 text-[11px] font-medium">
              {result.time !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {result.time}s
                </span>
              )}
              {result.memory !== undefined && (
                <span className="inline-flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  {Math.round(result.memory / 1024)} KB
                </span>
              )}
            </div>
          )
        }
        dark={dark}
      />
      {ok && result.stdout ? (
        <OutputBlock label="STDOUT" content={result.stdout} dark={dark} tone="success" />
      ) : null}
      {result.stderr ? <OutputBlock label="STDERR" content={result.stderr} dark={dark} tone="error" /> : null}
      {result.error ? <OutputBlock label="ERROR" content={result.error} dark={dark} tone="error" /> : null}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Test cases verdict + list
// ─────────────────────────────────────────────────────────────────────────
const TestResults: React.FC<{
  result: Extract<RunResult, { kind: "tests" }>
  dark: boolean
}> = ({ result, dark }) => {
  const { summary, cases } = result
  const allPassed = summary.passedCount === summary.totalCases
  const tone = allPassed ? "emerald" : summary.passedCount === 0 ? "rose" : "amber"
  const title = allPassed ? "All tests passed" : summary.passedCount === 0 ? "All tests failed" : "Partial pass"

  return (
    <div className="space-y-3">
      <VerdictBanner
        tone={tone}
        title={title}
        subtitle={`${summary.passedCount} of ${summary.totalCases} test cases · ${summary.earnedPoints}/${summary.totalPoints} pts`}
        right={
          <div className="flex items-center gap-2">
            <div className={cn("relative h-1.5 w-24 overflow-hidden rounded-full", dark ? "bg-slate-700" : "bg-slate-200")}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${summary.percentage}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  tone === "emerald" && "bg-emerald-500",
                  tone === "amber" && "bg-amber-500",
                  tone === "rose" && "bg-rose-500",
                )}
              />
            </div>
            <span className={cn("text-xs font-bold tabular-nums", dark ? "text-slate-200" : "text-slate-800")}>
              {summary.percentage.toFixed(0)}%
            </span>
          </div>
        }
        dark={dark}
      />

      <div className="space-y-2">
        {cases.map((tc, idx) => (
          <TestCaseCard key={idx} tc={tc} dark={dark} defaultOpen={!tc.passed && idx === 0} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Reusable atoms
// ─────────────────────────────────────────────────────────────────────────
const VerdictBanner: React.FC<{
  tone: "emerald" | "amber" | "rose"
  title: string
  subtitle: string
  right?: React.ReactNode
  dark: boolean
}> = ({ tone, title, subtitle, right, dark }) => {
  const palette = {
    emerald: {
      bg: dark ? "bg-emerald-500/10" : "bg-emerald-50",
      border: dark ? "border-emerald-500/30" : "border-emerald-200",
      icon: dark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700",
      title: dark ? "text-emerald-300" : "text-emerald-700",
      sub: dark ? "text-emerald-200/70" : "text-emerald-700/80",
      Icon: Check,
    },
    amber: {
      bg: dark ? "bg-amber-500/10" : "bg-amber-50",
      border: dark ? "border-amber-500/30" : "border-amber-200",
      icon: dark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700",
      title: dark ? "text-amber-300" : "text-amber-700",
      sub: dark ? "text-amber-200/70" : "text-amber-700/80",
      Icon: AlertTriangle,
    },
    rose: {
      bg: dark ? "bg-rose-500/10" : "bg-rose-50",
      border: dark ? "border-rose-500/30" : "border-rose-200",
      icon: dark ? "bg-rose-500/20 text-rose-300" : "bg-rose-100 text-rose-700",
      title: dark ? "text-rose-300" : "text-rose-700",
      sub: dark ? "text-rose-200/70" : "text-rose-700/80",
      Icon: X,
    },
  }[tone]
  const Icon = palette.Icon
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5",
        palette.bg,
        palette.border,
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", palette.icon)}>
          <Icon className="h-4 w-4" strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p className={cn("text-sm font-bold tracking-tight truncate", palette.title)}>{title}</p>
          <p className={cn("text-[11px] font-medium truncate", palette.sub)}>{subtitle}</p>
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </motion.div>
  )
}

const TestCaseCard: React.FC<{
  tc: Extract<RunResult, { kind: "tests" }>["cases"][number]
  dark: boolean
  defaultOpen?: boolean
}> = ({ tc, dark, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)
  const tone = tc.passed ? "emerald" : "rose"
  const Icon = tc.passed ? Check : X
  return (
    <div
      className={cn(
        "rounded-lg border overflow-hidden transition-colors",
        dark ? "border-slate-800 bg-[#252526]" : "border-slate-200 bg-white",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
          dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              tc.passed
                ? dark
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-emerald-100 text-emerald-700"
                : dark
                  ? "bg-rose-500/20 text-rose-300"
                  : "bg-rose-100 text-rose-700",
            )}
          >
            <Icon className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className={cn("text-xs font-semibold tabular-nums", dark ? "text-slate-200" : "text-slate-800")}>
            Test {tc.index}
          </span>
          {tc.isHidden && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset",
                dark
                  ? "bg-slate-700/50 text-slate-300 ring-slate-600"
                  : "bg-slate-100 text-slate-600 ring-slate-200",
              )}
            >
              <Lock className="h-2.5 w-2.5" /> Hidden
            </span>
          )}
          {(() => {
            // Hide "Accepted" / "OK" / "Success" variants — they're not
            // useful next to the green checkmark. Comparison is
            // normalised so BE drift ("Accepted ", "accepted", "ACCEPTED")
            // doesn't leak the pill through.
            const raw = (tc.status || "").trim()
            const norm = raw.toLowerCase()
            const isAcceptedish = ["accepted", "ok", "success", "passed"].includes(norm)
            if (!raw || tc.passed || isAcceptedish) return null
            return (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset",
                  dark
                    ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
                    : "bg-rose-50 text-rose-700 ring-rose-200",
                )}
              >
                {raw}
              </span>
            )
          })()}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-[10px] font-semibold tabular-nums", dark ? "text-slate-400" : "text-slate-500")}>
            {tc.earned}/{tc.points} pts
          </span>
          {(tc.time !== undefined || tc.memory !== undefined) && (
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1 text-[10px] font-medium",
                dark ? "text-slate-500" : "text-slate-400",
              )}
            >
              {tc.time !== undefined && (
                <>
                  <Clock className="h-2.5 w-2.5" />
                  {tc.time}s
                </>
              )}
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className={cn("h-3.5 w-3.5", dark ? "text-slate-500" : "text-slate-400")} />
          </motion.span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className={cn("px-3 pb-3 pt-1 space-y-2.5 border-t", dark ? "border-slate-800" : "border-slate-100")}>
              {tc.isHidden && !tc.error ? (
                <p className={cn("text-[11px] italic", dark ? "text-slate-500" : "text-slate-500")}>
                  Input and expected output are hidden for this case.
                </p>
              ) : (
                <>
                  {tc.input !== undefined && (
                    <IO label="Input" value={tc.input} dark={dark} tone="neutral" />
                  )}
                  {tc.expected !== undefined && (
                    <IO label="Expected" value={tc.expected} dark={dark} tone="info" />
                  )}
                  {tc.actual !== undefined && (
                    <IO
                      label="Your Output"
                      value={tc.actual}
                      dark={dark}
                      tone={tc.passed ? "success" : "error"}
                    />
                  )}
                </>
              )}
              {tc.error && (() => {
                // Normalise the label too — "Accepted" never makes sense
                // as the heading on an error block.
                const norm = (tc.status || "").trim().toLowerCase()
                const label =
                  !tc.status || ["accepted", "ok", "success", "passed"].includes(norm)
                    ? "Error"
                    : tc.status
                return <IO label={label} value={tc.error} dark={dark} tone="error" mono />
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const IO: React.FC<{
  label: string
  value: string
  dark: boolean
  tone: "neutral" | "info" | "success" | "error"
  mono?: boolean
}> = ({ label, value, dark, tone, mono }) => {
  const toneCls =
    tone === "success"
      ? dark
        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-200"
        : "bg-emerald-50/60 border-emerald-200/70 text-emerald-900"
      : tone === "error"
        ? dark
          ? "bg-rose-500/5 border-rose-500/20 text-rose-200"
          : "bg-rose-50/60 border-rose-200/70 text-rose-900"
        : tone === "info"
          ? dark
            ? "bg-sky-500/5 border-sky-500/20 text-sky-200"
            : "bg-sky-50/60 border-sky-200/70 text-sky-900"
          : dark
            ? "bg-slate-800/50 border-slate-700 text-slate-200"
            : "bg-slate-50 border-slate-200 text-slate-800"
  return (
    <div>
      <p
        className={cn(
          "mb-1 text-[10px] font-bold uppercase tracking-wide",
          dark ? "text-slate-500" : "text-slate-500",
        )}
      >
        {label}
      </p>
      <pre
        className={cn(
          "whitespace-pre-wrap rounded-md border px-2.5 py-1.5 text-[11px] leading-relaxed",
          mono ? "font-mono" : "font-mono",
          toneCls,
        )}
      >
        {value || <span className="italic opacity-60">(empty)</span>}
      </pre>
    </div>
  )
}

const OutputBlock: React.FC<{
  label: string
  content: string
  dark: boolean
  tone: "success" | "error" | "info"
}> = ({ label, content, dark, tone }) => (
  <div className={cn("rounded-lg border overflow-hidden", dark ? "border-slate-800" : "border-slate-200")}>
    <div
      className={cn(
        "flex items-center gap-1.5 border-b px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        dark ? "border-slate-800 bg-slate-800/40 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-600",
      )}
    >
      <Terminal className="h-2.5 w-2.5" />
      {label}
    </div>
    <pre
      className={cn(
        "whitespace-pre-wrap px-3 py-2 font-mono text-[12px] leading-relaxed",
        dark
          ? tone === "error"
            ? "bg-[#1e1e1e] text-[#f48771]"
            : "bg-[#1e1e1e] text-[#d4d4d4]"
          : tone === "error"
            ? "bg-white text-rose-700"
            : "bg-white text-slate-800",
      )}
    >
      {content}
    </pre>
  </div>
)

export default CodeRunResultPanel
