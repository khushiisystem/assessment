import { sanitizeHtml } from "@/lib/sanitize";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  MessageSquare,
  Lightbulb,
  AlertCircle,
  FileText,
  CheckCircle,
  Check,
  X,
  Clock,
  ArrowLeft,
  ArrowRight,
  Award,
  Sparkles,
  ChevronDown,
  Printer,
  Share2,
  Search,
  Minus,
} from 'lucide-react';
import { generateCertificatePDF } from '@/lib/generateCertificate';
import UserLayout from '@/components/UserLayout';
import { useNavigate, useParams } from 'react-router-dom';
import { useLazyCheckAiAssessmentStatusQuery } from '@/store';
import { useLazyGetAiInterviewResultsQuery } from '@/store';
import { AI_EXPERIENCE_TO_LABEL_MAP, AI_ROLE_TO_LABEL_MAP } from "@/constants/roleMappings";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface QuestionAnswer {
  id: number;
  question: string;
  answer: string;
  verification?: {
    score: number;
    covered: string[];
    missing: string[];
    reason: string;
  };
}

interface AssessmentResult {
  id: number;
  title: string;
  role: string;
  experience: string;
  date: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  technicalCompetency: string;
  communicationSkills: string;
  problemSolvingApproach: string;
  keyStrengths: string[];
  areasForImprovement: string[];
  overallAssessment: string;
  questions: QuestionAnswer[];
}

interface ApiResponse {
  status: string;
  assessment: {
    id: number;
    title: string;
    role_type: string;
    experience_level: string;
    start_date: string;
  };
  candidate_assessment: {
    overall_score: number;
    technical_score: number;
    communication_score: number;
    problem_solving_score: number;
    technical_feedback: string;
    communication_feedback: string;
    problem_solving_feedback: string;
    strengths_feedback: string;
    improvement_feedback: string;
    overall_feedback: string;
    generated_questions: string[];
    status?: string;
    certificate_eligible?: boolean;
  };
  candidate_name?: string;
  responses: Array<{
    question_number: number;
    question_text: string;
    answer_text: string;
    answered: boolean;
    verification?: {
      score: number;
      covered: string[];
      missing: string[];
      reason: string;
    };
  }>;
}

