import { sanitizeHtml } from "@/lib/sanitize";
// components/CodingWorkspace.tsx
//
// Split-pane IDE workspace used ONLY for coding questions in the AI assessment
// take flow (text / voice / MCQ questions keep the stacked layout in
// AiAssessmentTestInterface). Layout mirrors LeetCode / HackerRank:
//
//   ┌─ header: Q# · Coding · pts · timer · Saved ─────────────────────┐
//   │ ┌── PROBLEM ──┐║┌──────────── CODE EDITOR ────────────────────┐ │
//   │ │ statement   │║│  (fills full height — no 420px clamp)        │ │
//   │ │ sample I/O  │║├──────────── ↕ drag ─────────────────────────┤ │
//   │ └─────────────┘║│  CONSOLE  (test results)                     │ │
//   │        ↔ drag  ║└──────────────────────────────────────────────┘ │
//   └─────────────────────────────────────────────────────────────────┘
//
// Both dividers are draggable (pointer events, no extra dependency). Below the
// `lg` breakpoint it falls back to a single stacked column. Monaco already runs
// with `automaticLayout: true`, so it reflows as the panes resize.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Code2, Clock, CheckCircle, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
// CodingWorkspace is itself lazy-loaded by the parent, so importing the
// Monaco-based editor directly here keeps the whole IDE in one on-demand chunk.
import CodeEditor from "./CodeEditor";

interface TestCaseResult {
  passed: boolean;
  points?: number;
  is_hidden?: boolean;
  input?: string;
  expected_output?: string;
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: number;
  memory?: number;
}

interface CodeRunResult {
  data?: {
    results?: TestCaseResult[];
    summary?: {
      passed_count: number;
      total_cases: number;
      earned_points: number;
      total_points: number;
    };
    error?: string;
  };
  error?: string;
}

interface CodingWorkspaceProps {
  questionText: string;
  sampleInput?: string;
  sampleOutput?: string;
  marks?: number;
  questionNumber: number;
  timeLabel: string;
  saved: boolean;
  // Editor pass-throughs (parent owns the state)
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  onRun: () => void;
  onRunPlain: () => void;
  isRunning: boolean;
  editorTheme: "vs-dark" | "light";
  onEditorThemeChange: (t: "vs-dark" | "light") => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** Test-case results (Run Tests). */
  result?: CodeRunResult;
  /** Which run the console should show: 'tests' (Run Tests) or 'run' (Run Code). */
  mode: "tests" | "run";
  /** Independent-run output (Run Code) — stdout/stderr only, no verdict. */
  plainResult?: PlainRunResult;
  /** Editable stdin for Run Code, pre-filled from the question's sample input. */
  customInput: string;
  onCustomInputChange: (value: string) => void;
}

interface PlainRunResult {
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  status?: string;
  stdin?: string;
  error?: string;
}

