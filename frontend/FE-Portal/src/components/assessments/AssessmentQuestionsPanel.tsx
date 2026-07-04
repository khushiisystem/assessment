import { sanitizeHtml } from "@/lib/sanitize";
import React from "react";
import { FileText, Trash2, X, ListChecks } from "lucide-react";
import { Question } from "./AssessmentDetailsTypes";
import { SurfaceCard } from "@/components/common/SurfaceCard";

interface AssessmentQuestionsPanelProps {
  questions: Question[];
  selectedQuestionIds: Set<number>;
  onQuestionSelection: (questionId: number) => void;
  onUnselectAll: () => void;
  onBulkDeleteClick: () => void;
  onDeleteAll: () => void;
  onRemoveQuestion: (questionId: number) => void;
  getQuestionTypeDisplay: (type: string) => string;
  getDifficultyColor: (difficulty: string) => string;
  getMarksDisplay: (marks: number) => string;
}

export const AssessmentQuestionsPanel: React.FC<AssessmentQuestionsPanelProps> = ({
  questions,
  selectedQuestionIds,
  onQuestionSelection,
  onUnselectAll,
  onBulkDeleteClick,
  onDeleteAll,
  onRemoveQuestion,
  getQuestionTypeDisplay,
  getDifficultyColor,
  getMarksDisplay,
}) => {
  return (
    <SurfaceCard overflowHidden>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
            <ListChecks className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Selected Questions</h2>
            <p className="text-xs text-slate-500">{questions.length} in this assessment</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-2.5 text-[11px] text-slate-500 sm:flex">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Easy</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Medium</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />Hard</span>
          </div>

          {questions.length > 0 &&
            (selectedQuestionIds.size > 0 ? (
              <>
                <button
                  onClick={onUnselectAll}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  title="Unselect all questions"
                >
                  <X className="h-3.5 w-3.5" />
                  Unselect
                </button>
                <button
                  onClick={onBulkDeleteClick}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                  title="Delete selected questions"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Selected ({selectedQuestionIds.size})
                </button>
              </>
            ) : (
              <button
                onClick={onDeleteAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                title="Delete all questions"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove All ({questions.length})
              </button>
            ))}
        </div>
      </div>

      <div className="max-h-[440px] space-y-1.5 overflow-y-auto p-4">
        {questions.map((question) => (
          <div
            key={question.id}
            className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-violet focus:ring-brand-violet/40"
              checked={selectedQuestionIds.has(question.id)}
              onChange={() => onQuestionSelection(question.id)}
              onClick={(e) => e.stopPropagation()}
              title="Select question"
            />

            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-sm font-semibold text-slate-800">{question.title}</p>
              {question.description && (
                <div
                  className="mb-1.5 line-clamp-1 text-xs text-slate-500 [&_*]:!text-slate-500"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.description) }}
                />
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                  {getQuestionTypeDisplay(question.question_type)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDifficultyColor(question.difficulty)}`}>
                  {question.difficulty}
                </span>
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
                  {getMarksDisplay(question.marks)}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {question.category_name}
                </span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveQuestion(question.id);
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Remove question"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        {questions.length === 0 && (
          <div className="py-10 text-center">
            <FileText className="mx-auto mb-2 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No questions added yet</p>
            <p className="mt-1 text-xs text-slate-400">Use the panel on the right to add questions</p>
          </div>
        )}
      </div>
    </SurfaceCard>
  );
};
