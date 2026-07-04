import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Loader2, Clock, CheckCircle2, Sparkles, ClipboardList } from "lucide-react";
import { useLazyGetAssessmentsQuery } from "@/store";
import { formatDateTime, formatDateValue } from "@/utils/commonFunctions";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";

interface Assessment {
  candidate_assessment_id?: number;
  candidate_ai_assessment_id?: number;
  assessment_id: number;
  title: string;
  description: string;
  duration_minutes: number | null;
  start_date: string;
  end_date: string;
  status: "assigned" | "in_progress" | "completed";
  assigned_date: string;
  start_time: string | null;
  total_questions: number;
  is_active: boolean;
  is_currently_active: boolean;
  assessment_type: "ai" | "regular";
}

interface InfoDialogState {
  open: boolean;
  title: string;
  description: string;
}

const formatDate = (iso: string) =>
  formatDateValue(iso, { month: "short", day: "numeric", year: "numeric" }, iso);
const formatDateTimeValue = (iso: string) => formatDateTime(iso, iso);

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

const MyAssessments: React.FC = () => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoDialog, setInfoDialog] = useState<InfoDialogState>({
    open: false,
    title: "",
    description: "",
  });
  const [getAssessments] = useLazyGetAssessmentsQuery();

  useEffect(() => {
    const fetchAssignedAssessments = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAssessments("/candidate/assessments/assigned/", true).unwrap();
        const merged = [...data.assigned_assessments, ...data.ai_assigned_assessments];
        setAssessments(merged);
      } catch {
        setError("Failed to load assessments. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssignedAssessments();
  }, [getAssessments]);

  /** Sort so the candidate sees what to act on first: in_progress, then assigned (urgent first), then completed last. */
  const sortedAssessments = useMemo(() => {
    return [...assessments].sort((a, b) => {
      const rank = (s: Assessment["status"]) =>
        s === "in_progress" ? 0 : s === "assigned" ? 1 : 2;
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      const da = daysUntil(a.end_date) ?? Infinity;
      const db = daysUntil(b.end_date) ?? Infinity;
      return da - db;
    });
  }, [assessments]);

  /** Top-of-page urgent strip — only fires when something is due within 7 days. */
  const urgent = useMemo(() => {
    return sortedAssessments
      .filter((a) => a.status !== "completed")
      .map((a) => ({ a, d: daysUntil(a.end_date) }))
      .filter((x): x is { a: Assessment; d: number } => x.d !== null && x.d > 0 && x.d <= 7);
  }, [sortedAssessments]);

  const pendingCount = sortedAssessments.filter((a) => a.status !== "completed").length;
  const completedCount = sortedAssessments.length - pendingCount;

  const openInfoDialog = (title: string, description: string) =>
    setInfoDialog({ open: true, title, description });

  const handleStartAssessment = (assessment: Assessment) => {
    const now = new Date();
    const startDate = new Date(assessment.start_date);
    const endDate = new Date(assessment.end_date);

    if (now > endDate) {
      openInfoDialog(
        "Assessment Expired",
        `This assessment expired on ${formatDate(assessment.end_date)}. You cannot start it now.`
      );
      return;
    }
    if (!assessment.is_currently_active) {
      openInfoDialog("Assessment Not Active", "This assessment is not currently active.");
      return;
    }
    if (now < startDate) {
      openInfoDialog(
        "Assessment Not Available Yet",
        `Assessment will be available from ${formatDateTimeValue(assessment.start_date)}`
      );
      return;
    }

    if (assessment.assessment_type === "ai") {
      navigate(`/candidate/ai-assessment/${assessment.assessment_id}/introduction`);
    } else {
      navigate(`/candidate/my-assessment/${assessment.candidate_assessment_id}/running`);
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          icon={ClipboardList}
          title="My Assessments"
          description={
            assessments.length === 0
              ? "No assessments assigned"
              : `${pendingCount} to take${completedCount > 0 ? ` · ${completedCount} completed` : ""}`
          }
        />

        {/* Urgent deadlines — only when something is actually due soon */}
        {urgent.length > 0 && (
          <SurfaceCard className="p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Clock className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold text-slate-700">
                {urgent.length === 1 ? "Due soon" : `${urgent.length} due soon`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {urgent.slice(0, 4).map(({ a, d }) => (
                  <button
                    key={a.candidate_assessment_id ?? a.candidate_ai_assessment_id}
                    type="button"
                    onClick={() => handleStartAssessment(a)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                      d <= 2
                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    {d <= 0 ? "Today" : `${d}d`} · {a.title}
                  </button>
                ))}
              </div>
            </div>
          </SurfaceCard>
        )}

        {/* Main list */}
        <SurfaceCard className="p-0" overflowHidden>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-brand-violet" />
                <p className="text-sm text-slate-600">Loading your assessments…</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          ) : assessments.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No assessments assigned</p>
              <p className="mt-1 text-xs text-slate-500">
                Your assigned assessments will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedAssessments.map((a) => {
                const d = daysUntil(a.end_date);
                const expired = d !== null && new Date(a.end_date).getTime() < Date.now();
                const isCompleted = a.status === "completed";
                const isInProgress = a.status === "in_progress";

                const dueChip =
                  isCompleted || a.end_date == null
                    ? null
                    : expired
                      ? { cls: "bg-slate-100 text-slate-500", text: "Expired" }
                      : d !== null && d <= 0
                        ? { cls: "bg-rose-50 text-rose-700", text: "Due today" }
                        : d !== null && d <= 2
                          ? { cls: "bg-rose-50 text-rose-700", text: `Due in ${d}d` }
                          : d !== null && d <= 7
                            ? { cls: "bg-amber-50 text-amber-700", text: `Due in ${d}d` }
                            : { cls: "bg-slate-50 text-slate-600", text: `Due ${formatDate(a.end_date)}` };

                return (
                  <div
                    key={a.candidate_assessment_id ?? a.candidate_ai_assessment_id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    {/* Title + type */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                            a.assessment_type === "ai"
                              ? "bg-violet-50 text-brand-violet ring-violet-100"
                              : "bg-sky-50 text-sky-700 ring-sky-100"
                          )}
                        >
                          {a.assessment_type === "ai" && <Sparkles className="h-2.5 w-2.5" />}
                          {a.assessment_type === "ai" ? "AI" : "Regular"}
                        </span>
                        {!a.is_active && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{a.total_questions} questions</span>
                        {a.duration_minutes != null && <span>·  {a.duration_minutes} min</span>}
                        {dueChip && (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 font-semibold",
                              dueChip.cls
                            )}
                          >
                            {dueChip.text}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Completed
                        </span>
                      ) : expired ? (
                        <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
                          Closed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartAssessment(a)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {isInProgress ? "Pending" : "Start"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      </div>

      <ConfirmationDialog
        open={infoDialog.open}
        title={infoDialog.title}
        description={infoDialog.description}
        confirmText="OK"
        showCancelButton={false}
        confirmTone="primary"
        onOpenChange={(open) => {
          if (!open) setInfoDialog((prev) => ({ ...prev, open: false }));
        }}
        onConfirm={() => setInfoDialog((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

export default MyAssessments;