const AiInterviewResultspage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pollExhausted, setPollExhausted] = useState(false);
  // Report generation can take up to ~30 minutes, so we don't pin the
  // candidate to this screen — count down 30s, then send them to My
  // Assessments where they can track status and open the report when ready.
  const [redirectSec, setRedirectSec] = useState(30);
  const navigate = useNavigate();
  const [getResults] = useLazyGetAiInterviewResultsQuery();
  // Lightweight Celery-status endpoint used to poll while the heavy /result/
  // payload is still being generated. The full payload is fetched ONCE here
  // and again only after the status endpoint flips to ready.
  const [checkAssessmentStatus] = useLazyCheckAiAssessmentStatusQuery();

  // Polling configuration — `/status/` is cheap (small JSON, single DB
  // lookup). Poll every 3 s for the first full minute so the common
  // 30-60 s BE finish flips the screen almost immediately, then back off
  // to 8 s. Total window ~10 min so 5-10 min report jobs (BE LLM
  // bottleneck) still get picked up automatically.
  const FAST_POLL_INTERVAL_MS = 3_000;
  const SLOW_POLL_INTERVAL_MS = 8_000;
  const FAST_POLL_LIMIT = 20; // first 20 polls = ~60 s of fast cadence
  const POLL_MAX_ATTEMPTS = 90; // 20×3 + 70×8 = 620 s = ~10.3 min
  const pollAttemptsRef = useRef(0);

  // Derive "report ready" from multiple signals — see the polling effect
  // below for the rationale. Defined here so isReportPending below stays
  // consistent and the pending screen doesn't render when scores are
  // already populated.
  const isReportPending = (() => {
    const ca = apiData?.candidate_assessment
    if (!ca) return false
    // BE sometimes returns 'success' instead of 'completed' for the
    // assignment status — accept both (and tolerate case drift).
    const s = (ca.status || "").toString().trim().toLowerCase()
    if (s === 'completed' || s === 'success') return false
    // overall_score check intentionally dropped — the DB default is 0
    // and so is a legit candidate-got-nothing result. We can't tell
    // those apart from `overall_score` alone, so keying off it caused
    // the result page to lock onto an empty placeholder right after
    // submit (BE still processing → score 0 → flagged "ready" →
    // rendered the 0-marks shell). ai_feedback / overall_feedback /
    // technical_feedback only get populated AFTER the scoring task
    // actually runs, so they're the right "scoring is done" signal.
    if ((ca as any).ai_feedback) return false
    if (ca.overall_feedback || ca.technical_feedback) return false
    return true
  })()

  // Count down the auto-redirect while the report is pending; reset otherwise.
  useEffect(() => {
    if (!isReportPending) {
      setRedirectSec(30);
      return;
    }
    const t = window.setInterval(() => setRedirectSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [isReportPending]);

  // Fire the redirect to My Assessments once the countdown hits zero.
  useEffect(() => {
    if (isReportPending && redirectSec === 0) {
      navigate('/candidate/my-assessments');
    }
  }, [isReportPending, redirectSec, navigate]);


  useEffect(() => {
    // Reset poll-counter on a new assessment id so navigating between reports
    // doesn't carry stale state forward.
    pollAttemptsRef.current = 0;
    setPollExhausted(false);
    fetchAssessmentResults();
  }, [id]);

  // Report-available detection. Previously the polling loop only stopped
  // when `candidate_assessment.status === 'completed'`. On BE 430 the
  // result endpoint returns the full report (scores, feedback, verification)
  // but the `status` field never flipped from in_progress → completed, so
  // the FE kept hitting /status/ in a loop even though the data was right
  // in front of the candidate. Treat any of these as "we have a report":
  //   1. status === 'completed' (canonical signal)
  //   2. non-zero overall_score (scoring task finished)
  //   3. ai_feedback set on candidate_assessment (LLM feedback present)
  //   4. overall_feedback / technical_feedback present
  const ca = apiData?.candidate_assessment
  const _statusStr = (ca?.status || "").toString().trim().toLowerCase()
  // overall_score check dropped — see isReportPending for the reason.
  // We keep status (completed/success) and any of the feedback strings
  // because those only land after the scoring task has actually run.
  const reportAvailable = !!ca && (
    _statusStr === 'completed' || _statusStr === 'success' ||
    !!(ca as any).ai_feedback ||
    !!ca.overall_feedback ||
    !!ca.technical_feedback
  )

  useEffect(() => {
    if (!apiData) return;
    if (reportAvailable) return;
    if (pollExhausted) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      if (cancelled) return;
      let ready = false;
      try {
        const statusResp = await checkAssessmentStatus(Number(id)).unwrap();
        if (cancelled) return;
        // The /status/ response shape has drifted across BE versions —
        // `report_ready` has shown up at the top level AND nested under
        // `.data`, and sometimes only `status` flips to completed/success.
        // Accept ANY of those so a ready report never gets stuck behind a
        // shape mismatch (the "stuck at 94% forever" bug).
        const s = (statusResp?.status ?? statusResp?.data?.status ?? '')
          .toString().trim().toLowerCase();
        ready =
          statusResp?.report_ready === true ||
          statusResp?.data?.report_ready === true ||
          s === 'completed' || s === 'success';
      } catch {
        // Network blip — counts as one attempt; keep going until cap.
      }

      if (ready) {
        // Re-fetch the full /result/ payload one final time and bail out.
        await fetchAssessmentResults(true);
        return;
      }

      pollAttemptsRef.current += 1;

      // Safety net: /status/ has historically lagged behind the actual
      // /result/ payload — the BE populates scores/feedback before it flips
      // report_ready (documented in the BE-430 case above). Every 4th poll,
      // re-fetch /result/ directly so a ready report renders even if
      // /status/ never flips. If it turns out ready, `reportAvailable`
      // changes and this effect tears itself down via its cleanup.
      if (pollAttemptsRef.current % 4 === 0) {
        await fetchAssessmentResults(true);
        if (cancelled) return;
      }

      if (pollAttemptsRef.current >= POLL_MAX_ATTEMPTS) {
        if (!cancelled) setPollExhausted(true);
        return;
      }
      // Adaptive cadence: first FAST_POLL_LIMIT polls run on the short
      // interval, then back off to slow so we don't hammer /status/ for
      // the full 10 min window.
      const next =
        pollAttemptsRef.current < FAST_POLL_LIMIT
          ? FAST_POLL_INTERVAL_MS
          : SLOW_POLL_INTERVAL_MS;
      timeoutId = window.setTimeout(poll, next);
    };

    // Kick the first poll without waiting the full interval.
    timeoutId = window.setTimeout(poll, FAST_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [reportAvailable, pollExhausted, id]);

  const fetchAssessmentResults = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);
      // Force a fresh network hit every time. The RTK Query lazy trigger
      // defaults to returning the cached entry for the same endpoint
      // string — so a first call here right after submit (BE still
      // processing) cached `overall_score=0, answers=""`, and every
      // subsequent retry from the polling loop served back the SAME
      // stale entry forever. Result: candidate landed on a 0/0 report
      // even though the assignment finished scoring 30 s later.
      // forceRefetch: true makes the trigger bypass cache and hit
      // network every call.
      const responseData = await getResults(`ai-assessment/${id}/result/`, undefined).unwrap();

      if (responseData.status === 'success') {
        const apiData = responseData;

        setApiData(apiData);

        // Match the polling-side guard exactly. overall_score is NOT a
        // reliable "scoring done" signal — the DB default is 0 and so is
        // a legit candidate-got-everything-wrong result. The feedback
        // strings only land after the scoring task runs, so they're the
        // signal we trust. status='completed' / 'success' is the other
        // canonical signal (BE drift tolerated).
        const ca = apiData.candidate_assessment
        const statusStr = (ca?.status || "").toString().trim().toLowerCase()
        const reportReadyForRender =
          !!ca && (
            statusStr === 'completed' || statusStr === 'success' ||
            !!(ca as any).ai_feedback ||
            !!ca.overall_feedback ||
            !!ca.technical_feedback
          )
        if (reportReadyForRender) {
          // Transform API data to match your component structure
          const transformedResult: AssessmentResult = {
            id: apiData.assessment.id,
            title: apiData.assessment.title,
            role: formatRoleType(apiData.assessment.role_type),
            experience: formatExperienceLevel(apiData.assessment.experience_level),
            date: formatDate(apiData.assessment.start_date),
            overallScore: apiData.candidate_assessment.overall_score || 0,
            technicalScore: apiData.candidate_assessment.technical_score || 0,
            communicationScore: apiData.candidate_assessment.communication_score || 0,
            problemSolvingScore: apiData.candidate_assessment.problem_solving_score || 0,
            technicalCompetency: apiData.candidate_assessment.technical_feedback || 'No feedback available',
            communicationSkills: apiData.candidate_assessment.communication_feedback || 'No feedback available',
            problemSolvingApproach: apiData.candidate_assessment.problem_solving_feedback || 'No feedback available',
            keyStrengths: apiData.candidate_assessment.strengths_feedback
              ? [apiData.candidate_assessment.strengths_feedback]
              : ['No feedback available'],
            areasForImprovement: apiData.candidate_assessment.improvement_feedback
              ? [apiData.candidate_assessment.improvement_feedback]
              : ['No feedback available'],
            overallAssessment: apiData.candidate_assessment.overall_feedback || 'No feedback available',
            questions: apiData.responses.map((response, index) => {
              // Check if the response has an answer and it's not the "Not answered" string
              const hasAnswer = response.answer_text &&
                response.answer_text.trim() !== '' &&
                response.answer_text !== 'Not answered';

              return {
                id: response.question_number,
                question: response.question_text,
                // Keep skipped answers EMPTY (not a placeholder string) — the
                // answered/skipped count, filter and "Skipped" tag all key off
                // `answer.trim()` being non-empty. Stuffing "No answer provided"
                // here made every skipped question count as answered. The row UI
                // renders its own "No answer provided" placeholder when empty.
                answer: hasAnswer ? response.answer_text : '',
                verification: response.verification ? {
                  score: response.verification.score || 0,
                  covered: response.verification.covered || [],
                  missing: response.verification.missing || [],
                  reason: response.verification.reason || 'No feedback available'
                } : undefined,
                technicalScore: 0,
                communicationScore: 0,
                feedback: 'No feedback available'
              };
            })
          };

          setResult(transformedResult);
        } else {
          // Report is still being generated by the backend (Celery). Instead of
          // setting result to null (which shows the "No results found" page),
          // create a minimal placeholder so the page renders non-blocking banner
          // and basic assessment info while polling continues.
          const pendingResult: AssessmentResult = {
            id: apiData.assessment.id,
            title: apiData.assessment.title,
            role: formatRoleType(apiData.assessment.role_type),
            experience: formatExperienceLevel(apiData.assessment.experience_level),
            date: formatDate(apiData.assessment.start_date),
            overallScore: apiData.candidate_assessment?.overall_score || 0,
            technicalScore: apiData.candidate_assessment?.technical_score || 0,
            communicationScore: apiData.candidate_assessment?.communication_score || 0,
            problemSolvingScore: apiData.candidate_assessment?.problem_solving_score || 0,
            technicalCompetency: apiData.candidate_assessment?.technical_feedback || 'Report being generated',
            communicationSkills: apiData.candidate_assessment?.communication_feedback || 'Report being generated',
            problemSolvingApproach: apiData.candidate_assessment?.problem_solving_feedback || 'Report being generated',
            keyStrengths: apiData.candidate_assessment?.strengths_feedback ? [apiData.candidate_assessment.strengths_feedback] : ['Report being generated'],
            areasForImprovement: apiData.candidate_assessment?.improvement_feedback ? [apiData.candidate_assessment.improvement_feedback] : ['Report being generated'],
            overallAssessment: apiData.candidate_assessment?.overall_feedback || 'Report being generated',
            questions: apiData.responses.map((response) => ({
              id: response.question_number,
              question: response.question_text,
              // Empty (not a placeholder) for skipped questions so the
              // answered/skipped tally stays correct while the report generates.
              answer: response.answer_text && response.answer_text.trim() !== '' && response.answer_text !== 'Not answered' ? response.answer_text : '',
              verification: response.verification ? {
                score: response.verification.score || 0,
                covered: response.verification.covered || [],
                missing: response.verification.missing || [],
                reason: response.verification.reason || 'Report being generated'
              } : undefined,
            })),
          };

          setResult(pendingResult);
        }
      } else {
        setError('Failed to fetch assessment results');
      }
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching assessment results:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Helper functions for formatting
  const formatRoleType = (roleType: string): string => {
    return AI_ROLE_TO_LABEL_MAP[roleType] || roleType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatExperienceLevel = (experience: string): string => {
    return AI_EXPERIENCE_TO_LABEL_MAP[experience] || experience.replace('_', ' ');
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  const downloadCertificate = async () => {
    if (!result || !apiData) return;
    const candidatePercentage = (result.overallScore / 10) * 100;
    await generateCertificatePDF({
      candidateName: apiData.candidate_name || 'Candidate',
      assessmentTitle: result.title,
      scoreDisplay: `${result.overallScore.toFixed(1)}/10 (${candidatePercentage.toFixed(0)}%)`,
      percentageValue: candidatePercentage,
      completionDate: result.date,
      assessmentType: 'ai',
    });
  };

  const ScoreCard: React.FC<{
    label: string;
    score: number;
    icon: React.ReactNode;
    color: string;
  }> = ({ label, score, icon, color }) => (
    <div className={`p-6 rounded-xl ${color} bg-opacity-10 border ${color.replace('bg-', 'border-')} border-opacity-20`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-gray-700">{label}</span>
        </div>
        <div className={`text-3xl font-bold ${color.replace('bg-', 'text-')}`}>
          {score.toFixed(1)}/10
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${score * 10}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-2 text-right">
        {score === 0 ? 'Not evaluated yet' : `${score.toFixed(1)} points`}
      </div>
    </div>
  );

  const SectionHeader: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <UserLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Loading assessment results...</p>
          </div>
        </div>
      </UserLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <UserLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Error loading results</h3>
            <p className="text-slate-600 mb-4">{error}</p>
            <button
              onClick={fetchAssessmentResults}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </UserLayout>
    );
  }

  if (isReportPending) {
    return (
      <UserLayout>
        <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.14)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] flex items-center justify-center px-4 py-10 sm:px-6">
          {/* Soft aurora orbs */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 top-12 h-96 w-96 rounded-full bg-brand-violet/20 blur-[120px]" />
            <div className="absolute -right-40 bottom-0 h-[28rem] w-[28rem] rounded-full bg-brand-purple/20 blur-[120px]" />
          </div>

          {/* Minimal glass card */}
          <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/60 bg-white/85 px-8 py-10 text-center shadow-[0_32px_80px_-20px_rgba(15,23,42,0.40),0_8px_24px_-12px_rgba(124,58,237,0.45)] backdrop-blur-xl">
            <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />

            {/* Icon */}
            <span className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_14px_36px_-8px_rgba(124,58,237,0.6)] ring-1 ring-white/25">
              <FileText className="h-8 w-8" />
              <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
            </span>

            <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Generating your report
            </h3>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-600">
              Your report is being generated and may take up to 30 minutes. You will be redirected to{' '}
              <span className="font-semibold text-slate-800">My Assessments</span> in 30 seconds, where you can track its status.
            </p>

            {/* CTA */}
            <button
              type="button"
              onClick={() => navigate('/candidate/my-assessments')}
              className="group relative mt-7 inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(124,58,237,0.65)] active:translate-y-0"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
              <span className="relative">Go to My Assessments</span>
              <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>

            <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
              <Clock className="h-3 w-3" />
              Redirecting in {redirectSec}s
            </p>
          </div>
        </div>
      </UserLayout>
    );
  }

  // If no result data
  if (!result) {
    return (
      <UserLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No results found</h3>
            <p className="text-slate-600">The assessment results could not be loaded.</p>
          </div>
        </div>
      </UserLayout>
    );
  }

  return <AiResultDocument
    result={result}
    apiData={apiData}
    onCertificate={downloadCertificate}
    onBack={() => navigate(-1)}
  />
}

