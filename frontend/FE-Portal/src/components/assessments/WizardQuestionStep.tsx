import React from "react";
import { Loader2, Plus, Search, Trash2, Wand2, X } from "lucide-react";
import { useAssessmentQuestions } from "@/hooks/useAssessmentQuestions";
import {
  getDifficultyColor,
  getMarksDisplay,
  getQuestionTypeDisplay,
} from "@/components/assessments/assessmentDetailsUtils";

interface WizardQuestionStepProps {
  qb: ReturnType<typeof useAssessmentQuestions>;
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

const QuestionChips: React.FC<{
  type: string;
  difficulty: string;
  marks: number;
}> = ({ type, difficulty, marks }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
      {getQuestionTypeDisplay(type)}
    </span>
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDifficultyColor(
        difficulty
      )}`}
    >
      {difficulty}
    </span>
    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
      {getMarksDisplay(marks)}
    </span>
  </div>
);

export const WizardQuestionStep: React.FC<WizardQuestionStepProps> = ({ qb }) => {
  return (
    <div className="space-y-8">
      {/* 1. Selected questions */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Selected Questions</h3>
          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-violet-50 px-2 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
            {qb.selectedQuestions.length}
          </span>
        </div>

        {qb.selectedQuestions.length === 0 ? (
          <p className="text-sm italic text-slate-400">
            No questions added yet — use auto-fill or pick from the bank below.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {qb.selectedQuestions.map((q) => (
              <li key={q.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 line-clamp-2 text-sm font-medium text-slate-800">
                    {q.title}
                  </p>
                  <QuestionChips
                    type={q.question_type}
                    difficulty={q.difficulty}
                    marks={q.marks}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => qb.onRemoveQuestion(q.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 2. Auto-fill by rules */}
      <section className="border-t border-slate-100 pt-6">
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-brand-violet" />
          <h3 className="text-sm font-semibold text-slate-800">Auto-fill by Rules</h3>
        </div>

        <div className="space-y-2.5">
          {qb.autoFillRules.map((rule) => (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <select
                value={rule.category}
                onChange={(e) => qb.onUpdateAutoFillRule(rule.id, "category", e.target.value)}
                className={`${SELECT_CLASS} min-w-[10rem] flex-1`}
              >
                <option value="">Select category</option>
                {qb.categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>

              <select
                value={rule.type}
                onChange={(e) => qb.onUpdateAutoFillRule(rule.id, "type", e.target.value)}
                className={`${SELECT_CLASS} min-w-[9rem] flex-1`}
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
                onChange={(e) => qb.onUpdateAutoFillRule(rule.id, "difficulty", e.target.value)}
                className={`${SELECT_CLASS} min-w-[8rem] flex-1`}
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
                onChange={(e) => qb.onUpdateAutoFillRule(rule.id, "count", e.target.value)}
                className={`${SELECT_CLASS} w-20`}
              />

              {qb.autoFillRules.length > 1 && (
                <button
                  type="button"
                  onClick={() => qb.onRemoveAutoFillRule(rule.id)}
                  className="text-xs font-semibold text-slate-400 transition-colors hover:text-rose-600"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={qb.onAddAutoFillRule}
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-violet transition-colors hover:text-brand-purple"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </button>

          <button
            type="button"
            onClick={qb.onAutoFillQuestions}
            disabled={!qb.isAutoFillValid}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all ${
              qb.isAutoFillValid
                ? "bg-brand-violet hover:brightness-110"
                : "cursor-not-allowed bg-slate-300"
            }`}
            style={qb.isAutoFillValid ? { backgroundColor: "#7c3aed" } : undefined}
          >
            <Wand2 className="h-4 w-4" />
            Auto-fill
          </button>
        </div>
      </section>

      {/* 3. Add from question bank */}
      <section className="border-t border-slate-100 pt-6">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Add from Question Bank</h3>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions (title, tags, category)…"
            value={qb.searchQuery}
            onChange={(e) => qb.onSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") qb.onSearchSubmit();
            }}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
          />
          {qb.searchQuery && (
            <button
              type="button"
              onClick={qb.onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              title="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto" onScroll={qb.onScroll}>
          {qb.loadingQuestions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-violet" />
              <span className="text-sm text-slate-500">Loading questions…</span>
            </div>
          ) : qb.filteredQuestions.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {qb.searchQuery.trim()
                ? `No questions found for "${qb.searchQuery}"`
                : "No questions available."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {qb.filteredQuestions.map((q) => {
                const added = qb.assessmentQuestionIds.includes(q.id);
                return (
                  <li key={q.id} className="flex items-start gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 line-clamp-2 text-sm font-medium text-slate-800">
                        {q.title}
                      </p>
                      <QuestionChips
                        type={q.question_type}
                        difficulty={q.difficulty}
                        marks={q.marks}
                      />
                    </div>
                    {added ? (
                      <span className="shrink-0 self-center text-xs font-semibold text-slate-400">
                        Added ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => qb.onAddQuestion(q.id)}
                        className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-violet-200 hover:bg-violet-50/60 hover:text-brand-violet"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    )}
                  </li>
                );
              })}

              {qb.loadingMoreQuestions && (
                <li className="flex items-center justify-center py-3">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-brand-violet" />
                  <span className="text-xs text-slate-500">Loading more…</span>
                </li>
              )}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
