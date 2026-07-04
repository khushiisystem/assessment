// components/CodeEditor.tsx
import React, { useMemo, useCallback, useRef, useState, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { Play, ChevronDown, Loader2, Maximize2, Minimize2, Sun, Moon, RotateCcw, Type } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  { value: "python",     label: "Python",     icon: "🐍" },
  { value: "javascript", label: "JavaScript", icon: "🟨" },
  { value: "typescript", label: "TypeScript", icon: "🔷" },
  { value: "java",       label: "Java",       icon: "☕" },
  { value: "c",          label: "C",          icon: "⚙️" },
  { value: "cpp",        label: "C++",        icon: "⚙️" },
  { value: "sql",        label: "SQL",        icon: "🗄️" },
];

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (lang: string) => void;
  onRun: () => void;
  onRunPlain: () => void;
  isRunning: boolean;
  isRunnings: boolean;
  /** Editor theme — controlled by the parent so the output panel can match. */
  editorTheme: "vs-dark" | "light";
  onEditorThemeChange: (t: "vs-dark" | "light") => void;
  /** Editor + output share the same fullscreen — controlled by the parent. */
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  placeholder?: string;
  height?: string;
  onEditorFocus?: () => void;
  /** Initial template code for the active language (used by Reset). */
  initialCode?: string;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onEditorFocus,
  onLanguageChange,
  onRun,
  onRunPlain,
  isRunning,
  isRunnings,
  editorTheme,
  onEditorThemeChange,
  onToggleFullscreen,
  isFullscreen,
  placeholder = "Write your code here...",
  height = "250px",
  initialCode,
}) => {
  const prevValueRef = useRef<string>(value);
  // Local font-size only — theme & fullscreen are lifted so the wrapping
  // right panel (editor + output) can react together.
  const [fontSize, setFontSize] = useState<number>(14);
  // Inline "confirm reset" state — replaces window.confirm which was
  // (a) a blocking native dialog that some users perceived as a page
  // reload because it freezes the tab, and (b) easily mis-clickable.
  // The button now flips to a "Confirm reset?" pill on first click and
  // only resets the code on the second click.
  const [resetArmed, setResetArmed] = useState(false);

  const toggleTheme = useCallback(() => onEditorThemeChange(editorTheme === "vs-dark" ? "light" : "vs-dark"), [editorTheme, onEditorThemeChange]);
  const handleReset = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (initialCode === undefined) return;
    if (!resetArmed) {
      setResetArmed(true)
      // Auto-disarm after 3 s if the candidate doesn't confirm
      window.setTimeout(() => setResetArmed(false), 3000)
      return
    }
    onChange(initialCode);
    setResetArmed(false)
  }, [initialCode, onChange, resetArmed]);

  const monacoLanguage = useMemo(() => {
    const lang = language.toLowerCase();
    switch (lang) {
      case "python":  case "py":         return "python";
      case "javascript": case "js":      return "javascript";
      case "typescript": case "ts":      return "typescript";
      case "java":                       return "java";
      case "c":                          return "c";
      case "cpp": case "c++":            return "cpp";
      case "csharp": case "c#":          return "csharp";
      case "sql": case "mysql":          return "sql";
      default:
        if (lang.includes("python"))     return "python";
        if (lang.includes("typescript")) return "typescript";
        if (lang.includes("javascript")) return "javascript";
        if (lang.includes("java"))       return "java";
        if (lang.includes("cpp") || lang.includes("c++")) return "cpp";
        return "python";
    }
  }, [language]);

  const tabSize = useMemo(() => {
    const lang = language.toLowerCase();
    return lang === "javascript" || lang === "js" ||
           lang === "typescript" || lang === "ts" ? 2 : 4;
  }, [language]);

  const handleChange = useCallback(
    (val?: string) => {
      const newVal = val ?? "";
      if (newVal !== prevValueRef.current) {
        prevValueRef.current = newVal;
        onChange(newVal);
      }
    },
    [onChange]
  );

  const currentLangOption = LANGUAGE_OPTIONS.find(
    (o) => o.value === language.toLowerCase()
  );

  const isDark = editorTheme === "vs-dark";
  const toolbar = isDark
    ? "border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950"
    : "border-slate-200 bg-gradient-to-b from-slate-50 to-white";
  const iconBtn = isDark
    ? "text-slate-300 hover:bg-slate-800 hover:text-white"
    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900";
  const selectCls = isDark
    ? "border-slate-700 bg-slate-800/80 text-slate-100 hover:border-brand-violet/60 hover:bg-slate-800 focus:border-brand-violet focus:ring-brand-violet/30"
    : "border-slate-200 bg-white text-slate-800 hover:border-brand-violet/50 focus:border-brand-violet focus:ring-brand-violet/25";

  return (
    <div
      style={{ height }}
      className={cn(
        "relative flex flex-col min-h-0 w-full min-w-0 rounded-xl overflow-hidden border",
        isDark ? "border-slate-800 shadow-[0_8px_28px_-12px_rgba(15,23,42,0.45)]" : "border-slate-200 shadow-[0_6px_20px_-10px_rgba(15,23,42,0.18)]",
      )}
    >
      {/* Brand ribbon */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple z-10" />

      {/* Toolbar — VS Code-ish. flex-wrap + min-w-0 on the left cluster lets the
          view controls reflow on narrow editors while the Run cluster (shrink-0
          + ml-auto) always stays whole and right-aligned, never clipped. */}
      <div className={cn("flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-2 py-2 border-b sm:px-3", toolbar)}>
        {/* LEFT cluster — Language + view controls */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <div className="relative flex items-center">
            <select
              value={language.toLowerCase()}
              onChange={(e) => onLanguageChange(e.target.value)}
              disabled={isRunning || isRunnings}
              className={cn(
                "appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold cursor-pointer outline-none transition-all border focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed",
                selectCls,
              )}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className={isDark ? "bg-slate-900 text-slate-100" : "bg-white text-slate-800"}>
                  {opt.icon}  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className={cn("pointer-events-none absolute right-2 top-1/2 -translate-y-1/2", isDark ? "text-slate-400" : "text-slate-500")} />
          </div>

          {/* Divider */}
          <span className={cn("mx-1 h-5 w-px", isDark ? "bg-slate-700" : "bg-slate-200")} />

          {/* Font size cluster */}
          <div className={cn("inline-flex items-center rounded-lg border overflow-hidden", isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white")}>
            <button type="button" onClick={() => setFontSize((s) => Math.max(11, s - 1))} title="Smaller font" className={cn("inline-flex h-7 w-7 items-center justify-center text-sm font-bold", iconBtn)}>−</button>
            <span className={cn("flex items-center gap-1 px-2 text-[11px] font-semibold tabular-nums", isDark ? "text-slate-300" : "text-slate-600")}>
              <Type className="h-3 w-3" />
              {fontSize}
            </span>
            <button type="button" onClick={() => setFontSize((s) => Math.min(24, s + 1))} title="Larger font" className={cn("inline-flex h-7 w-7 items-center justify-center text-sm font-bold", iconBtn)}>+</button>
          </div>

          {/* Theme toggle */}
          <button type="button" onClick={toggleTheme} title={isDark ? "Switch to light" : "Switch to dark"} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg border", isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white", iconBtn)}>
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          {/* Reset to template — two-step confirm via local state */}
          {initialCode !== undefined && (
            <button
              type="button"
              onClick={handleReset}
              title={resetArmed ? "Click again to confirm reset" : "Reset to starter code"}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border transition-all",
                resetArmed
                  ? "px-2 h-7 border-rose-300 bg-rose-50 text-rose-700 font-semibold text-[10px]"
                  : cn("h-7 w-7 justify-center", isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white", iconBtn),
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetArmed && <span>Confirm</span>}
            </button>
          )}

          {/* Fullscreen toggle — drives the parent's editor+output container */}
          <button type="button" onClick={onToggleFullscreen} title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen editor & output"} className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg border", isDark ? "border-slate-700 bg-slate-800/60" : "border-slate-200 bg-white", iconBtn)}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* RIGHT cluster — Run buttons. Labels reworded so they match
            what the backend actually does:
              • onRun (primary)  → executes against the admin's test
                cases and the candidate's pill turns green only when
                they all pass. That's the meaningful action, so it
                gets the brand-gradient + "Run Tests" label.
              • onRunPlain (secondary) → executes the code with the
                sample stdin only, no pass/fail verdict. Labelled
                "Run Code" as a quiet outline. */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
  onClick={onRunPlain}
  disabled={isRunnings || isRunning}
            title="Run with sample input, no verdict"
            className={cn(
              "group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 border active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed sm:px-3",
              isDark
                ? "border-slate-700 bg-slate-800/60 text-slate-100 hover:border-brand-violet/60 hover:bg-slate-800"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-violet/50 hover:bg-violet-50/40",
            )}
          >
            {isRunnings ? <Loader2 size={13} className="animate-spin text-brand-violet" /> : <Play size={12} className="text-brand-violet group-hover:fill-brand-violet transition-colors" />}
            <span>{(isRunnings || isRunning) ? "Running…" : "Run Code"}</span>
          </button>

          <button
            onClick={onRun}
            disabled={isRunning|| isRunnings}
            title="Run against all test cases — required to mark this question as answered"
            className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_4px_14px_-3px_rgba(124,58,237,0.55)] hover:shadow-[0_8px_20px_-4px_rgba(124,58,237,0.65)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 sm:px-3.5"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} className="fill-white" />}
            <span>{(isRunning || isRunnings) ? "Running…" : "Run Tests"}</span>
          </button>
        </div>
      </div>

      {/* ── Monaco Editor (fills available height) ── */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
      <Editor
        key={monacoLanguage}
        height="100%"
        language={monacoLanguage}
        value={value}
        onChange={handleChange}
        theme={editorTheme}
        onMount={(editor) => {
          editor.onDidFocusEditorWidget(() => {
            onEditorFocus?.()
          })
        }}
        options={{
          lineNumbers: "on",
          folding: true,
          bracketPairColorization: { enabled: true },
          autoClosingBrackets: "always",
          autoClosingQuotes: "always",
          formatOnPaste: true,
          formatOnType: true,
          quickSuggestions: true,
          inlineSuggest: { enabled: true },
          wordWrap: "on",
          tabSize: tabSize,
          fontSize: fontSize,
          fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', 'Monaco', monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          scrollBeyondLastLine: false,
          renderLineHighlight: "gutter",
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
        }}
      />
      </div>
    </div>
  );
};

export default CodeEditor;