// ─── Editorial Document Layout ───────────────────────────────────────────
type Tone = "emerald" | "violet" | "amber" | "rose"
const aiVerdictFor = (overallOnTen: number): { tone: Tone; title: string; sub: string } => {
  if (overallOnTen >= 8) return { tone: "emerald", title: "Excellent", sub: "Strong all-round performance" }
  if (overallOnTen >= 6) return { tone: "violet", title: "Strong", sub: "Above average across dimensions" }
  if (overallOnTen >= 4) return { tone: "amber", title: "Fair", sub: "Some dimensions need work" }
  return { tone: "rose", title: "Needs work", sub: "Foundational gaps to address" }
}
const aiAccentText: Record<Tone, string> = {
  emerald: "text-emerald-600",
  violet: "text-brand-violet",
  amber: "text-amber-600",
  rose: "text-rose-600",
}
const aiAccentBar: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  violet: "bg-brand-violet",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
}

const AiResultDocument: React.FC<{
  result: AssessmentResult
  apiData: ApiResponse | null
  onCertificate: () => void
  onBack: () => void
}> = ({ result, apiData, onCertificate, onBack }) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<"all" | "answered" | "skipped">("all")
  const [query, setQuery] = useState("")

  const pct = (result.overallScore / 10) * 100
  const verdict = aiVerdictFor(result.overallScore)
  const candidateName = apiData?.candidate_name || "Candidate"
  const isPending = apiData?.candidate_assessment?.status !== "completed"
  // "Evaluation failed silently" detection: BE reports completed but every
  // dimension is 0. Usually means the AI scoring task crashed without
  // marking the assignment as failed. Showing bare 0/0 makes candidates
  // think they scored zero on real questions — surface a clearer state.
  const allScoresZero =
    !isPending &&
    (result.overallScore ?? 0) === 0 &&
    (result.technicalScore ?? 0) === 0 &&
    (result.communicationScore ?? 0) === 0 &&
    (result.problemSolvingScore ?? 0) === 0
  const anyAnswered = result.questions.some((qa) => !!qa.answer?.trim())
  const evaluationIncomplete = allScoresZero && anyAnswered

  const filtered = useMemo(() => {
    return result.questions.filter((qa) => {
      const hasAnswer = !!qa.answer?.trim()
      if (query.trim() && !(qa.question || "").toLowerCase().includes(query.toLowerCase())) return false
      if (filter === "answered") return hasAnswer
      if (filter === "skipped") return !hasAnswer
      return true
    })
  }, [result.questions, filter, query])

  const counts = useMemo(() => {
    let answered = 0
    let skipped = 0
    result.questions.forEach((qa) => (qa.answer?.trim() ? answered++ : skipped++))
    return { all: result.questions.length, answered, skipped }
  }, [result.questions])

  const toggle = (qid: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid); else next.add(qid)
      return next
    })
  }

  const shareReport = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "AI Interview Report", text: `I scored ${result.overallScore.toFixed(1)}/10`, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast.success("Link copied")
      }
    } catch { /* cancelled */ }
  }

  // Strengths / improvements come in as single-string arrays from the BE
  // (each element is often a paragraph) — split on bullet glyphs so the
  // report renders them as a real list.
  const splitFeedbackList = (items: string[]): string[] => {
    if (!items?.length) return []
    return items
      .flatMap((s) => s.split(/\n+|•|-{1,2}\s|\d+\.\s/))
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  const strengthsList = splitFeedbackList(result.keyStrengths)
  const improvementsList = splitFeedbackList(result.areasForImprovement)

  return (
    <UserLayout>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .ai-print-root, .ai-print-root * { visibility: visible !important; }
          .ai-print-root {
            position: absolute !important;
            left: 0 !important; top: 0 !important; right: 0 !important;
            margin: 0 !important; padding: 0 !important;
            max-width: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="bg-slate-50/40 min-h-screen -mx-4 -my-4 px-4 py-6 sm:-mx-6 sm:-my-5 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Top nav */}
          <div className="no-print mb-6 flex items-center justify-between">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <div className="flex items-center gap-1">
              {apiData?.candidate_assessment?.certificate_eligible && (
                <button
                  onClick={onCertificate}
                  className="group inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-700"
                >
                  <Award className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                  Certificate
                </button>
              )}
              <AiIconBtn onClick={() => window.print()} title="Print"><Printer className="h-3.5 w-3.5" /></AiIconBtn>
              <AiIconBtn onClick={shareReport} title="Share"><Share2 className="h-3.5 w-3.5" /></AiIconBtn>
            </div>
          </div>

          {isPending && (
            <div className="no-print mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              <Clock className="mt-0.5 h-3.5 w-3.5 animate-pulse" />
              <div className="text-xs">
                <p className="font-semibold">Report still being generated</p>
                <p className="text-amber-700/80">You'll see the final scores and feedback once it's ready.</p>
              </div>
            </div>
          )}

          {/* Document */}
          <motion.article
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="ai-print-root rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_40px_-12px_rgba(15,23,42,0.12)] overflow-hidden"
          >
            <div className="px-6 py-7 sm:px-10 sm:py-10 space-y-9">
              {/* Brand strip */}
              <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <img src="/SkilTechyFavicon.png" alt="SkillTechy" className="h-7 w-7" />
                  <div>
                    <p className="text-sm font-bold tracking-tight text-slate-900 leading-none">SkillTechy</p>
                    <p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400 leading-none">Premium AI Interview</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Official Report
                </span>
              </div>

              {/* Masthead */}
              <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  AI Interview Report
                  {result.date && <span> · {result.date}</span>}
                </p>
                <h1 className="mt-2 text-2xl sm:text-[28px] font-bold tracking-tight leading-snug text-slate-900">
                  {result.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{candidateName}</p>
                {(result.role || result.experience) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    {result.role && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                        <Target className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-700">{result.role}</span>
                      </span>
                    )}
                    {result.experience && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                        <Clock className="h-3 w-3 text-slate-400" />
                        <span className="font-medium text-slate-700">{result.experience}</span>
                      </span>
                    )}
                  </div>
                )}
              </header>

              <AiDivider />

              {/* Score moment — or "evaluation incomplete" callout when
                  the BE reports completion but every dimension is zero.
                  This stops the report from rendering a misleading
                  0.0/10 "Keep practicing" verdict when the actual cause
                  is a silent AI scoring failure on the backend. */}
              {evaluationIncomplete ? (
                <section className="rounded-2xl border border-amber-200/70 bg-amber-50/40 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-800">Evaluation didn't complete</p>
                      <p className="mt-1 text-xs text-amber-700/90 leading-relaxed">
                        Your answers were recorded but the AI scoring step didn't
                        finish. You aren't being marked as zero — please contact
                        support or refresh in a few minutes. Answers are preserved
                        below.
                      </p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-amber-800/90">
                        <span><strong className="font-bold tabular-nums">{counts.answered}</strong> answered</span>
                        <span><strong className="font-bold tabular-nums">{counts.skipped}</strong> skipped</span>
                        <span><strong className="font-bold tabular-nums">{counts.all}</strong> total</span>
                        <span>status: <strong className="font-semibold">scoring failed</strong></span>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Overall Score</p>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className={cn("text-6xl sm:text-7xl font-bold tabular-nums leading-none tracking-tight", aiAccentText[verdict.tone])}
                      >
                        {result.overallScore.toFixed(1)}
                      </motion.span>
                      <span className="text-xl sm:text-2xl font-semibold text-slate-300">/10</span>
                    </div>
                    <p className={cn("mt-3 text-sm font-bold", aiAccentText[verdict.tone])}>{verdict.title}</p>
                    <p className="text-[11px] text-slate-500">{verdict.sub}</p>
                    <p className="mt-3 text-xs text-slate-500 tabular-nums">
                      <span className="font-semibold text-slate-700">{pct.toFixed(0)}%</span> equivalent ·{" "}
                      <span>{result.questions.length} questions</span>
                    </p>
                  </div>

                  <div className="space-y-2.5 sm:pt-2">
                    <AiMetricRow icon={Check} label="Answered" value={counts.answered} total={counts.all} tone="emerald" />
                    <AiMetricRow icon={Minus} label="Skipped" value={counts.skipped} total={counts.all} tone="slate" />
                  </div>
                </section>
              )}

              <AiDivider />

              {/* Dimensions — hidden when scoring failed (all zeros) so we
                  don't render three empty bars under the failure callout. */}
              {!evaluationIncomplete && (
                <section>
                  <AiSectionLabel>Performance by dimension</AiSectionLabel>
                  <div className="mt-4 space-y-4">
                    <AiDimensionBar icon={Target} label="Technical" score={result.technicalScore} tone={verdict.tone} />
                    <AiDimensionBar icon={MessageSquare} label="Communication" score={result.communicationScore} tone={verdict.tone} />
                    <AiDimensionBar icon={Lightbulb} label="Problem solving" score={result.problemSolvingScore} tone={verdict.tone} />
                  </div>
                </section>
              )}

              {/* Overall feedback (paragraph) */}
              {result.overallAssessment && result.overallAssessment !== "No feedback available" && result.overallAssessment !== "Report being generated" && (
                <>
                  <AiDivider />
                  <section>
                    <AiSectionLabel>Examiner notes</AiSectionLabel>
                    <p className="mt-3 text-sm leading-relaxed text-slate-700">{result.overallAssessment}</p>
                  </section>
                </>
              )}

              {/* Strengths + improvements */}
              {(strengthsList.length > 0 || improvementsList.length > 0) && (
                <>
                  <AiDivider />
                  <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {strengthsList.length > 0 && (
                      <div>
                        <AiSectionLabel>Strengths</AiSectionLabel>
                        <ul className="mt-3 space-y-1.5">
                          {strengthsList.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={3} />
                              <span className="leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {improvementsList.length > 0 && (
                      <div>
                        <AiSectionLabel>Areas to improve</AiSectionLabel>
                        <ul className="mt-3 space-y-1.5">
                          {improvementsList.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                              <span className="leading-relaxed">{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </section>
                </>
              )}

              <AiDivider />

              {/* Questions */}
              <section>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <AiSectionLabel>Questions &amp; answers</AiSectionLabel>
                  <div className="no-print flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search"
                        className="h-7 w-32 rounded-md border border-slate-200 bg-white pl-7 pr-2 text-xs focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
                      />
                    </div>
                    <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
                      {(["all", "answered", "skipped"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize transition-colors",
                            filter === f ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900",
                          )}
                        >
                          {f}
                          <span className="ml-0.5 tabular-nums opacity-70">{counts[f]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 -mx-2 sm:-mx-4 divide-y divide-slate-100 border-y border-slate-100">
                  {filtered.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">No questions match your filter.</p>
                  ) : (
                    filtered.map((qa) => (
                      <AiQuestionRow
                        key={qa.id}
                        qa={qa}
                        isOpen={expanded.has(qa.id)}
                        onToggle={() => toggle(qa.id)}
                      />
                    ))
                  )}
                </div>
              </section>
            </div>
          </motion.article>

          <p className="no-print mt-6 text-center text-[11px] text-slate-400">
            Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · for reference only
          </p>
        </div>
      </div>
    </UserLayout>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────
const AiDivider = () => <div aria-hidden className="h-px bg-slate-100" />

const AiSectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{children}</h2>
)

const AiIconBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
  >
    {children}
  </button>
)

const AiMetricRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  total: number
  tone: "emerald" | "rose" | "slate"
}> = ({ icon: Icon, label, value, total, tone }) => {
  const palette = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700" },
    rose: { bg: "bg-rose-50", text: "text-rose-700" },
    slate: { bg: "bg-slate-100", text: "text-slate-600" },
  }[tone]
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-full", palette.bg, palette.text)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className="text-lg font-bold text-slate-900">{value}</span>
        <span className="text-xs text-slate-400">/{total}</span>
      </div>
    </div>
  )
}

const AiDimensionBar: React.FC<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  score: number
  tone: Tone
}> = ({ icon: Icon, label, score, tone }) => {
  const pct = (score / 10) * 100
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-slate-700">
          <Icon className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-medium">{label}</span>
        </span>
        <span className="tabular-nums text-slate-500">
          <span className="font-semibold text-slate-900">{score.toFixed(1)}</span>
          <span className="text-slate-400">/10</span>
          <span className="ml-2 text-[11px] text-slate-400">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", aiAccentBar[tone])}
        />
      </div>
    </div>
  )
}

