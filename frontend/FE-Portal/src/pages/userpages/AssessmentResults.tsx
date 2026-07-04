import { sanitizeHtml } from "@/lib/sanitize";
import React, { useMemo, useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  Star,
  ArrowLeft,
  Award,
  Check,
  X,
  Minus,
  ChevronDown,
  Code2,
  Database,
  FileText,
  Printer,
  Share2,
  Search,
  MoreHorizontal,
} from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import UserLayout from "@/components/UserLayout"
import { useLazyGetCandidateResultQuery, useSubmitCandidateFeedbackMutation } from "@/store"
import { generateCertificatePDF } from "@/lib/generateCertificate"
import { toast } from "@/hooks/use-toast"
import { formatDateValue } from "@/utils/commonFunctions"
import { cn } from "@/lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────
interface QuestionResponse {
  question_id: number
  question_title: string
  question_description: string
  question_type: string
  answer: string
  is_correct: boolean | null
  question_marks?: number
  marks_obtained: number
  correct_answer?: string
  correct_answer_text?: string
  answer_text?: string
  question_options?: Array<{ label: string; value: string }>
}

interface ApiResponse {
  assessment: any
  candidate_assessment: any
  responses: QuestionResponse[]
  stats: { attempted: number; not_attempted: number; correct: number; incorrect: number; not_evaluated?: number }
  feedback: any
}

type Filter = "all" | "correct" | "incorrect" | "skipped"

// ─── Verdict palette (one accent at a time) ──────────────────────────────
type Tone = "emerald" | "violet" | "amber" | "rose"
const verdictFor = (pct: number): { tone: Tone; title: string; sub: string } => {
  if (pct >= 80) return { tone: "emerald", title: "Excellent", sub: "Top-tier performance" }
  if (pct >= 60) return { tone: "violet", title: "Strong", sub: "Above average effort" }
  if (pct >= 40) return { tone: "amber", title: "Fair", sub: "Room to grow" }
  return { tone: "rose", title: "Needs work", sub: "Worth revisiting the fundamentals" }
}

