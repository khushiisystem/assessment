import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2, Sparkles, Video, ClipboardList, CheckCircle2 } from "lucide-react";
import {
  useLazyGetAssessmentsQuery,
  useLazyGetCandidateMockInterviewsQuery,
} from "@/store";
import { formatDateTime } from "@/utils/commonFunctions";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";

interface CompletedAssessment {
  candidate_assessment_id: number;
  assessment_id: number;
  title: string;
  score: number;
  total_marks: number;
  percentage: number;
  end_time: string;
}

interface CompletedAiAssessment {
  candidate_ai_assessment_id: number;
  assessment_id: number;
  title: string;
  overall_score: number;
  end_time: string;
}

interface MockRow {
  id: number;
  stack: string;
  average_score: number;
  status: string;
  scheduled_at?: string;
  updated_at?: number;
}

interface ApiResponse {
  completed_assessments: CompletedAssessment[];
  ai_completed_assessments: CompletedAiAssessment[];
}

type Kind = "regular" | "ai" | "mock";

interface FeedItem {
  id: string;
  kind: Kind;
  title: string;
  endTime: number;
  scoreText: string;
  scoreTone: "emerald" | "amber" | "rose" | "slate";
  onView?: () => void;
}

const CompletedAssessments: React.FC = () => {
  const navigate = useNavigate();

  const [regularCompleted, setRegularCompleted] = useState<CompletedAssessment[]>([]);
  const [aiCompleted, setAiCompleted] = useState<CompletedAiAssessment[]>([]);
  const [mocks, setMocks] = useState<MockRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [getAssessments] = useLazyGetAssessmentsQuery();
  const [getMockInterviews] = useLazyGetCandidateMockInterviewsQuery();

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [assessmentRes, mockRes] = await Promise.allSettled([
          getAssessments("/candidate/assessments/completed/", true).unwrap(),
          getMockInterviews("/api/mock-interview/my-sessions/", true).unwrap(),
        ]);

        if (assessmentRes.status === "fulfilled") {
          const v = assessmentRes.value as ApiResponse;
          setRegularCompleted(v.completed_assessments ?? []);
          setAiCompleted(v.ai_completed_assessments ?? []);
        } else {
          setError("Failed to load completed assessments");
        }
        if (mockRes.status === "fulfilled") {
          setMocks(mockRes.value as MockRow[]);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load completed assessments");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [getAssessments, getMockInterviews]);

  const toneForPercentage = (p: number): FeedItem["scoreTone"] =>
    p >= 80 ? "emerald" : p >= 60 ? "amber" : p > 0 ? "rose" : "slate";
  const toneForTen = (s: number): FeedItem["scoreTone"] =>
    s >= 8 ? "emerald" : s >= 6 ? "amber" : s > 0 ? "rose" : "slate";
  const toneForFive = (s: number): FeedItem["scoreTone"] =>
    s >= 4 ? "emerald" : s >= 3 ? "amber" : s > 0 ? "rose" : "slate";

  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    regularCompleted.forEach((a) => {
      items.push({
        id: `r-${a.candidate_assessment_id}`,
        kind: "regular",
        title: a.title,
        endTime: new Date(a.end_time).getTime(),
        scoreText: `${a.percentage.toFixed(0)}%`,
        scoreTone: toneForPercentage(a.percentage),
        onView: () =>
          navigate(`/candidate/my-assessments/${a.candidate_assessment_id}/result`),
      });
    });

    aiCompleted.forEach((a) => {
      items.push({
        id: `a-${a.candidate_ai_assessment_id}`,
        kind: "ai",
        title: a.title,
        endTime: new Date(a.end_time).getTime(),
        scoreText: `${a.overall_score}/10`,
        scoreTone: toneForTen(a.overall_score),
        onView: () => navigate(`/candidate/ai-assessment/${a.assessment_id}/result`),
      });
    });

    mocks.forEach((m) => {
      const ts =
        m.updated_at && Number.isFinite(m.updated_at)
          ? (m.updated_at as number) * 1000
          : m.scheduled_at
            ? new Date(m.scheduled_at).getTime()
            : 0;
      items.push({
        id: `m-${m.id}`,
        kind: "mock",
        title: m.stack,
        endTime: ts,
        scoreText: `${m.average_score}/5`,
        scoreTone: toneForFive(m.average_score),
      });
    });

    items.sort((a, b) => b.endTime - a.endTime);
    return items;
  }, [regularCompleted, aiCompleted, mocks, navigate]);

  const formatWhen = (ms: number) =>
    ms > 0 ? formatDateTime(new Date(ms).toISOString(), "—") : "—";

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
          icon={CheckCircle2}
          title="Completed"
          description={
            feed.length === 0
              ? "Your finished assessments and interviews will appear here"
              : feed.length === 1
                ? "1 finished item"
                : `${feed.length} finished items`
          }
        />

        <SurfaceCard className="p-0" overflowHidden>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-brand-violet" />
                <p className="text-sm text-slate-600">Loading your history…</p>
              </div>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <p className="text-sm text-rose-600">{error}</p>
            </div>
          ) : feed.length === 0 ? (
            <div className="py-16 text-center">
              <ClipboardList className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                Nothing completed yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Once you finish an assessment or interview it'll appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {feed.map((item) => {
                const toneCls =
                  item.scoreTone === "emerald"
                    ? "bg-emerald-50 text-emerald-700"
                    : item.scoreTone === "amber"
                      ? "bg-amber-50 text-amber-700"
                      : item.scoreTone === "rose"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-600";
                const TypeIcon =
                  item.kind === "ai" ? Sparkles : item.kind === "mock" ? Video : ClipboardList;
                const typeLabel =
                  item.kind === "ai"
                    ? "AI Interview"
                    : item.kind === "mock"
                      ? "Mock Interview"
                      : "Assessment";
                const typeChipCls =
                  item.kind === "ai"
                    ? "bg-violet-50 text-brand-violet ring-violet-100"
                    : item.kind === "mock"
                      ? "bg-teal-50 text-teal-700 ring-teal-100"
                      : "bg-sky-50 text-sky-700 ring-sky-100";

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                            typeChipCls
                          )}
                        >
                          <TypeIcon className="h-2.5 w-2.5" />
                          {typeLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Completed {formatWhen(item.endTime)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums",
                          toneCls
                        )}
                      >
                        {item.scoreText}
                      </span>
                      {item.onView ? (
                        <button
                          type="button"
                          onClick={item.onView}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};

export default CompletedAssessments;