// ─── Question Row ────────────────────────────────────────────────────────
const AiQuestionRow: React.FC<{
  qa: QuestionAnswer
  isOpen: boolean
  onToggle: () => void
}> = ({ qa, isOpen, onToggle }) => {
  const hasAnswer = !!qa.answer?.trim()
  const score = qa.verification?.score
  const tone: "emerald" | "rose" | "slate" | "amber" = !hasAnswer
    ? "slate"
    : score === undefined ? "slate"
      : score >= 7 ? "emerald"
      : score >= 4 ? "amber"
      : "rose"
  const Icon = !hasAnswer ? Minus : score === undefined ? FileText : score >= 7 ? Check : score >= 4 ? AlertCircle : X

  const cleanQuestion = useMemo(() => (qa.question || "").replace(/<[^>]*>/g, "").trim(), [qa.question])

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="group flex w-full items-center gap-3 px-2 sm:px-4 py-3 text-left transition-colors hover:bg-slate-50/70"
      >
        <span className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          tone === "emerald" && "bg-emerald-50 text-emerald-600",
          tone === "rose" && "bg-rose-50 text-rose-600",
          tone === "amber" && "bg-amber-50 text-amber-700",
          tone === "slate" && "bg-slate-100 text-slate-400",
        )}>
          <Icon className="h-3 w-3" strokeWidth={3} />
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">Q{qa.id}</span>
        <span className="flex-1 min-w-0 truncate text-sm text-slate-800">{cleanQuestion}</span>
        {score !== undefined && (
          <span className={cn(
            "shrink-0 text-[11px] tabular-nums font-semibold",
            tone === "emerald" && "text-emerald-700",
            tone === "rose" && "text-rose-700",
            tone === "amber" && "text-amber-700",
            tone === "slate" && "text-slate-400",
          )}>
            {score}/10
          </span>
        )}
        {!hasAnswer && (
          <span className="shrink-0 text-[10px] italic text-slate-400">Skipped</span>
        )}
        <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.18 }} className="no-print">
          <ChevronDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-slate-50/40 px-4 sm:px-6 py-4 border-t border-slate-100 space-y-3">
              <div>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Question</p>
                <div
                  className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed [&_*]:!text-slate-700"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(qa.question) }}
                />
              </div>

              <div>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Your answer</p>
                {hasAnswer ? (
                  <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 leading-relaxed">{qa.answer}</p>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 bg-white p-2 text-xs italic text-slate-400">No answer provided</p>
                )}
              </div>

              {qa.verification && hasAnswer && (
                <>
                  {qa.verification.covered.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Covered</p>
                      <ul className="space-y-1">
                        {qa.verification.covered.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" strokeWidth={3} />
                            <span className="leading-relaxed">{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {qa.verification.missing.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Missed</p>
                      <p className="whitespace-pre-line rounded-md border-l-2 border-rose-300 bg-rose-50/40 px-2.5 py-2 text-xs text-slate-700 leading-relaxed">
                        {qa.verification.missing.join(" ")}
                      </p>
                    </div>
                  )}
                  {qa.verification.reason && (
                    <div>
                      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Examiner note</p>
                      <p className="text-xs italic text-slate-600 leading-relaxed">{qa.verification.reason}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AiInterviewResultspage;