const accentText: Record<Tone, string> = {
  emerald: "text-emerald-600",
  violet: "text-brand-violet",
  amber: "text-amber-600",
  rose: "text-rose-600",
}
const accentBar: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  violet: "bg-brand-violet",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
}
const accentDot: Record<Tone, string> = {
  emerald: "bg-emerald-500",
  violet: "bg-brand-violet",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const formatDuration = (ms: number) => {
  if (ms <= 0) return "—"
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const formatDate = (d: string) =>
  formatDateValue(new Date(d), { year: "numeric", month: "long", day: "numeric" }, d)

const typeFullLabel = (t: string) => {
  switch (t) {
    case "mcq_single": return "Multiple Choice"
    case "mcq_multiple": return "Multi-Select"
    case "coding": return "Coding"
    case "sql": return "SQL"
    case "subjective": return "Long Answer"
    case "true_false": return "True / False"
    case "fill_blank": return "Fill in the Blank"
    default: return t
  }
}
const typeShort = (t: string) => {
  switch (t) {
    case "mcq_single": return "MCQ"
    case "mcq_multiple": return "Multi"
    case "coding": return "Code"
    case "sql": return "SQL"
    case "subjective": return "Long"
    case "true_false": return "T/F"
    case "fill_blank": return "Fill"
    default: return t
  }
}
const typeIcon = (t: string) => (t === "coding" ? Code2 : t === "sql" ? Database : FileText)

// ─── Main ────────────────────────────────────────────────────────────────
const AssessmentResults: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [getCandidateResult] = useLazyGetCandidateResultQuery()
  const [submitCandidateFeedback] = useSubmitCandidateFeedbackMutation()

  const [apiData, setApiData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<Filter>("all")
  const [query, setQuery] = useState("")

  const fetchAssessmentResults = async () => {
    try {
      setLoading(true)
      const data = await getCandidateResult(Number(id)).unwrap()
      setApiData(data as ApiResponse)
    } catch (e) {
      console.error("Error fetching assessment results:", e)
      toast.error("Failed to load assessment results")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) fetchAssessmentResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const derived = useMemo(() => {
    if (!apiData) return null
    const { responses, candidate_assessment } = apiData
    const total = responses.length
    let correct = 0, incorrect = 0, skipped = 0
    const byType: Record<string, { total: number; correct: number; earned: number; possible: number }> = {}
    responses.forEach((r) => {
      const t = r.question_type
      byType[t] = byType[t] || { total: 0, correct: 0, earned: 0, possible: 0 }
      byType[t].total += 1
      byType[t].possible += r.question_marks ?? 0
      byType[t].earned += r.marks_obtained ?? 0
      if (!r.answer?.trim()) skipped += 1
      else if (r.is_correct === true) { correct += 1; byType[t].correct += 1 }
      else incorrect += 1
    })
    const start = candidate_assessment.start_time ? new Date(candidate_assessment.start_time) : null
    const end = candidate_assessment.end_time ? new Date(candidate_assessment.end_time) : null
    const timeMs = start && end ? end.getTime() - start.getTime() : 0
    return { total, correct, incorrect, skipped, byType, timeMs }
  }, [apiData])

  const handleSubmitFeedback = async () => {
    if (!rating) return toast.error("Please select a rating")
    if (!feedback.trim()) return toast.error("Please provide feedback comments")
    try {
      setSubmittingFeedback(true)
      const data = await submitCandidateFeedback({
        id: Number(id),
        data: { rating, comments: feedback.trim() },
      }).unwrap()
      toast.success(data.message || "Feedback submitted successfully")
      await fetchAssessmentResults()
      setRating(0); setFeedback("")
    } catch (e: any) {
      toast.error(e?.data?.message || e?.data?.detail || "Failed to submit feedback")
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const downloadCertificate = async () => {
    if (!apiData) return
    const { candidate_assessment } = apiData
    const c = candidate_assessment.candidate
    const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.username
    await generateCertificatePDF({
      candidateName: name,
      assessmentTitle: candidate_assessment.assessment.title,
      scoreDisplay: `${candidate_assessment.score}/${candidate_assessment.total_marks} (${candidate_assessment.percentage.toFixed(1)}%)`,
      percentageValue: candidate_assessment.percentage,
      completionDate: new Date(candidate_assessment.end_time || candidate_assessment.assigned_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      assessmentType: "normal",
    })
  }

  const toggle = (qid: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid); else next.add(qid)
      return next
    })
  }

  const shareReport = async () => {
    const pct = (apiData?.candidate_assessment?.percentage ?? 0).toFixed(0)
    try {
      if (navigator.share) {
        await navigator.share({ title: "Assessment Result", text: `I scored ${pct}%`, url: window.location.href })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        toast.success("Link copied")
      }
    } catch { /* cancelled */ }
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-brand-violet" />
        </div>
      </UserLayout>
    )
  }
  if (!apiData || !derived) {
    return (
      <UserLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-center">
          <div>
            <p className="text-sm font-semibold text-rose-600">Couldn't load this report</p>
            <button onClick={() => navigate(-1)} className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold">Go back</button>
          </div>
        </div>
      </UserLayout>
    )
  }

  const { candidate_assessment, responses } = apiData
  const pct = candidate_assessment.percentage ?? 0
  const verdict = verdictFor(pct)
  const candidateName = `${candidate_assessment.candidate?.first_name ?? ""} ${candidate_assessment.candidate?.last_name ?? ""}`.trim() || candidate_assessment.candidate?.username || "Candidate"

  const filtered = responses.filter((r) => {
    if (query.trim() && !r.question_title.toLowerCase().includes(query.toLowerCase())) return false
    if (filter === "correct") return r.is_correct === true && r.answer?.trim()
    if (filter === "incorrect") return r.is_correct !== true && r.answer?.trim()
    if (filter === "skipped") return !r.answer?.trim()
    return true
  })

  const filterCounts = {
    all: derived.total,
    correct: derived.correct,
    incorrect: derived.incorrect,
    skipped: derived.skipped,
  }

  return (
    <UserLayout>
      {/* Print isolation — hide everything except the report on print.
          Uses the classic visibility-hidden trick so the UserLayout
          sidebar / mobile nav don't bleed into the PDF, and any element
          tagged `.no-print` (the action buttons, footnote, etc.) is
          dropped from the print render entirely. */}
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
          body * { visibility: hidden !important; }
          .report-print-root, .report-print-root * { visibility: visible !important; }
          .report-print-root {
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
          {/* Top nav — never prints */}
          <div className="no-print mb-6 flex items-center justify-between">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-1">
              {candidate_assessment.certificate_eligible && (
                <button
                  onClick={downloadCertificate}
                  className="group inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-700"
                >
                  <Award className="h-3.5 w-3.5 transition-transform group-hover:rotate-12" />
                  Certificate
                </button>
              )}
              <IconBtn onClick={() => window.print()} title="Print"><Printer className="h-3.5 w-3.5" /></IconBtn>
              <IconBtn onClick={shareReport} title="Share"><Share2 className="h-3.5 w-3.5" /></IconBtn>
            </div>
          </div>

          {/* Document */}
          <motion.article
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="report-print-root rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_40px_-12px_rgba(15,23,42,0.12)] overflow-hidden"
          >
            <div className="px-6 py-7 sm:px-10 sm:py-10 space-y-9">
              {/* ── Brand strip ───────────────────────────────────── */}
              <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <img src="/SkilTechyFavicon.png" alt="SkillTechy" className="h-7 w-7" />
                  <div>
                    <p className="text-sm font-bold tracking-tight text-slate-900 leading-none">SkillTechy</p>
                    <p className="mt-0.5 text-[10px] font-medium tracking-wide text-slate-400 leading-none">Learning &amp; Assessments</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Official Report
                </span>
              </div>

              {/* ── Masthead ─────────────────────────────────────── */}
              <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Assessment Report
                  {candidate_assessment.end_time && (
                    <span> · {formatDate(candidate_assessment.end_time)}</span>
                  )}
                </p>
                <h1 className="mt-2 text-2xl sm:text-[28px] font-bold tracking-tight leading-snug text-slate-900">
                  {candidate_assessment.assessment.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">{candidateName}</p>
              </header>

              <Divider />

              {/* ── Score moment ─────────────────────────────────── */}
              <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Final Score
                  </p>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <motion.span
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                      className={cn("text-6xl sm:text-7xl font-bold tabular-nums leading-none tracking-tight", accentText[verdict.tone])}
                    >
                      {pct.toFixed(0)}
                    </motion.span>
                    <span className="text-xl sm:text-2xl font-semibold text-slate-300">%</span>
                  </div>
                  <p className={cn("mt-3 text-sm font-bold", accentText[verdict.tone])}>{verdict.title}</p>
                  <p className="text-[11px] text-slate-500">{verdict.sub}</p>
                  <p className="mt-3 text-xs text-slate-500 tabular-nums">
                    <span className="font-semibold text-slate-700">{candidate_assessment.score}</span>
                    <span className="text-slate-400">/{candidate_assessment.total_marks} marks</span>
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span>{formatDuration(derived.timeMs)}</span>
                  </p>
                </div>

                <div className="space-y-2.5 sm:pt-2">
                  <MetricRow icon={Check} label="Correct" value={derived.correct} total={derived.total} tone="emerald" />
                  <MetricRow icon={X} label="Incorrect" value={derived.incorrect} total={derived.total} tone="rose" />
                  <MetricRow icon={Minus} label="Skipped" value={derived.skipped} total={derived.total} tone="slate" />
                </div>
              </section>

              <Divider />

              {/* ── By section ───────────────────────────────────── */}
              {Object.keys(derived.byType).length > 0 && (
                <>
                  <section>
                    <SectionLabel>Performance by section</SectionLabel>
                    <div className="mt-4 space-y-4">
                      {Object.entries(derived.byType).map(([t, s]) => {
                        const Icon = typeIcon(t)
                        const sectionPct = s.possible > 0 ? (s.earned / s.possible) * 100 : 0
                        return (
                          <div key={t}>
                            <div className="flex items-center justify-between text-sm">
                              <span className="inline-flex items-center gap-2 text-slate-700">
                                <Icon className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-medium">{typeFullLabel(t)}</span>
                              </span>
                              <span className="tabular-nums text-slate-500">
                                <span className="font-semibold text-slate-900">{s.correct}</span>
                                <span className="text-slate-400">/{s.total}</span>
                                <span className="ml-2 text-[11px] text-slate-400">{sectionPct.toFixed(0)}%</span>
                              </span>
                            </div>
                            <div className="mt-1.5 h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${sectionPct}%` }}
                                transition={{ duration: 0.8, ease: "easeOut" }}
                                className={cn("h-full rounded-full", accentBar[verdict.tone])}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                  <Divider />
                </>
              )}

              {/* ── Question by question ─────────────────────────── */}
              <section>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <SectionLabel>Question by question</SectionLabel>
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
                      {(["all", "correct", "incorrect", "skipped"] as Filter[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize transition-colors",
                            filter === f ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900",
                          )}
                        >
                          {f}
                          <span className="ml-0.5 tabular-nums opacity-70">{filterCounts[f]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 -mx-2 sm:-mx-4 divide-y divide-slate-100 border-y border-slate-100">
                  {filtered.length === 0 ? (
                    <p className="py-10 text-center text-xs text-slate-400">No questions match your filter.</p>
                  ) : (
                    filtered.map((r) => (
                      <QuestionRow
                        key={r.question_id}
                        response={r}
                        index={responses.indexOf(r)}
                        isOpen={expanded.has(r.question_id)}
                        onToggle={() => toggle(r.question_id)}
                      />
                    ))
                  )}
                </div>
              </section>

              <Divider />

              {/* ── Feedback ─────────────────────────────────────── */}
              <FeedbackSection
                existing={apiData.feedback}
                rating={rating}
                hoverRating={hoverRating}
                feedback={feedback}
                submitting={submittingFeedback}
                onRatingChange={setRating}
                onHoverChange={setHoverRating}
                onFeedbackChange={setFeedback}
                onSubmit={handleSubmitFeedback}
              />
            </div>
          </motion.article>

          {/* Footnote — screen only; print gets its own footer inside the article if needed */}
          <p className="no-print mt-6 text-center text-[11px] text-slate-400">
            Generated {formatDate(new Date().toISOString())} · for reference only
          </p>
        </div>
      </div>
    </UserLayout>
  )
}

// ─── Atoms ───────────────────────────────────────────────────────────────
const Divider = () => <div aria-hidden className="h-px bg-slate-100" />

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{children}</h2>
)

const IconBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:text-slate-900"
  >
    {children}
  </button>
)

const MetricRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  total: number
  tone: "emerald" | "rose" | "slate"
}> = ({ icon: Icon, label, value, total, tone }) => {
  const palette = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
    rose: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
    slate: { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
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

// ─── Question Row ────────────────────────────────────────────────────────
const QuestionRow: React.FC<{
  response: QuestionResponse
  index: number
  isOpen: boolean
  onToggle: () => void
}> = ({ response, index, isOpen, onToggle }) => {
  const notAttempted = !response.answer?.trim()
  const isCorrect = response.is_correct === true
  const tone: "emerald" | "rose" | "slate" = notAttempted ? "slate" : isCorrect ? "emerald" : "rose"
  const Icon = notAttempted ? Minus : isCorrect ? Check : X
  const TypeIcon = typeIcon(response.question_type)

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
          tone === "slate" && "bg-slate-100 text-slate-400",
        )}>
          <Icon className="h-3 w-3" strokeWidth={3} />
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-400">Q{index + 1}</span>
        <span className="flex-1 min-w-0 truncate text-sm text-slate-800">{response.question_title}</span>
        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
          <TypeIcon className="h-3 w-3" />
          {typeShort(response.question_type)}
        </span>
        <span className={cn(
          "shrink-0 text-[11px] tabular-nums font-semibold",
          isCorrect ? "text-emerald-700" : notAttempted ? "text-slate-400" : "text-rose-700",
        )}>
          {response.marks_obtained ?? 0}{response.question_marks ? `/${response.question_marks}` : ""}
        </span>
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
              {response.question_description && (
                <div>
                  <FieldLabel>Question</FieldLabel>
                  <div
                    className="prose prose-sm max-w-none text-slate-700 text-xs leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(response.question_description) }}
                  />
                </div>
              )}

              {(response.question_type === "mcq_single" || response.question_type === "mcq_multiple") && response.question_options?.length ? (
                <div>
                  <FieldLabel>Options</FieldLabel>
                  <div className="space-y-1">
                    {response.question_options.map((opt) => {
                      const picked = response.answer?.split(",").map((s) => s.trim()).includes(opt.label) ?? false
                      const isRight = response.correct_answer?.split(",").map((s) => s.trim()).includes(opt.label) ?? false
                      let cls = "border-slate-200 bg-white"
                      let badge = "text-slate-400"
                      let suffix: React.ReactNode = null
                      if (picked && isRight) {
                        cls = "border-emerald-200 bg-emerald-50/40"
                        badge = "text-emerald-600"
                        suffix = <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><Check className="h-2.5 w-2.5" />Your answer · Correct</span>
                      } else if (picked && !isRight) {
                        cls = "border-rose-200 bg-rose-50/40"
                        badge = "text-rose-600"
                        suffix = <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-rose-700"><X className="h-2.5 w-2.5" />Your answer</span>
                      } else if (isRight) {
                        cls = "border-emerald-200 bg-emerald-50/20"
                        badge = "text-emerald-600"
                        suffix = <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><Check className="h-2.5 w-2.5" />Correct answer</span>
                      }
                      return (
                        <div key={opt.label} className={cn("flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs", cls)}>
                          <span className={cn("font-bold tabular-nums", badge)}>{opt.label}</span>
                          <span className="flex-1 text-slate-800">{opt.value}</span>
                          {suffix}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {response.answer?.trim() && response.question_type !== "mcq_single" && response.question_type !== "mcq_multiple" && (
                <div>
                  <FieldLabel>Your answer</FieldLabel>
                  {response.question_type === "coding" || response.question_type === "sql" ? (
                    <pre className="overflow-x-auto rounded-md bg-[#1e1e1e] p-2.5 text-[11px] font-mono text-[#d4d4d4]">
                      {(() => {
                        const sep = response.question_type === "sql" ? "\n\n---[OUTPUT]---\n" : "\n\n---[RESULTS]---\n"
                        return response.answer.includes(sep) ? response.answer.split(sep)[0] : response.answer
                      })()}
                    </pre>
                  ) : (
                    <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-800">{response.answer}</p>
                  )}
                </div>
              )}

              {notAttempted && (
                <p className="rounded-md border border-dashed border-slate-200 bg-white p-2 text-xs italic text-slate-400">Not attempted</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</p>
)

// ─── Feedback ────────────────────────────────────────────────────────────
const FeedbackSection: React.FC<{
  existing: any
  rating: number
  hoverRating: number
  feedback: string
  submitting: boolean
  onRatingChange: (n: number) => void
  onHoverChange: (n: number) => void
  onFeedbackChange: (s: string) => void
  onSubmit: () => void
}> = ({ existing, rating, hoverRating, feedback, submitting, onRatingChange, onHoverChange, onFeedbackChange, onSubmit }) => {
  if (existing) return null
  return (
    <section>
      <SectionLabel>Share your experience</SectionLabel>
      <p className="mt-1 text-sm text-slate-500">Your feedback helps us improve future assessments.</p>
      <div className="mt-4 space-y-3">
        <div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => {
              const active = (hoverRating || rating) >= s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => onRatingChange(s)}
                  onMouseEnter={() => onHoverChange(s)}
                  onMouseLeave={() => onHoverChange(0)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                >
                  <Star className={cn("h-6 w-6 transition-colors", active ? "fill-amber-400 text-amber-400" : "text-slate-200")} />
                </button>
              )
            })}
            {rating > 0 && <span className="ml-2 text-xs font-semibold text-slate-500 tabular-nums">{rating}.0</span>}
          </div>
        </div>
        <Textarea
          value={feedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder="What worked, what could be better…"
          className="min-h-[80px] rounded-md border-slate-200 bg-white text-sm focus-visible:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-200"
        />
        <div className="flex justify-end">
          <button
            onClick={onSubmit}
            disabled={submitting || !rating || !feedback.trim()}
            className="inline-flex h-8 items-center rounded-md bg-slate-900 px-4 text-xs font-semibold text-white transition-all hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Submit feedback"}
          </button>
        </div>
      </div>
    </section>
  )
}

export default AssessmentResults
