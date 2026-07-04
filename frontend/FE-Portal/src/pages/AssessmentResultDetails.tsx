import { sanitizeHtml } from "@/lib/sanitize";
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import {
  Star,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Award,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  MinusCircle,
  FileText,
} from "lucide-react";
import { generateCertificatePDF } from '@/lib/generateCertificate';
import { useToast } from "@/hooks/use-toast";
import { useGetCandidateAssessmentResultQuery } from "@/store";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { formatDateValue } from "@/utils/commonFunctions";
import { BTN_PRIMARY } from "@/lib/uiStyles";

interface Candidate {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string;
  role: string;
  date_joined: string;
  resume_s3_url: string;
  learning_assignments: any[];
}

interface Assessment {
  id: number;
  title: string;
  description: string;
  categories: number[];
  question_ids: number[];
  is_active: boolean;
  duration: number;
  start_date: string;
  end_date: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  instructions: string;
}

interface CandidateAssessment {
  id: number;
  candidate: Candidate;
  assessment: Assessment;
  assigned_by: number;
  assigned_date: string;
  start_time: string;
  end_time: string;
  status: string;
  score: number;
  total_marks: number;
  percentage: number;
  certificate_eligible?: boolean;
}

interface Response {
  question_id: number;
  question_title: string;
  question_type: string;
  question_description?: string;
  question_marks?: string;
  question_difficulty?: string;
  answer: string;
  is_correct: boolean | null;
  marks_obtained: number;
  correct_answer?: string;
  total_marks?: number;
  correct_answer_text?: string;
  output?: any;
  error?: string;
  test_summary?: {
    passed_count: number;
    total_cases: number;
    earned_points: number;
    total_points: number;
  };
  answer_text?: string;
  question_options?: Array<{
    label: string;
    value: string;
  }>;
}

interface ProctoringIncident {
  id: number;
  candidate: number;
  assessment: number;
  incident_type: string;
  timestamp: string;
  details: string;
  screenshot_s3_url: string | null;
  severity: string;
}

interface ApiResponse {
  candidate_assessment: CandidateAssessment;
  responses: Response[];
  proctoring_incidents: ProctoringIncident[];
  incident_summary: Record<string, any>;
}

