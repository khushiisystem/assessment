import React from "react";
import { Loader2, Plus, Search, Trash2, Wand2, X } from "lucide-react";
import {
  getDifficultyColor,
  getMarksDisplay,
  getQuestionTypeDisplay,
} from "@/components/assessments/assessmentDetailsUtils";
import type { Category } from "@/components/assessments/AssessmentDetailsTypes";

/** Minimal shape kept in component state for a selected question. */
export interface SelectedQuestion {
  id: number;
  title: string;
  question_type: string;
  difficulty: string;
  marks: number;
}

/** A single client-side auto-fill rule row. */
export interface ClientAutoFillRule {
  id: number;
  category: string;
  type: string;
  difficulty: string;
  count: string;
}

export interface WizardQuestionStepClientProps {
  // Selection
  selectedQuestions: SelectedQuestion[];
  onRemoveQuestion: (id: number) => void;
  selectedIds: number[];
  // Bank browsing
  bankQuestions: SelectedQuestion[];
  loadingBank: boolean;
  loadingMoreBank: boolean;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onAddQuestion: (q: SelectedQuestion) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  // Auto-fill
  categories: Category[];
  autoFillRules: ClientAutoFillRule[];
  isAutoFillValid: boolean;
  autoFilling: boolean;
  onAddAutoFillRule: () => void;
  onRemoveAutoFillRule: (id: number) => void;
  onUpdateAutoFillRule: (id: number, field: keyof ClientAutoFillRule, value: string) => void;
  onAutoFill: () => void;
}

const TYPE_OPTIONS = [
  { value: "mcq_single", label: "MCQ (Single)" },
  { value: "mcq_multiple", label: "MCQ (Multiple)" },
  { value: "subjective", label: "Subjective" },
  { value: "coding", label: "Coding" },
  { value: "sql", label: "SQL" },
  { value: "true_false", label: "True/False" },
  { value: "fill_blank", label: "Fill Blank" },
];

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Any difficulty" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40";

const QuestionChips: React.FC<{ type: string; difficulty: string; marks: number }> = ({
  type,
  difficulty,
  marks,
}) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
      {getQuestionTypeDisplay(type)}
    </span>
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDifficultyColor(difficulty)}`}>
      {difficulty}
    </span>
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
      {getMarksDisplay(marks)}
    </span>
  </div>
);

/**
 * CLIENT-SIDE question selection step. No API writes — selection lives entirely
 * in the parent's component state. The bank browse + auto-fill only READ from
 * the questions endpoint; results are merged into the selected-state array.
 */
export const WizardQuestionStepClient: React.FC<WizardQuestionStepClientProps> = ({
  selectedQuestions,
  onRemoveQuestion,
  selectedIds,
  bankQuestions,
  loadingBank,
  loadingMoreBank,
  onScroll,
  onAddQuestion,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  categories,
  autoFillRules,
  isAutoFillValid,
  autoFilling,
  onAddAutoFillRule,
  onRemoveAutoFillRule,
  onUpdateAutoFillRule,
  onAutoFill,
}) => {
  return (
    <div className="space-y-5">
      {/* Auto-fill bar — compact, on top */}
      <section className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
        <div className="mb-2.5 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand-violet" />
          <h3 className="text-sm font-semibold text-slate-800">Auto-fill by Rules</h3>
          <span className="hidden text-xs text-slate-400 sm:inline">
            — quickly add questions matching a category, type &amp; difficulty
          </span>
        </div>

        <div className="space-y-2">
          {autoFillRules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <select
                value={rule.category}
                onChange={(e) => onUpdateAutoFillRule(rule.id, "category", e.target.value)}
                className={`${SELECT_CLASS} min-w-[9rem] flex-1`}
              >
                <option value="">Select category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={rule.type}
                onChange={(e) => onUpdateAutoFillRule(rule.id, "type", e.target.value)}
                className={`${SELECT_CLASS} min-w-[8rem] flex-1`}
              >
                <option value="">Select type</option>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={rule.difficulty}
                onChange={(e) => onUpdateAutoFillRule(rule.id, "difficulty", e.target.value)}
                className={`${SELECT_CLASS} min-w-[7.5rem] flex-1`}
              >
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min="1"
                placeholder="Count"
                value={rule.count}
                onChange={(e) => onUpdateAutoFillRule(rule.id, "count", e.target.value)}
                className={`${SELECT_CLASS} w-20`}
              />

              {autoFillRules.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveAutoFillRule(rule.id)}
                  className="text-xs font-semibold text-slate-400 transition-colors hover:text-rose-600"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={onAddAutoFillRule}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-violet transition-colors hover:text-brand-purple"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </button>

          <button
            type="button"
            onClick={onAutoFill}
            disabled={!isAutoFillValid || autoFilling}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-all ${
              isAutoFillValid && !autoFilling
                ? "hover:brightness-110"
                : "cursor-not-allowed bg-slate-300"
            }`}
            style={isAutoFillValid && !autoFilling ? { backgroundColor: "#7c3aed" } : undefined}
          >
            {autoFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Auto-fill
          </button>
        </div>
      </section>

      {/* Two panes: Question Bank (left) · Selected (right) — each scrolls on its own */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Question bank */}
        <section className="flex min-h-0 flex-col">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Question Bank</h3>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search questions…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div
            className="h-[24rem] overflow-y-auto rounded-xl border border-slate-200/70 px-3"
            onScroll={onScroll}
          >
            {loadingBank ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-violet" />
                <span className="text-sm text-slate-500">Loading questions…</span>
              </div>
            ) : bankQuestions.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {searchQuery.trim() ? `No questions found for "${searchQuery}"` : "No questions available."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bankQuestions.map((q) => {
                  const added = selectedIds.includes(q.id);
                  return (
                    <li key={q.id} className="flex items-start gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 line-clamp-2 text-sm font-medium text-slate-800">{q.title}</p>
                        <QuestionChips type={q.question_type} difficulty={q.difficulty} marks={q.marks} />
                      </div>
                      {added ? (
                        <span className="shrink-0 self-center text-xs font-semibold text-emerald-600">
                          Added ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAddQuestion(q)}
                          className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50/60 hover:text-brand-violet"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </button>
                      )}
                    </li>
                  );
                })}

                {loadingMoreBank && (
                  <li className="flex items-center justify-center py-3">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-brand-violet" />
                    <span className="text-xs text-slate-500">Loading more…</span>
                  </li>
                )}
              </ul>
            )}
          </div>
        </section>

        {/* Selected questions */}
        <section className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Selected</h3>
            <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-50 px-2 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
              {selectedQuestions.length}
            </span>
          </div>

          <div className="h-[24rem] overflow-y-auto rounded-xl border border-slate-200/70 px-3">
            {selectedQuestions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <Wand2 className="mb-2 h-7 w-7 text-slate-300" />
                <p className="text-sm italic text-slate-400">
                  No questions yet — add from the bank or use auto-fill.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {selectedQuestions.map((q) => (
                  <li key={q.id} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 line-clamp-2 text-sm font-medium text-slate-800">{q.title}</p>
                      <QuestionChips type={q.question_type} difficulty={q.difficulty} marks={q.marks} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveQuestion(q.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title="Remove question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