const CodingWorkspace: React.FC<CodingWorkspaceProps> = ({
  questionText,
  sampleInput,
  sampleOutput,
  marks,
  questionNumber,
  timeLabel,
  saved,
  value,
  onChange,
  language,
  onLanguageChange,
  onRun,
  onRunPlain,
  isRunning,
  editorTheme,
  onEditorThemeChange,
  isFullscreen,
  onToggleFullscreen,
  result,
  mode,
  plainResult,
  customInput,
  onCustomInputChange,
}) => {
  // Split ratios (percent). problemPct = left pane width; consolePct = console
  // height inside the right pane. Defaults give the editor the lion's share.
  const [problemPct, setProblemPct] = useState(42);
  const [consolePct, setConsolePct] = useState(34);
  // Track the lg breakpoint so we can switch between the draggable split (wide)
  // and a stacked column (narrow) — inline width/height styles can't be made
  // responsive with Tailwind alone.
  const [isWide, setIsWide] = useState(true);

  const rowRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const startColDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = rowRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setProblemPct(Math.min(62, Math.max(28, pct)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const startRowDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const rect = rightRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return;
      const pct = ((rect.bottom - ev.clientY) / rect.height) * 100;
      setConsolePct(Math.min(72, Math.max(12, pct)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const isDark = editorTheme === "vs-dark";

  // ── Header strip ──────────────────────────────────────────────────────────
  const header = (
    <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 ring-1 ring-inset ring-slate-200">
        Q{questionNumber}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-indigo-700 ring-1 ring-inset ring-indigo-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <Code2 className="h-3 w-3" /> Coding
      </span>
      {marks != null && (
        <span className="inline-flex items-center rounded-full bg-gradient-to-br from-violet-50 to-violet-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-violet ring-1 ring-inset ring-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          {marks} pts
        </span>
      )}
      <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100/70 px-3 py-1.5 text-xs font-bold tabular-nums text-rose-600 ring-1 ring-inset ring-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
        <Clock className="h-3.5 w-3.5" />
        {timeLabel}
      </span>
      {saved && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <CheckCircle className="h-3 w-3" /> Saved
        </span>
      )}
    </div>
  );

  // ── Problem pane ──────────────────────────────────────────────────────────
  const problem = (
    <div className="relative h-full overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(61,7,95,0.30)] backdrop-blur-xl sm:p-5">
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
        <span className="h-1 w-6 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet" />
        Problem
      </h3>
      <div
        className="prose prose-slate max-w-none text-[15px] leading-[1.7] text-slate-800"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(questionText) }}
      />
      {(sampleInput || sampleOutput) && (
        <div className="mt-5 space-y-3">
          {sampleInput && (
            <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3.5 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <span className="h-1 w-1 rounded-full bg-indigo-500" />
                Sample input
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{sampleInput}</pre>
            </div>
          )}
          {sampleOutput && (
            <div className="rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3.5 shadow-sm">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Sample output
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{sampleOutput}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ── Editor ────────────────────────────────────────────────────────────────
  const editor = (
    <CodeEditor
      value={value}
      onChange={onChange}
      language={language}
      onLanguageChange={onLanguageChange}
      // Only one run endpoint exists; both buttons execute against the test
      // cases (and auto-save) via the parent's handleRunCode.
      onRun={onRun}
      onRunPlain={onRunPlain}
      isRunning={isRunning}
      isRunnings={isRunning}
      editorTheme={editorTheme}
      onEditorThemeChange={onEditorThemeChange}
      onToggleFullscreen={onToggleFullscreen}
      isFullscreen={isFullscreen}
      placeholder="Write your code here..."
    />
  );

  // ── Console ───────────────────────────────────────────────────────────────
  const consolePanel = (
    <Console
      mode={mode}
      result={result}
      plainResult={plainResult}
      customInput={customInput}
      onCustomInputChange={onCustomInputChange}
      isDark={isDark}
    />
  );

  // ── Body: split (wide) vs stacked (narrow) ─────────────────────────────────
  const body = isWide ? (
    <div ref={rowRef} className="flex min-h-0 flex-1 flex-row">
      <div style={{ width: `${problemPct}%` }} className="min-h-0 min-w-0 shrink-0">
        {problem}
      </div>
      {/* Vertical (column) resize handle */}
      <div
        onPointerDown={startColDrag}
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        className="group relative mx-1 flex w-2 shrink-0 cursor-col-resize items-center justify-center"
      >
        <span className="h-12 w-1 rounded-full bg-slate-300 transition-colors duration-150 group-hover:bg-brand-violet" />
      </div>
      <div ref={rightRef} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="min-h-0 min-w-0 flex-1">{editor}</div>
        {/* Horizontal (row) resize handle */}
        <div
          onPointerDown={startRowDrag}
          role="separator"
          aria-orientation="horizontal"
          title="Drag to resize"
          className="group relative my-1 flex h-2 shrink-0 cursor-row-resize items-center justify-center"
        >
          <span className="h-1 w-12 rounded-full bg-slate-300 transition-colors duration-150 group-hover:bg-brand-violet" />
        </div>
        <div style={{ height: `${consolePct}%` }} className="min-h-0 shrink-0">
          {consolePanel}
        </div>
      </div>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="max-h-[34vh] shrink-0 overflow-hidden rounded-2xl">{problem}</div>
      <div className="min-h-[300px] flex-1">{editor}</div>
      <div className="h-[38vh] min-h-[150px] shrink-0">{consolePanel}</div>
    </div>
  );

  const content = (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col",
        isFullscreen ? "fixed inset-0 z-[60] h-screen w-screen bg-slate-100 p-3" : "h-full flex-1",
      )}
    >
      {header}
      {body}
    </div>
  );

  // Fullscreen escapes every `backdrop-filter` ancestor (which would otherwise
  // become the containing block for `position:fixed`) by portalling to <body>,
  // so the whole IDE — problem + editor + console — truly fills the viewport.
  return isFullscreen ? createPortal(content, document.body) : content;
};

// ── Console panel ─────────────────────────────────────────────────────────────
const Console: React.FC<{
  mode: "tests" | "run";
  result?: CodeRunResult;
  plainResult?: PlainRunResult;
  customInput: string;
  onCustomInputChange: (value: string) => void;
  isDark: boolean;
}> = ({ mode, result, plainResult, customInput, onCustomInputChange, isDark }) => {
  const results = result?.data?.results || [];
  const summary = result?.data?.summary;
  const errorMsg = result?.data?.error || result?.error;
  const allPassed = summary ? summary.passed_count === summary.total_cases : false;
  const pct = summary && summary.total_points > 0
    ? ((summary.earned_points / summary.total_points) * 100).toFixed(0)
    : "0";
  const isRun = mode === "run";

  const shell = isDark
    ? "border-slate-700 bg-slate-900"
    : "border-slate-300 bg-slate-50";
  const headBar = isDark ? "bg-slate-800 text-slate-100" : "bg-slate-100 text-slate-700";
  const bodyText = isDark ? "text-slate-200" : "text-slate-800";
  const inputCls = isDark
    ? "border-slate-700 bg-slate-800/70 text-slate-100 placeholder:text-slate-500 focus:border-brand-violet/60"
    : "border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-brand-violet/60";

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden rounded-xl border", shell)}>
      <div className={cn("flex shrink-0 items-center justify-between gap-2 px-3 py-2", headBar)}>
        <div className="flex items-center gap-2">
          <Terminal className={cn("h-4 w-4", !isRun && allPassed ? "text-emerald-400" : isDark ? "text-slate-400" : "text-slate-500")} />
          <span className="text-sm font-semibold">Console</span>
          <span className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-600",
          )}>
            {isRun ? "Run Code" : "Run Tests"}
          </span>
        </div>
        {!isRun && summary && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset",
              allPassed
                ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                : "bg-rose-500/15 text-rose-400 ring-rose-500/30",
            )}
          >
            {allPassed ? <CheckCircle className="h-3 w-3" /> : null}
            {summary.passed_count}/{summary.total_cases} passed · {summary.earned_points}/{summary.total_points} pts · {pct}%
          </span>
        )}
      </div>

      {/* Custom stdin — feeds "Run Code". Pre-filled with the sample input. */}
      <div className={cn("shrink-0 border-b px-3 py-2", isDark ? "border-slate-700/70" : "border-slate-200")}>
        <label className={cn("mb-1 block text-[10px] font-bold uppercase tracking-[0.08em]", isDark ? "text-slate-400" : "text-slate-500")}>
          Custom input (stdin)
        </label>
        <textarea
          value={customInput}
          onChange={(e) => onCustomInputChange(e.target.value)}
          rows={2}
          spellCheck={false}
          placeholder="Input passed to your program when you press Run Code…"
          className={cn(
            "w-full resize-none rounded-lg border px-2.5 py-1.5 font-mono text-xs leading-relaxed outline-none transition-colors focus:ring-2 focus:ring-brand-violet/25",
            inputCls,
          )}
        />
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 font-mono text-xs", bodyText)}>
        {/* ── Run Code: plain output, no verdict ── */}
        {isRun ? (
          !plainResult ? (
            <p className={isDark ? "text-slate-500" : "text-slate-400"}>Press Run Code to execute against your input.</p>
          ) : plainResult.error ? (
            <pre className="whitespace-pre-wrap break-words text-rose-400">{plainResult.error}</pre>
          ) : (
            <dl className="space-y-1">
              {plainResult.status && plainResult.status !== "Accepted" && (
                <Field label="Status" value={plainResult.status} isDark={isDark} tone="error" />
              )}
              <Field label="Output" value={plainResult.stdout} isDark={isDark} />
              {plainResult.stderr && <Field label="Stderr" value={plainResult.stderr} isDark={isDark} tone="error" />}
              {plainResult.compile_output && <Field label="Compile error" value={plainResult.compile_output} isDark={isDark} tone="error" />}
            </dl>
          )
        ) : (
          <>
        {results.length === 0 && !errorMsg && (
          <p className={isDark ? "text-slate-500" : "text-slate-400"}>
            Press Run Tests to check your solution against the test cases.
          </p>
        )}

        {results.length === 0 && errorMsg && (
          <pre className="whitespace-pre-wrap break-words text-rose-400">{errorMsg}</pre>
        )}

        <div className="space-y-2">
          {results.map((tc, idx) => (
            <div
              key={idx}
              className={cn(
                "rounded-lg border p-2.5",
                tc.passed
                  ? isDark ? "border-emerald-500/25 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50/70"
                  : isDark ? "border-rose-500/25 bg-rose-500/5" : "border-rose-200 bg-rose-50/70",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      tc.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400",
                    )}
                  >
                    {tc.passed ? "Pass" : "Fail"}
                  </span>
                  Test case {idx + 1}
                </span>
                <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                  {tc.passed ? tc.points ?? 0 : 0}/{tc.points ?? 0} pts
                </span>
              </div>

              {tc.is_hidden ? (
                <p className={cn("mt-1.5 italic", isDark ? "text-slate-500" : "text-slate-400")}>Hidden test case</p>
              ) : (
                <dl className="mt-1.5 space-y-1">
                  <Field label="Input" value={tc.input} isDark={isDark} />
                  <Field label="Expected" value={tc.expected_output} isDark={isDark} />
                  <Field label="Your output" value={tc.stdout} isDark={isDark} />
                </dl>
              )}

              {tc.stderr && <Field label="Stderr" value={tc.stderr} isDark={isDark} tone="error" />}
              {tc.compile_output && <Field label="Compile error" value={tc.compile_output} isDark={isDark} tone="error" />}
              {tc.time != null && (
                <p className={cn("mt-1 text-[11px]", isDark ? "text-slate-500" : "text-slate-400")}>
                  {tc.time}s{tc.memory != null ? ` · ${Math.round(tc.memory)} KB` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
          </>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value?: string; isDark: boolean; tone?: "error" }> = ({ label, value, isDark, tone }) => (
  <div className="flex gap-2">
    <dt className={cn("w-24 shrink-0 text-[11px] font-semibold", isDark ? "text-slate-400" : "text-slate-500")}>{label}</dt>
    <dd className={cn("min-w-0 flex-1 whitespace-pre-wrap break-words", tone === "error" ? "text-rose-400" : isDark ? "text-emerald-300" : "text-slate-700")}>
      {value || <span className={isDark ? "text-slate-600" : "text-slate-400"}>(none)</span>}
    </dd>
  </div>
);

export default CodingWorkspace;