export const AssessmentResultDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  // RTK Query hook
    const { data: apiData, isLoading, isError } = useGetCandidateAssessmentResultQuery(
        Number(id),
        { skip: !id }
    );

  useEffect(() => {
    if (isError) {
      toast({
        title: "Failed",
        description: "Failed to load assessment result details",
        variant: "destructive",
                duration: 3000
      });
    }
  }, [isError]);

  const toggleQuestion = (questionId: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId);
    } else {
      newExpanded.add(questionId);
    }
    setExpandedQuestions(newExpanded);
  };

  const calculateMetrics = () => {
    if (!apiData) return null;

    const { responses, candidate_assessment } = apiData;

    const totalQuestions = responses.length;
        const attemptedQuestions = responses.filter(r => r.answer && r.answer.trim() !== ""
    ).length;
        const correctAnswers = responses.filter(r => r.is_correct === true
    ).length;
    const incorrectAnswers = responses.filter(
            r =>
        r.answer &&
        r.answer.trim() !== "" &&
                (r.is_correct === false || r.is_correct === null)
    ).length;

    const accuracy =
      attemptedQuestions > 0
        ? Math.round((correctAnswers / attemptedQuestions) * 100)
        : 0;

    return {
      totalQuestions,
      attemptedQuestions,
      correctAnswers,
      incorrectAnswers, // includes not evaluated now
      accuracy,
      score: candidate_assessment.score,
      totalMarks: candidate_assessment.total_marks,
            percentage: candidate_assessment.percentage
    };
  };

  const calculateTimeTaken = () => {
    if (!apiData) return "-";

    const { start_time, end_time } = apiData.candidate_assessment;

    if (!start_time || !end_time) return "-";

    try {
      const start = new Date(start_time);
      const end = new Date(end_time);
      const diffMs = end.getTime() - start.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      return `${diffMins} min`;
    } catch (error) {
      return "-";
    }
  };

  const formatDate = (dateString: string) =>
    formatDateValue(
      dateString,
            { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" },
            dateString
    );

  const getQuestionTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
            'mcq_single': 'MCQ (Single Correct)',
            'mcq_multiple': 'MCQ (Multiple Correct)',
            'coding': 'Coding',
            'sql': 'SQL',
            'descriptive': 'Descriptive',
            'subjective': 'Subjective',
            'true_false': 'True/False',
            'fill_blank': 'Fill in Blank',
    };
    return typeMap[type] || type;
  };


  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
            case 'easy': return 'bg-green-100 text-green-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'hard': return 'bg-red-100 text-red-800';
            default: return 'bg-slate-100 text-slate-700';
    }
  };
  const getStatusBadge = (response: Response) => {
    if (!response.answer || !response.answer.trim()) {
            return <span className="px-2 py-1 rounded text-xs bg-slate-500 text-white min-w-[60px]">Not Attempted</span>;
    }

    if (response.is_correct === true) {
            return <span className="px-2 py-1 rounded text-xs bg-green-600 text-white min-w-[60px]">Correct</span>;
    } else {
      // ❗ false OR null → Incorrect
            return <span className="px-2 py-1 rounded text-xs bg-red-600 text-white min-w-[60px]">Incorrect</span>;
    }
  };

  // const getStatusBadge = (response: Response) => {
  //     if (!response.answer || !response.answer.trim()) {
  //         return <span className="px-2 py-1 rounded text-xs bg-slate-500 text-white min-w-[60px]">Not Attempted</span>;
  //     }

  //     if (response.is_correct === true) {
  //         return <span className="px-2 py-1 rounded text-xs bg-green-600 text-white min-w-[60px]">Correct</span>;
  //     } else if (response.is_correct === false) {
  //         return <span className="px-2 py-1 rounded text-xs bg-red-600 text-white min-w-[60px]">Incorrect</span>;
  //     } else {
  //         return <span className="px-2 py-1 rounded text-xs bg-amber-500 text-white min-w-[60px]">Not Evaluated</span>;
  //     }
  // };

  const toggleAll = () => {
    if (showAll) {
      setExpandedQuestions(new Set());
    } else {
      if (apiData) {
                const allIds = apiData.responses.map(r => r.question_id);
        setExpandedQuestions(new Set(allIds));
      }
    }
    setShowAll(!showAll);
  };

  const ProgressBar = ({ value, color }: { value: number; color: string }) => (
    <div className="w-full bg-slate-200 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-300"
        style={{
          width: `${Math.min(value, 100)}%`,
                    backgroundColor: color
        }}
      ></div>
    </div>
  );

  const downloadCertificate = async () => {
    if (!apiData) return;
    const { candidate_assessment } = apiData;
    const candidate = candidate_assessment.candidate;
        const name = `${candidate.first_name} ${candidate.last_name}`.trim() || candidate.username;
    await generateCertificatePDF({
      candidateName: name,
      assessmentTitle: candidate_assessment.assessment.title,
      scoreDisplay: `${candidate_assessment.score}/${candidate_assessment.total_marks} (${candidate_assessment.percentage.toFixed(1)}%)`,
      percentageValue: candidate_assessment.percentage,
            completionDate: new Date(candidate_assessment.end_time || candidate_assessment.assigned_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
      }),
            assessmentType: 'normal',
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
            case 'high': return 'bg-red-50 border-red-200 text-red-700';
            case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
            case 'low': return 'bg-blue-50 border-blue-200 text-blue-700';
            default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading assessment result details...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!apiData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">No Data Found</h3>
                        <p className="text-slate-600">Unable to load assessment result details.</p>
            <button
              onClick={() => navigate(-1)}
              className={`mt-4 ${BTN_PRIMARY}`}
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Results
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const metrics = calculateMetrics();
  console.log("Calculated Metrics:", metrics);
  const timeTaken = calculateTimeTaken();
  const candidate = apiData.candidate_assessment.candidate;
  const assessment = apiData.candidate_assessment.assessment;

  const pieData = [
        { name: 'Correct', value: metrics?.correctAnswers || 0, color: '#10B981' },
        { name: 'Incorrect', value: metrics?.incorrectAnswers || 0, color: '#EF4444' },
        { name: 'Not Attempted', value: (metrics?.totalQuestions || 0) - (metrics?.attemptedQuestions || 0), color: '#9CA3AF' },
    // { name: 'Not Evaluated', value: metrics?.notEvaluated || 0, color: '#F59E0B' }
  ];

  // ── Derived values for the report hero ──
  const candName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim() || candidate.username || candidate.email || "Candidate";
  const candInitials = candName.slice(0, 2).toUpperCase();
  const pct = metrics?.percentage ?? 0;
  const ringColor = pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
  const RING_C = 2 * Math.PI * 42; // circle r=42
  const passed = apiData.candidate_assessment.certificate_eligible === true;
  const notAttempted = Math.max(0, (metrics?.totalQuestions || 0) - (metrics?.attemptedQuestions || 0));
  const completedOn = apiData.candidate_assessment.end_time || apiData.candidate_assessment.assigned_date;
  const completedLabel = completedOn
    ? new Date(completedOn).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  return (
    <AdminLayout>
      <div>
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </button>
          {apiData?.candidate_assessment?.certificate_eligible && (
            <button
              onClick={downloadCertificate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <Award className="h-3.5 w-3.5" /> Download certificate
            </button>
          )}
        </div>

        {/* ── Candidate report hero ── */}
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Label strip */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <FileText className="h-3 w-3" /> Candidate Assessment Report
            </span>
            <span className="hidden text-[10px] text-slate-400 sm:inline">Completed {completedLabel}</span>
          </div>

          {/* Identity + score */}
          <div className="grid gap-4 p-4 md:grid-cols-[1.5fr_1fr] md:items-center">
            {/* Who + which assessment */}
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-sm font-bold text-white shadow-md">
                {candInitials}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900">{candName}</h1>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {candidate.email}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="text-slate-400">Assessment:</span>
                  <button
                    onClick={() => navigate(`/admin/assessment/${assessment.id}`)}
                    className="font-semibold text-brand-violet hover:underline"
                    title="View assessment"
                  >
                    {assessment.title}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> {timeTaken}</span>
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> {completedLabel}</span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-600">
                    {apiData.candidate_assessment.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Score ring + verdict */}
            <div className="flex items-center justify-center gap-4 rounded-xl bg-slate-50/70 p-3 md:justify-end">
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative h-20 w-20 shrink-0 cursor-help">
                      <svg viewBox="0 0 100 100" className="h-20 w-20 -rotate-90">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="42" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - Math.min(100, Math.max(0, pct)) / 100)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-extrabold text-slate-900">{pct.toFixed(0)}%</span>
                        <span className="text-[9px] font-medium uppercase tracking-wide text-slate-400">Score</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="w-56">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-semibold">Score</span>
                        <span className="font-semibold tabular-nums">{metrics?.score}/{metrics?.totalMarks} = {pct.toFixed(0)}%</span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-300">Marks earned out of total marks.</p>
                      <div className="my-1 border-t border-white/15" />
                      <p className="font-semibold">Answer breakdown</p>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Correct</span>
                        <span className="font-semibold tabular-nums">{metrics?.correctAnswers}/{metrics?.totalQuestions}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Incorrect</span>
                        <span className="font-semibold tabular-nums">{metrics?.incorrectAnswers}/{metrics?.totalQuestions}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Not attempted</span>
                        <span className="font-semibold tabular-nums">{notAttempted}/{metrics?.totalQuestions}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-4 border-t border-white/15 pt-1.5">
                        <span>Accuracy</span>
                        <span className="font-semibold tabular-nums">{metrics?.accuracy}%</span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-300">Correct answers out of the questions attempted.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="text-center md:text-left">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${
                    passed ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {passed ? <CheckCircle className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
                  {passed ? "Passed" : "Completed"}
                </span>
                <p className="mt-1.5 text-xl font-bold text-slate-900">
                  {metrics?.score}<span className="text-sm font-medium text-slate-400">/{metrics?.totalMarks}</span>
                </p>
                <p className="text-[11px] text-slate-500">marks scored</p>
              </div>
            </div>
          </div>

          {/* Metrics strip — compact single line */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 px-4 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-bold text-slate-800">{metrics?.correctAnswers}</span>
              <span className="text-slate-500">Correct</span>
            </span>
            <span className="text-slate-200">|</span>
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-rose-600" />
              <span className="font-bold text-slate-800">{metrics?.incorrectAnswers}</span>
              <span className="text-slate-500">Incorrect</span>
            </span>
            <span className="text-slate-200">|</span>
            <span className="inline-flex items-center gap-1.5">
              <MinusCircle className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-bold text-slate-800">{notAttempted}</span>
              <span className="text-slate-500">Not attempted</span>
            </span>
            <span className="text-slate-200">|</span>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex cursor-help items-center gap-1.5 border-b border-dotted border-slate-300">
                    <Target className="h-3.5 w-3.5 text-brand-violet" />
                    <span className="font-bold text-slate-800">{metrics?.accuracy}%</span>
                    <span className="text-slate-500">Accuracy</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="w-56 text-xs leading-snug">
                  <p className="font-semibold">Accuracy {metrics?.accuracy}%</p>
                  <p className="mt-0.5">Correct answers ÷ questions attempted ({metrics?.correctAnswers} of {metrics?.attemptedQuestions}).</p>
                  <p className="mt-1 text-slate-300">Different from <b>Score</b> ({pct.toFixed(0)}%), which is marks earned ÷ total marks.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Assessment details — merged into this report */}
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <FileText className="h-3 w-3" /> Assessment Details
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Time Limit</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">{assessment.duration} min</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Total Questions</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">{metrics?.totalQuestions}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Attempted</dt>
                <dd className="mt-0.5 text-sm font-semibold text-slate-800">{metrics?.attemptedQuestions} of {metrics?.totalQuestions}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Status</dt>
                <dd className="mt-0.5">
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold capitalize text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {apiData.candidate_assessment.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Started</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-700">{formatDate(apiData.candidate_assessment.start_time)}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Ended</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-700">{formatDate(apiData.candidate_assessment.end_time)}</dd>
              </div>
            </dl>
          </div>
          {/* Candidate feedback — part of the report, not a separate box */}
          {apiData?.feedback && (
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Candidate Feedback
                </span>
                {typeof apiData.feedback.rating === "number" && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${s <= apiData.feedback.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                        />
                      ))}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{apiData.feedback.rating}/5</span>
                  </span>
                )}
              </div>
              {apiData.feedback.comments ? (
                <p className="text-sm italic leading-relaxed text-slate-600">“{apiData.feedback.comments}”</p>
              ) : (
                <p className="text-sm text-slate-400">No comment left.</p>
              )}
              {apiData.feedback.submitted_at && (
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Submitted {new Date(apiData.feedback.submitted_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Proctoring (only shows when there are incidents) */}
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
            {/* Proctoring Incidents */}
            {apiData.proctoring_incidents.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-4">
                                    <h2 className="text-sm font-medium mb-3 text-slate-800">Proctoring Incidents</h2>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {apiData.proctoring_incidents.map((incident, index) => (
                                            <div key={incident.id} className={`p-2 border rounded text-xs ${getSeverityColor(incident.severity)}`}>
                        <div className="flex justify-between mb-1">
                          <span className="font-medium capitalize">
                                                        {incident.incident_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs opacity-75">
                            {formatDate(incident.timestamp)}
                          </span>
                        </div>
                        <p className="opacity-90">{incident.details}</p>
                                                <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${incident.severity === 'high'
                                                    ? 'bg-red-600 text-white'
                                                    : incident.severity === 'medium'
                                                        ? 'bg-yellow-600 text-white'
                                                        : 'bg-blue-600 text-white'
                                                    }`}>
                          {incident.severity.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Incident Summary */}
            {Object.keys(apiData.incident_summary).length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-4">
                                    <h2 className="text-sm font-medium mb-3 text-slate-800">Incident Summary</h2>
                  <div className="space-y-2 text-xs">
                                        {Object.entries(apiData.incident_summary as Record<string, number>).map(([key, value]) => (
                                            <div key={key} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                        <span className="text-slate-600">{key}:</span>
                                                <span className="font-bold text-slate-800 px-2 py-1 bg-white rounded border border-slate-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
        </div>
            {/* Detailed Responses */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-slate-800">
                    Detailed Responses
                  </h2>

                  <div
                    title={showAll ? "hide all" : "show all"}
                    onClick={toggleAll}
                    className="px-0.5 py-0.5 rounded text-xs flex items-center gap-1 cursor-pointer select-none transition-all duration-200 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
                  >

                    {showAll ? (
                      <ChevronUp className="w-5 h-5 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600" />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {apiData.responses.map((response, index) => {
                                        const isExpanded = expandedQuestions.has(response.question_id);
                    return (
                                            <div key={response.question_id} className="border border-slate-200 rounded">
                        {/* Question Header - Always Visible */}
                        <div
                          className="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                          onClick={() => toggleQuestion(response.question_id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <span className="font-medium text-xs">
                              Q{index + 1}: {response.question_title}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mr-3">
                            {/* <p className="text-xs font-medium text-slate-700 mb-1">Marks:</p> */}
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs font-medium">
                              {response.marks_obtained}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(response)}
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-slate-100">
                            <div className="mt-3 space-y-3">
                              {/* Question Type */}
                              <div className="flex gap-4 text-xs">
                                <div>
                                                                    <span className="font-medium text-slate-700">Type: </span>
                                                                    <span className="text-slate-600">{getQuestionTypeText(response.question_type)}</span>
                                </div>
                              </div>
                              {/* Question Description */}
                              {response.question_description && (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-xs font-medium text-slate-700">
                                      Description:
                                    </p>

                                    {response.question_difficulty && (
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-medium capitalize
          ${getDifficultyColor(response.question_difficulty)}`}
                                      >
                                        {response.question_difficulty}
                                      </span>
                                    )}
                                  </div>


                                  <div
                                    className="text-xs bg-gray-900 border border-slate-700 p-3 rounded prose prose-invert max-w-none text-gray-100"

                                                                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(response.question_description) }}
                                  />
                                </div>
                              )}

                              {/* Candidate's Answer */}
                              <div>
                                <p className="text-xs font-medium text-slate-700 mb-1">
                                  Candidate's Answer:
                                </p>

                                {response.answer?.trim() ? (
                                  <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm whitespace-pre-wrap font-mono">

                                    {/* MCQ SINGLE */}
                                                                        {response.question_type === 'mcq_single' && (
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                          {response.answer}
                                        </span>
                                        <span>{response.answer_text}</span>
                                      </div>
                                    )}

                                    {/* MCQ MULTIPLE */}
                                                                        {response.question_type === 'mcq_multiple' && (
                                      <div className="space-y-1">
                                                                                {response.answer.split(',').map((ans, idx) => (
                                                                                    <div key={idx} className="flex items-center gap-2">
                                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                                {ans.trim()}
                                              </span>
                                            </div>
                                          ))}
                                      </div>
                                    )}

                                    {response.question_type === "coding" && (
                                      <div className="space-y-2">
                                        {/* Code Display - Clean (without output and summary) */}
                                        <pre className="text-xs bg-slate-900 text-green-200 p-3 rounded overflow-x-auto">
                                          {(() => {
                                            const separator =
                                              "\n\n---[RESULTS]---\n";
                                            const hasResult =
                                              response.answer?.includes(
                                                separator,
                                              );
                                            const codeOnly = hasResult
                                              ? response.answer.split(
                                                  separator,
                                                )[0]
                                              : response.answer;
                                            const summarySeparator =
                                              "\n\n---[SUMMARY]---\n";
                                            const finalCode =
                                              codeOnly?.split(
                                                summarySeparator,
                                              )[0] || codeOnly;
                                            return (
                                              finalCode || "No code submitted"
                                            );
                                          })()}
                                        </pre>

                                        {/* Output/Error Display */}
                                        {(() => {
                                          const resultsSep =
                                            "\n\n---[RESULTS]---\n";
                                          const summarySep =
                                            "\n\n---[SUMMARY]---\n";
                                          const hasResults =
                                            response.answer?.includes(
                                              resultsSep,
                                            );
                                          if (!hasResults) return null;

                                          try {
                                            const resultsPart =
                                              response.answer.split(
                                                resultsSep,
                                              )[1];
                                            const resultsJson =
                                              resultsPart?.split(summarySep)[0];
                                            const results = JSON.parse(
                                              resultsJson || "[]",
                                            );

                                            const visibleResult =
                                              results.find(
                                                (r: any) => !r.is_hidden,
                                              ) || results[0];
                                            if (!visibleResult) return null;

                                            const errorText = (
                                              visibleResult.compile_output ||
                                              visibleResult.stderr ||
                                              ""
                                            ).trim();
                                            const outputText = (
                                              visibleResult.stdout || ""
                                            ).trim();

                                            // Real error: compile_output ya stderr hai AND wo "Accepted" nahi hai
                                            const isRealError =
                                              errorText !== "" &&
                                              errorText !== "Accepted";

                                            if (isRealError) {
                                              return (
                                                <div className="mt-2 p-3 rounded bg-gray-900 border-l-4 border-red-500">
                                                  <p className="font-semibold text-xs flex items-center gap-1 mb-1 text-red-400">
                                                    <XCircle className="w-3 h-3" />{" "}
                                                    ERROR:
                                                  </p>
                                                  <pre className="text-xs whitespace-pre-wrap font-mono text-red-300">
                                                    {errorText}
                                                  </pre>
                                                </div>
                                              );
                                            }

                                            // Output: stdout hai to dikhao
                                            if (outputText !== "") {
                                              return (
                                                <div className="mt-2 p-3 rounded bg-gray-800 border border-gray-700">
                                                  <p className="font-semibold text-xs flex items-center gap-1 mb-1 text-green-400">
                                                    <CheckCircle className="w-3 h-3" />{" "}
                                                    OUTPUT:
                                                  </p>
                                                  <pre className="text-xs whitespace-pre-wrap font-mono text-gray-200">
                                                    {outputText}
                                                  </pre>
                                                </div>
                                              );
                                            }

                                            return null;
                                          } catch (e) {
                                            return null;
                                          }
                                        })()}

                                        {/* Test Summary Display - Separate Box */}
                                        {(() => {
                                          const summarySeparator =
                                            "\n\n---[SUMMARY]---\n";
                                          const hasSummary =
                                            response.answer?.includes(
                                              summarySeparator,
                                            );
                                          let testSummary = null;

                                          if (hasSummary) {
                                            try {
                                              const summaryPart =
                                                response.answer.split(
                                                  summarySeparator,
                                                )[1];
                                              testSummary =
                                                JSON.parse(summaryPart);
                                            } catch (e) {
                                              testSummary = null;
                                            }
                                          }

                                          return (
                                            testSummary && (
                                              <div className="mt-2 p-2 bg-gray-900 border border-gray-700 rounded">
                                                <p className="text-xs text-green-200">
                                                  Tests Passed:{" "}
                                                  {testSummary.passed_count ||
                                                    0}{" "}
                                                  /{" "}
                                                  {testSummary.total_cases || 0}{" "}
                                                  | Points:{" "}
                                                  {testSummary.earned_points ||
                                                    0}{" "}
                                                  /{" "}
                                                  {testSummary.total_points ||
                                                    0}
                                                </p>
                                              </div>
                                            )
                                          );
                                        })()}
                                      </div>
                                    )}

                                    {/* SQL QUESTION */}
                                    {response.question_type === "sql" && (
                                      <div className="space-y-2">
                                        {/* SQL Query - Clean */}
                                        <pre className="text-xs bg-slate-900 text-green-200 p-3 rounded overflow-x-auto">
                                          {(() => {
                                            const separator =
                                              "\n\n---[OUTPUT]---\n";
                                            const hasResult =
                                              response.answer?.includes(
                                                separator,
                                              );
                                            const queryOnly = hasResult
                                              ? response.answer.split(
                                                  separator,
                                                )[0]
                                              : response.answer;
                                            const finalQuery =
                                              queryOnly?.split(
                                                "\n\n---[SUMMARY]---\n",
                                              )[0] || queryOnly;
                                            return (
                                              finalQuery ||
                                              "No SQL query submitted"
                                            );
                                          })()}
                                        </pre>

                                        {/* Output/Error Display */}
                                        {(() => {
                                          const separator =
                                            "\n\n---[OUTPUT]---\n";
                                          const hasResult =
                                            response.answer?.includes(
                                              separator,
                                            );
                                          const resultPart = hasResult
                                            ? response.answer.split(
                                                separator,
                                              )[1]
                                            : null;
                                          const isError =
                                            resultPart?.startsWith("ERROR:");
                                          const cleanResult = resultPart?.split(
                                            "\n\n---[SUMMARY]---\n",
                                          )[0];
                                          const displayText = isError
                                            ? cleanResult?.replace("ERROR:", "")
                                            : cleanResult;
                                          if (!resultPart) return null;
                                          return (
                                            <div
                                              className={`mt-2 p-3 rounded ${isError ? "bg-gray-900 border-l-4 border-red-500" : "bg-gray-800 border border-gray-700"}`}
                                            >
                                              <p
                                                className={`font-semibold text-xs flex items-center gap-1 mb-1 ${isError ? "text-red-400" : "text-green-400"}`}
                                              >
                                                {isError ? (
                                                  <XCircle className="w-3 h-3" />
                                                ) : (
                                                  <CheckCircle className="w-3 h-3" />
                                                )}
                                                {isError
                                                  ? " SQL ERROR:"
                                                  : " QUERY RESULT:"}
                                              </p>
                                              <pre
                                                className={`text-xs whitespace-pre-wrap font-mono ${isError ? "text-red-300" : "text-gray-200"}`}
                                              >
                                                {displayText}
                                              </pre>
                                            </div>
                                          );
                                        })()}

                                        {/* Test Summary */}
                                        {(() => {
                                          const summarySeparator =
                                            "\n\n---[SUMMARY]---\n";
                                          const hasSummary =
                                            response.answer?.includes(
                                              summarySeparator,
                                            );
                                          let testSummary = null;
                                          if (hasSummary) {
                                            try {
                                              testSummary = JSON.parse(
                                                response.answer.split(
                                                  summarySeparator,
                                                )[1],
                                              );
                                            } catch (e) {
                                              testSummary = null;
                                            }
                                          }
                                          return (
                                            testSummary && (
                                              <div className="mt-2 p-2 bg-gray-900 border border-gray-700 rounded">
                                                <p className="text-xs text-green-200">
                                                  Tests Passed:{" "}
                                                  {testSummary.passed_count ||
                                                    0}{" "}
                                                  /{" "}
                                                  {testSummary.total_cases || 0}{" "}
                                                  | Points:{" "}
                                                  {testSummary.earned_points ||
                                                    0}{" "}
                                                  /{" "}
                                                  {testSummary.total_points ||
                                                    0}
                                                </p>
                                                {testSummary.expected_output && (
                                                  <div className="mt-2 border-t border-gray-700 pt-2">
                                                    <p className="text-xs text-yellow-400 font-semibold mb-1">
                                                      Expected Output:
                                                    </p>
                                                    <pre className="text-xs text-yellow-100 font-mono whitespace-pre-wrap">
                                                      {
                                                        testSummary.expected_output
                                                      }
                                                    </pre>
                                                  </div>
                                                )}
                                              </div>
                                            )
                                          );
                                        })()}
                                      </div>
                                    )}
                                    {/* {(response.question_type === 'coding' ||
                                                                            response.question_type === 'sql' ||
                                                                            response.question_type === 'fill_blank' ||
                                                                            response.question_type === 'true_false' ||
                                                                            response.question_type === 'subjective' ||
                                                                            response.question_type === 'descriptive') && (
                                                                                <pre className="text-xs bg-slate-900 text-green-200 p-3 rounded overflow-x-auto">
                                                                                    {response.answer}
                                                                                </pre>
                                                                            )} */}
                                  </div>
                                ) : (
                                  <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 italic">
                                    Not answered
                                  </div>
                                )}
                              </div>


                              {/* Correct Answer (if available and incorrect/not evaluated) */}
                              {response.correct_answer &&
                                response.is_correct !== true &&
                                response.question_type !== "coding" &&
                                response.question_type !== "sql" && (
                                  <div>
                                    <p className="text-xs font-medium text-slate-700 mb-1">
                                      Correct Answer:
                                    </p>
                                    <div className="bg-green-50 border border-green-200 rounded p-2">
                                      {/* For MCQ Single */}
                                                                        {response.question_type === 'mcq_single' && (
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                            {response.correct_answer}
                                          </span>
                                          <span className="text-sm text-dark">
                                            {response.correct_answer_text}
                                          </span>
                                        </div>
                                      )}

                                      {/* For MCQ Multiple - parse comma-separated correct answers */}
                                                                        {response.question_type === 'mcq_multiple' && (
                                        <div className="space-y-1">
                                                                                {response.correct_answer.split(',').map((ans, idx) => (
                                                                                    <div key={idx} className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                                                  {ans.trim()}
                                                </span>
                                                <span className="text-sm text-dark">
                                                  {/* You might need to map answer labels to text here */}
                                                                                            {response.correct_answer_text?.split(',').map(text => text.trim())[idx]}
                                                </span>
                                              </div>
                                            ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                              {/* Question Options (for MCQ questions) */}
                                                            {(response.question_type === 'mcq_single' || response.question_type === 'mcq_multiple') && (
                                <div>
                                                                    <p className="text-xs font-medium text-slate-700 mb-1">Options:</p>
                                  <div className="grid grid-cols-1 gap-1">
                                                                        {response.question_options?.map((option) => {
                                                                            const isCandidateAnswer = response.answer?.includes(option.label);
                                                                            const isCorrectAnswer = response.correct_answer?.includes(option.label);

                                                                            let bgColor = 'bg-slate-50';
                                                                            let borderColor = 'border-slate-200';
                                                                            let textColor = 'text-slate-700';

                                                                            if (isCandidateAnswer && isCorrectAnswer) {
                                                                                bgColor = 'bg-green-50';
                                                                                borderColor = 'border-green-200';
                                                                                textColor = 'text-green-800';
                                                                            } else if (isCandidateAnswer && !isCorrectAnswer) {
                                                                                bgColor = 'bg-red-50';
                                                                                borderColor = 'border-red-200';
                                                                                textColor = 'text-red-800';
                                        } else if (isCorrectAnswer) {
                                                                                bgColor = 'bg-green-50';
                                                                                borderColor = 'border-green-200';
                                                                                textColor = 'text-green-800';
                                        }

                                        return (
                                          <div
                                            key={option.label}
                                            className={`p-2 border rounded text-sm ${bgColor} ${borderColor}`}
                                          >
                                            <div className="flex items-center gap-2">
                                                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${isCandidateAnswer || isCorrectAnswer
                                                                                            ? 'bg-violet-100 text-brand-violet'
                                                                                            : 'bg-slate-100 text-slate-700'
                                                                                            }`}>
                                                {option.label}
                                              </span>
                                                                                        <span className={textColor}>{option.value}</span>
                                            </div>
                                          </div>
                                        );
                                                                        })}
                                  </div>
                                </div>
                              )}

                              {/* Marks */}
                              <div className="flex justify-between items-center pt-2 border-t">
                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-medium text-slate-700">Marks:</span>
                                  <span className="text-sm font-medium text-slate-800">
                                    {response.marks_obtained}
                                                                        {response.question_marks ? ` / ${response.question_marks}` : ''}
                                  </span>
                                </div>
                              </div>

                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
      </div>
    </AdminLayout>
  );
};
