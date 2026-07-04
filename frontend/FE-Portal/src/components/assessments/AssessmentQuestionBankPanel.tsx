import React from "react";
import { AlertCircle, FileText, Loader2, Plus, Search, X, Library, Wand2 } from "lucide-react";
import { AutoFillRule, Category, Question } from "./AssessmentDetailsTypes";
import { Dropdown } from "@/components/common/Dropdown";
import { CARD_SHADOW } from "@/lib/uiStyles";

interface AssessmentQuestionBankPanelProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  loadingQuestions: boolean;
  loadingMoreQuestions: boolean;
  filteredQuestions: Question[];
  totalQuestions: number;
  hasMoreQuestions: boolean;
  assessmentQuestionIds: number[];
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onAddQuestion: (questionId: number) => void;
  getDifficultyColor: (difficulty: string) => string;
  getMarksDisplay: (marks: number) => string;
  autoFillRules: AutoFillRule[];
  categories: Category[];
  isAutoFillValid: boolean;
  onAddAutoFillRule: () => void;
  onRemoveAutoFillRule: (ruleId: number) => void;
  onUpdateAutoFillRule: (ruleId: number, field: keyof AutoFillRule, value: string) => void;
  onAutoFillQuestions: () => void;
}

export const AssessmentQuestionBankPanel: React.FC<AssessmentQuestionBankPanelProps> = ({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  onClearSearch,
  loadingQuestions,
  loadingMoreQuestions,
  filteredQuestions,
  totalQuestions,
  hasMoreQuestions,
  assessmentQuestionIds,
  onScroll,
  onAddQuestion,
  getDifficultyColor,
  getMarksDisplay,
  autoFillRules,
  categories,
  isAutoFillValid,
  onAddAutoFillRule,
  onRemoveAutoFillRule,
  onUpdateAutoFillRule,
  onAutoFillQuestions,
}) => {
  const availableQuestions = filteredQuestions.filter((q) => !assessmentQuestionIds.includes(q.id));

  return (
    <div className="space-y-6">
      {/* Add Questions */}
      <div className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white ${CARD_SHADOW}`}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
            <Library className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Question Bank</h2>
            <p className="text-xs text-slate-500">Search and add questions</p>
          </div>
        </div>

        <div className="p-5">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search questions (title, tags, category)…"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearchSubmit();
              }}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
            />
            {searchQuery && (
              <button
                onClick={onClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Searching: <span className="font-semibold text-slate-700">"{searchQuery}"</span>
              </span>
              {loadingQuestions && (
                <span className="flex items-center text-xs text-brand-violet">
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Searching…
                </span>
              )}
            </div>
          )}

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1" onScroll={onScroll}>
            {loadingQuestions ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-violet" />
                <p className="text-xs text-slate-500">Loading questions…</p>
              </div>
            ) : (
              <>
                {availableQuestions.map((question) => (
                  <div
                    key={question.id}
                    className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-1.5 truncate text-xs font-semibold text-slate-800">{question.title}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                          {question.category_name}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDifficultyColor(question.difficulty)}`}>
                          {question.difficulty}
                        </span>
                        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
                          {getMarksDisplay(question.marks)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddQuestion(question.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100"
                      title="Add question"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {loadingMoreQuestions && (
                  <div className="flex items-center justify-center py-2">
                    <Loader2 className="mr-2 h-3 w-3 animate-spin text-brand-violet" />
                    <p className="text-xs text-slate-500">Loading more…</p>
                  </div>
                )}

                {availableQuestions.length === 0 && (
                  <div className="py-8 text-center">
                    {searchQuery.trim() ? (
                      <>
                        <Search className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-xs text-slate-500">No questions found for "{searchQuery}"</p>
                      </>
                    ) : (
                      <>
                        <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                        <p className="text-xs font-medium text-slate-600">No available questions</p>
                        <p className="mt-1 text-xs text-slate-400">All questions are already added</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Showing {availableQuestions.length} of {totalQuestions} total
            {searchQuery.trim() && ` matching "${searchQuery}"`}
            {hasMoreQuestions && !searchQuery.trim() && " · scroll to load more"}
          </p>
        </div>
      </div>

      {/* Auto-fill */}
      <div className={`rounded-2xl border border-violet-200/70 bg-violet-50/40 ${CARD_SHADOW}`}>
        <div className="flex items-center gap-3 border-b border-violet-100 px-5 py-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
            <Wand2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Auto-fill by Rules</h2>
            <p className="text-xs text-slate-500">Add many questions at once</p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          {autoFillRules.map((rule) => (
            <div key={rule.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Category</label>
                <Dropdown
                  value={rule.category}
                  onChange={(v) => onUpdateAutoFillRule(rule.id, "category", v)}
                  options={categories.map((cat) => ({ value: cat.name, label: cat.name }))}
                  placeholder="Select category"
                  buttonClassName="!py-2 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-500">Type</label>
                <Dropdown
                  value={rule.type}
                  onChange={(v) => onUpdateAutoFillRule(rule.id, "type", v)}
                  options={[
                    { value: "mcq_single", label: "MCQ (Single)" },
                    { value: "mcq_multiple", label: "MCQ (Multiple)" },
                    { value: "subjective", label: "Subjective" },
                    { value: "coding", label: "Coding" },
                    { value: "sql", label: "SQL" },
                    { value: "true_false", label: "True/False" },
                    { value: "fill_blank", label: "Fill Blank" },
                  ]}
                  placeholder="Select type"
                  buttonClassName="!py-2 text-xs"
                />
              </div>

              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Difficulty</label>
                  <Dropdown
                    value={rule.difficulty}
                    onChange={(v) => onUpdateAutoFillRule(rule.id, "difficulty", v)}
                    options={[
                      { value: "", label: "Any difficulty" },
                      { value: "easy", label: "Easy" },
                      { value: "medium", label: "Medium" },
                      { value: "hard", label: "Hard" },
                    ]}
                    placeholder="Any difficulty"
                    buttonClassName="!py-2 text-xs"
                  />
                </div>

                <div className="w-20">
                  <label className="mb-1 block text-[11px] font-semibold text-slate-500">Count</label>
                  <input
                    required
                    type="number"
                    min="1"
                    value={rule.count}
                    onChange={(e) => onUpdateAutoFillRule(rule.id, "count", e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                  />
                </div>

                {autoFillRules.length > 1 && (
                  <button
                    onClick={() => onRemoveAutoFillRule(rule.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="Remove rule"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={onAddAutoFillRule}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Rule
            </button>
            <button
              onClick={onAutoFillQuestions}
              disabled={!isAutoFillValid}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-all ${
                isAutoFillValid
                  ? "bg-gradient-to-r from-brand-purple to-brand-violet hover:brightness-110"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Auto-Fill
            </button>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Already-added questions will be skipped.
          </p>
        </div>
      </div>
    </div>
  );
};
