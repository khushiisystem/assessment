import { sanitizeHtml } from "@/lib/sanitize";
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import FeedbackPopup from "@/components/FeedbackPopup"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { StartGateModal } from "@/components/interview-room/StartGateModal"
import { FullscreenExitModal } from "@/components/interview-room/FullscreenExitModal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  Code2,
  FileText,
  Move,
  Play,
  Maximize2,
  Minimize2,
  Terminal,
  AlertTriangle,
  X,
  Loader2,
  Star,
  ShieldCheck,
  Database,
  Send,
} from "lucide-react"
import {
  useLazyTakeAssessmentQuery,
  useSaveAnswerMutation,
  useSubmitAssessmentMutation,
  useRunSqlMutation,
  useRunCodeMutation,
  useGradeSqlMutation,
  useSubmitCandidateFeedbackMutation,
} from "@/store"
import FixedCameraTile from "./FixedCameraTile"
// Lazy so Monaco (~1MB) is only fetched when a coding question is shown.
const CodeEditor = lazy(() => import("./CodeEditor"))
import CodeRunResultPanel, { RunResult } from "./CodeRunResultPanel"
// import CodeEditor from "@/components/CodeEditor"

// API Response Types
type ApiQuestion = {
  question_id: number
  title: string
  description: string
  question_type: string
  marks: number
  options: string[]
  sample_input: string
  sample_output: string
  answer: string
  code_language: string
}

type ApiResponse = {
  candidate_assessment: {
    id: number
    assessment_id: number
    status: string
    start_time: string
    end_time: string
    duration_minutes: number
    assessment_title: string
  }
  questions: ApiQuestion[]
}

// Component Types
type CodingQuestion = {
  id: string
  number: number
  type: "coding" | "sql"
  marks: number
  subject: string
  // text: string
  title: string
  description: string
  languages: string[]
  initialCode: Record<string, string>
  sample_input: string
  sample_output: string
}

type MCQOption = {
  id: string
  text: string


}

type MCQQuestion = {
  id: string
  number: number
  type: "mcq_single" | "mcq_multiple"
  marks: number
  subject: string
  // text: string
  title: string
  description: string
  options: MCQOption[]
}

type SubjectiveQuestion = {
  id: string
  number: number
  type: "subjective"
  marks: number
  subject: string
  // text: string
  title: string
  description: string

}

type Question = CodingQuestion | MCQQuestion | SubjectiveQuestion

const formatTimeHMS = (seconds: number) => {
  if (seconds < 0) return "00:00:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Self-contained exam countdown. Owns its own 1s tick + state so it re-renders
 * ONLY itself each second — not the 2,800-line parent. Derives remaining time
 * from the server start/end times via `calcRemaining`, and fires `onExpire` once
 * when it hits zero (parent handles auto-submit). onExpire is read via a ref so
 * the interval never resets when the parent re-creates the callback.
 */
const ExamTimer = ({
  assessmentData,
  calcRemaining,
  active,
  onExpire,
}: {
  assessmentData: ApiResponse | null;
  calcRemaining: (data: ApiResponse) => number;
  active: boolean;
  onExpire: () => void;
}) => {
  const [remaining, setRemaining] = useState(() => (assessmentData ? calcRemaining(assessmentData) : 0));
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!assessmentData) return;
    const tick = () => {
      const r = calcRemaining(assessmentData);
      setRemaining(r);
      if (r <= 0 && active && !firedRef.current) {
        firedRef.current = true;
        onExpireRef.current();
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [assessmentData, active, calcRemaining]);

  const warn = remaining <= 600;
  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border px-3.5 py-1.5 shadow-sm transition-all duration-200",
      warn ? "border-rose-200 bg-rose-50/90 text-rose-700 animate-pulse" : "border-slate-200/80 bg-white/90 text-slate-700",
    )}>
      <Clock className={cn("h-4 w-4", warn ? "text-rose-600" : "text-brand-violet")} />
      <span className="text-sm font-bold tabular-nums">{formatTimeHMS(remaining)}</span>
    </div>
  );
};

const AssessmentTestInterface = () => {
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  // activeTab + handleTabChange removed — assessment now uses a single sequential rail across MCQ / Subjective / Coding.
  const [currentQuestion, setCurrentQuestion] = useState(1)
  const [isProctoringActive, setIsProctoringActive] = useState(false)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [codeOutputs, setCodeOutputs] = useState<Record<string, string>>({})
  // Structured run results — parsed from the BE response, drives the
  // LeetCode-style CodeRunResultPanel (verdict banner + per-test cards).
  // Kept alongside the legacy `codeOutputs` string blob so other places
  // that read raw text (localStorage restore etc.) keep working.
  const [runResults, setRunResults] = useState<Record<string, RunResult | null>>({})
  const [selectedLanguages, setSelectedLanguages] = useState<Record<string, string>>({})
  const [terminalVisible, setTerminalVisible] = useState(true)
  const [terminalExpanded, setTerminalExpanded] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(35)
  // Editor + output share theme + fullscreen — lifted here so the
  // output panel reacts together with the Monaco editor.
  const [editorTheme, setEditorTheme] = useState<"vs-dark" | "light">("light")
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false)
  // Page chrome stays light always; isDarkMode kept for components that
  // still expect the legacy prop name.
  const isDarkMode = false
  const [assessmentStarted, setAssessmentStarted] = useState(false)
  const [showFullScreenExitModal, setShowFullScreenExitModal] = useState(false)
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)
  const [showStartGate, setShowStartGate] = useState(true)
  const [policyConsent, setPolicyConsent] = useState(false)
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState("")
  const [proctoringWarning, setProctoringWarning] = useState<string | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [assessmentData, setAssessmentData] = useState<ApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isRunningCode, setIsRunningCode] = useState(false)
  const [isRunningsCode, setIsRunningsCode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExitingFullscreen, setIsExitingFullscreen] = useState(false)

  // Add state for tracking if data has been loaded from localStorage
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false)

  // New state for modals and warnings
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showCopyPasteWarning, setShowCopyPasteWarning] = useState(false)

  // If the take API responds that the assessment is already submitted,
  // store the message here and show a friendly UI.
  const [alreadySubmittedMessage, setAlreadySubmittedMessage] = useState<string | null>(null)
  // Tracks whether the candidate has already submitted in THIS session
  // (vs. came in finding the BE flagged it as submitted already). After
  // submit we used to leave the entire assessment UI on screen — rail,
  // footer with Prev/Next/Submit, the lot — even after the BE accepted
  // the submission. This flag lets us replace the UI with a clean
  // completion screen so the candidate can't keep clicking.
  const [hasSubmitted, setHasSubmitted] = useState(false)
  // Any BE-side blocker that prevents the assessment from starting
  // (subscription expired, role mismatch, assessment not active, etc).
  // Rendered as a friendly screen with kind-specific CTAs instead of
  // leaking the misleading "Full screen and camera permissions are
  // required" toast that the permission catch block used to show.
  const [blockingError, setBlockingError] = useState<{ message: string; kind: "subscription" | "expired" | "generic" } | null>(null)

  // Add state for panel resizing.
  // Lazy initializer picks a viewport-aware default for the problem panel
  // so smaller laptops don't waste a third of the screen on the prompt.
  // The candidate can still drag the divider after the page mounts.
  const [isPanelResizing, setIsPanelResizing] = useState(false)
  const [panelSizes, setPanelSizes] = useState(() => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1280
    // sm (<1024): 38/62, md+lg (1024–1535): 32/68, xl+ (≥1536): 28/72
    const codingLeft = w >= 1536 ? 28 : w >= 1024 ? 32 : 38
    return {
      coding: { left: codingLeft, right: 100 - codingLeft },
      mcq: { left: 50, right: 50 },
    }
  })

  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  // RTK Query hooks
  const [takeAssessment] = useLazyTakeAssessmentQuery()
  const [saveAnswerMutation] = useSaveAnswerMutation()
  const [submitAssessmentMutation] = useSubmitAssessmentMutation()
  const [runSqlMutation] = useRunSqlMutation()
  const [runCodeMutation] = useRunCodeMutation()
  const [gradeSqlMutation] = useGradeSqlMutation()
  const MAX_TAB_SWITCHES = 3;
  const MAX_FULLSCREEN_EXITS = 3;
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [rating, setRating] = useState(0)
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [submitCandidateFeedback] = useSubmitCandidateFeedbackMutation()

  const isSubmissionInProgress = useRef(false)
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSubmittedRef = useRef<boolean>(false);

  // Refs for panel resizing
  const panelResizeRef = useRef({
    isResizing: false,
    startX: 0,
    startLeft: 0,
    startRight: 0,
    tabType: 'coding' as 'coding' | 'mcq'
  })

  // Helper function to calculate timer based on server times
  const calculateTimerFromServerTimes = useCallback((data: ApiResponse) => {
    const startTime = new Date(data.candidate_assessment.start_time);
    const endTime = new Date(data.candidate_assessment.end_time);
    const now = new Date();

    // If current time is before start time, show full duration
    if (now < startTime) {
      const durationSeconds = data.candidate_assessment.duration_minutes * 60;
      return durationSeconds;
    }

    // If current time is after end time, time's up
    if (now > endTime) {
      return 0;
    }

    // Calculate remaining time
    const remainingMs = endTime.getTime() - now.getTime();
    const remainingSeconds = Math.floor(remainingMs / 1000);
    return Math.max(0, remainingSeconds);
  }, []);

  // The 1s countdown + auto-submit-on-expiry now live in the isolated
  // <ExamTimer/> child (see top of file) so this large component no longer
  // re-renders every second. The timer derives remaining time from the same
  // server start/end times via calculateTimerFromServerTimes.

  // Save answers to localStorage with debounce
  useEffect(() => {
    if (!assessmentData || !id || !hasLoadedFromStorage) return

    const answerState = {
      assessmentId: id,
      answers: answers,
      selectedLanguages: selectedLanguages,
      codeOutputs: codeOutputs,
      lastUpdated: new Date().toISOString()
    }

    localStorage.setItem(`assessment_answers_${id}`, JSON.stringify(answerState))
  }, [answers, selectedLanguages, codeOutputs, assessmentData, id, hasLoadedFromStorage])

  // Load answers from localStorage on mount
  const loadAnswersFromStorage = useCallback(() => {
    if (!id) return

    const savedAnswersKey = `assessment_answers_${id}`
    const savedAnswers = localStorage.getItem(savedAnswersKey)

    if (savedAnswers) {
      try {
        const answerState = JSON.parse(savedAnswers)

        // Only restore if it's for the same assessment
        if (answerState.assessmentId === id) {
          setAnswers(answerState.answers || {})
          setSelectedLanguages(answerState.selectedLanguages || {})
          setCodeOutputs(answerState.codeOutputs || {})
          console.log("Restored answers from localStorage")
        }
      } catch (error) {
        console.error("Error parsing saved answers:", error)
      }
    }
    setHasLoadedFromStorage(true)
  }, [id])

  // Convert API response to component format
  const transformApiData = (apiData: ApiResponse) => {
    const codingQuestions: CodingQuestion[] = []
    const mcqQuestions: MCQQuestion[] = []
    const subjectiveQuestions: SubjectiveQuestion[] = []
    let questionNumber = 1

    apiData.questions.forEach((apiQ) => {
      const baseQuestion = {
        id: apiQ.question_id.toString(),
        number: questionNumber++,
        marks: apiQ.marks,
        subject: "General",
        // text: `${apiQ.title}\n\n${apiQ.description}`,
        title: apiQ.title,
        description: apiQ.description,
      }

      if (apiQ.question_type === "coding" || apiQ.question_type === "sql") {
        // For coding questions, include all supported languages
        const languages = apiQ.question_type === "sql"
          ? ["sql"]
          : ["python", "java", "javascript", "typescript", "c", "cpp"]

        // Get initial code for each language
        const initialCode: Record<string, string> = {}

        languages.forEach((lang) => {
          if (lang === "python") {
            initialCode[lang] = `# Write your code here\nprint("Hello, World!")`;

          } else if (lang === "java") {
            initialCode[lang] = `// Write your code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`;

          } else if (lang === "javascript") {
            initialCode[lang] = `// Write your code here\nconsole.log("Hello, World!");`;

          } else if (lang === "typescript") {
            initialCode[lang] = `// Write your code here\nconsole.log("Hello, World!");`;

          } else if (lang === "c") {
            initialCode[lang] = `// Write your code here\n#include <stdio.h>\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`;

          } else if (lang === "cpp") {
            initialCode[lang] = `// Write your code here\n#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`;

          } else if (lang === "sql") {
            initialCode[lang] = `-- Write your code here\nSELECT 'Hello, World!' AS message;`;
          }
        });


        codingQuestions.push({
          ...baseQuestion,
          type: apiQ.question_type,
          languages: languages,
          initialCode: initialCode,
          sample_input: apiQ.sample_input || "No sample input provided",
          sample_output: apiQ.sample_output || "",
        })
      } else if (apiQ.question_type === "mcq_single" || apiQ.question_type === "mcq_multiple") {
        mcqQuestions.push({
          ...baseQuestion,
          type: apiQ.question_type as "mcq_single" | "mcq_multiple",
          options: apiQ.options
            .filter((opt) => opt.trim() !== "")
            .map((opt, idx) => ({
              id: String.fromCharCode(65 + idx),
              text: opt,
            })),
        })
      } else if (apiQ.question_type === "subjective") {
        subjectiveQuestions.push({
          ...baseQuestion,
          type: "subjective",
        })
      } else {
        // BUG FIX: previously this branch was missing, which silently
        // dropped any question whose type wasn't one of the 5 above
        // (true_false, fill_blank, descriptive, or anything the BE
        // adds in the future). The candidate then saw N-1 questions
        // but the result endpoint still returned N — the dropped
        // question reappeared in the report under "Not Attempted".
        // Treat unknown text-like types as subjective so the candidate
        // can at least type an answer and we don't lose the question.
        console.warn(
          "[AssessmentTestInterface] Unmapped question_type, rendering as subjective:",
          apiQ.question_type,
          { question_id: apiQ.question_id, title: apiQ.title },
        )
        subjectiveQuestions.push({
          ...baseQuestion,
          type: "subjective",
        })
      }
    })

    return {
      title: apiData.candidate_assessment.assessment_title,
      codingQuestions,
      mcqQuestions,
      subjectiveQuestions,
      candidateAssessment: apiData.candidate_assessment,
    }
  }

  // Fetch assessment data
  const fetchAssessmentData = async () => {
    if (!id) return

    setIsLoading(true)
    try {
      const responseData = await takeAssessment(Number(id)).unwrap()

      console.log("TAKE API FULL RESPONSE:", responseData)

      console.log("Route param id:", id)



      // Backend may return a `detail` message instead of the usual payload
      if (responseData && (responseData as any).detail) {
        const detailMsg = (responseData as any).detail as string;
        if (/already submitted/i.test(detailMsg)) {
          // Show friendly message and stop further processing
          setAlreadySubmittedMessage(detailMsg);
          setIsLoading(false);
          return null;
        }
      }

      const data: ApiResponse = responseData
      setAssessmentData(data)

      // Load saved answers from localStorage
      loadAnswersFromStorage()

      // Countdown is owned by <ExamTimer/>, which derives remaining time from
      // the authoritative server start/end times every tick — no parent timer
      // state to seed or restore here.

      setAssessmentStarted(true)
      return transformApiData(data)
    } catch (error: any) {
      console.error("Error fetching assessment data:", error)

      // Surface ANY backend-provided `detail` to the candidate. Without this
      // we were swallowing 403 subscription errors and showing the misleading
      // "Full screen and camera permissions are required" toast.
      const detail =
        error?.data?.detail ||
        error?.data?.message ||
        error?.message ||
        null

      if (detail) {
        const msg = String(detail)
        if (/already submitted/i.test(msg)) {
          setAlreadySubmittedMessage(msg)
          setIsLoading(false)
          return null
        }
        let kind: "subscription" | "expired" | "generic" = "generic"
        if (/subscri/i.test(msg)) kind = "subscription"
        else if (/expired|not started|has not started|window/i.test(msg)) kind = "expired"
        setBlockingError({ message: msg, kind })
        setIsLoading(false)
        return null
      }

      setProctoringWarning("Failed to load assessment data. Please refresh.")
      return null
    } finally {
      setIsLoading(false)
    }
  }

  // Save answer with debounce
  const saveAnswer = async (questionId: string, answer: string, codeLanguage?: string) => {
    if (!assessmentData) return

    try {
      const payload: any = {
        question_id: Number.parseInt(questionId),
        assessment_id: assessmentData?.candidate_assessment.assessment_id,
        // candidate_assessment_id: Number.parseInt(id!),   // ✅

        answer: answer || "",
      }

      if (codeLanguage) {
        payload.code_language = codeLanguage
      }

      await saveAnswerMutation(payload).unwrap()
    } catch (error) {
      console.error("Error saving answer:", error)
    }
  }

  // Debounced save function
  const debouncedSave = useCallback(
    (questionId: string, answer: string, codeLanguage?: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveAnswer(questionId, answer, codeLanguage)
      }, 1000) // 1 second debounce
    },
    [assessmentData],
  )





const handleRunCodePlain = async (questionId: string) => {
  const codingQuestion = findCodingQuestion(questionId)
  if (!codingQuestion) return

  setIsRunningsCode(true)
  setTerminalExpanded(true)
  setCodeOutputs((prev) => ({ ...prev, [questionId]: "" }))
  setRunResults((prev) => ({ ...prev, [questionId]: null }))

  const language = getCurrentLanguage(questionId)
  const editorCode = answers[questionId]
  const code =
    typeof editorCode === "string" && editorCode.trim().length > 0
      ? editorCode
      : codingQuestion.initialCode?.[language] || ""

  try {
    // ── SQL: same as existing, needs database data ──
    if (codingQuestion.type === "sql") {
      const sqlData = await runSqlMutation({
        question_id: Number.parseInt(questionId),
        query: code,
      }).unwrap()

      let output = ""
      if (sqlData && sqlData.rows !== undefined) {
        output = formatSQLResultSimple(sqlData)
      } else if (sqlData.error) {
        output = `Error: ${sqlData.error}`
      } else {
        output = JSON.stringify(sqlData, null, 2)
      }

      setCodeOutputs((prev) => ({ ...prev, [questionId]: `▶ Output\n${"─".repeat(40)}\n${output}` }))
      return
    }

    // ── Regular code: same API, only extract stdout ──
    const languageMap: Record<string, string> = {
      python: "python",
      java: "java",
      javascript: "javascript",
      typescript: "typescript",
      c: "c",
      cpp: "cpp",
    }
    const backendLanguage = languageMap[language] || language

    const codeData = await runCodeMutation({
      question_id: Number.parseInt(questionId),
      source_code: code,
      language: backendLanguage,
      stdin: codingQuestion.sample_input || "",
      assessment_id: assessmentData?.candidate_assessment.assessment_id,
    }).unwrap()

    let output = ""

    if (codeData?.status === "success" && codeData?.data?.results?.length > 0) {
      // Has test case results — extract only stdout from each
      const results = codeData.data.results
      results.forEach((testCase: any, index: number) => {
        if (results.length > 1) {
          output += `Run ${index + 1}:\n`
        }
        if (testCase.stdout) {
          output += testCase.stdout.trimEnd() + "\n"
        } else if (testCase.stderr) {
          output += `Runtime Error:\n${testCase.stderr.trimEnd()}\n`
        } else if (testCase.compile_output) {
          output += `Compilation Error:\n${testCase.compile_output.trimEnd()}\n`
        }
      })
      output = output.trimEnd()

    } else if (codeData?.status === "Accepted" || codeData?.stdout) {
      output = codeData.stdout?.trimEnd() || "✅ Code ran successfully with no output."

    } else if (codeData?.status === "Compilation Error") {
      output = `Compilation Error:\n${codeData.compile_output || codeData.stderr || "Unknown error"}`

    } else if (codeData?.status === "Runtime Error") {
      output = `Runtime Error:\n${codeData.stderr || codeData.compile_output || "Unknown error"}`

    } else if (codeData?.stderr) {
      output = `Error:\n${codeData.stderr}`

    } else {
      output = "✅ Code ran successfully with no output."
    }

    setCodeOutputs((prev) => ({
      ...prev,
      [questionId]: `▶ Output\n${"─".repeat(40)}\n${output || "No output"}`,
    }))

    // Mirror to structured result so the LeetCode-style result panel
    // can show the plain "Run Code" output as a single-execution card.
    const lower = output.toLowerCase()
    const isErr =
      lower.includes("compilation error") || lower.includes("runtime error") || lower.includes("error:")
    setRunResults((prev) => ({
      ...prev,
      [questionId]: {
        kind: "single",
        status: isErr
          ? lower.includes("compilation error")
            ? "Compilation Error"
            : "Runtime Error"
          : "Accepted",
        stdout: !isErr ? output : undefined,
        stderr: isErr ? output : undefined,
      },
    }))

  } catch (error: any) {
    const errorMessage =
      error.data?.error ||
      error.data?.detail ||
      error.data?.message ||
      error.message ||
      "Failed to run code"
    setCodeOutputs((prev) => ({
      ...prev,
      [questionId]: `▶ Output\n${"─".repeat(40)}\nError: ${errorMessage}`,
    }))
    setRunResults((prev) => ({
      ...prev,
      [questionId]: { kind: "single", status: "Error", error: errorMessage },
    }))
  } finally {
    setIsRunningsCode(false)
  }
}















  // Run code for coding questions
  const handleRunCode = async (questionId: string) => {
    const codingQuestion = findCodingQuestion(questionId)
    setIsRunningCode(true)
    setTerminalExpanded(true)                                        // ✅ correct name
    setCodeOutputs((prev) => ({ ...prev, [questionId]: "" }))
    setRunResults((prev) => ({ ...prev, [questionId]: null }))
    if (!codingQuestion) return

    const language = getCurrentLanguage(questionId)
    const editorCode = answers[questionId]
    const code =
      typeof editorCode === "string" &&
        editorCode.trim().length > 0
        ? editorCode
        : (
          codingQuestion.initialCode?.[language] || ""
        )
    console.log("FINAL CODE SENT:", code)
    console.log("LANGUAGE:", language)
    console.log("QUESTION ID:", questionId)

    setIsRunningCode(true)
    try {
      let output = ""

      if (codingQuestion.type === "sql") {
        // Handle SQL
        const sqlData = await runSqlMutation({
          question_id: Number.parseInt(questionId),
          query: code,
        }).unwrap()

        const formatTable = (rowData: any[]) => {
          if (!rowData || rowData.length === 0) return "No rows returned";

          if (Array.isArray(rowData[0])) {
            // Array of arrays
            return rowData
              .map(
                (row: any[]) =>
                  "| " +
                  row.map((cell: any) => String(cell ?? "")).join(" | ") +
                  " |",
              )
              .join("\n");
          } else if (typeof rowData[0] === "object" && rowData[0] !== null) {
            // Array of objects
            const keys = Object.keys(rowData[0]);
            const header = "| " + keys.join(" | ") + " |";
            const separator =
              "| " + keys.map((k) => "-".repeat(k.length)).join(" | ") + " |";
            const rows = rowData
              .map(
                (row) =>
                  "| " +
                  keys.map((k) => String(row[k] ?? "")).join(" | ") +
                  " |",
              )
              .join("\n");
            return header + "\n" + separator + "\n" + rows;
          } else {
            // Array of primitives (strings/numbers)
            return rowData
              .map((row: any) => "| " + String(row ?? "") + " |")
              .join("\n");
          }
        };
        
        if (sqlData.error) {
          output = `Error: ${sqlData.error}`;
        } else if (sqlData && sqlData.rows !== undefined) {
          output = "YOUR OUTPUT:\n";
          output += "─".repeat(40) + "\n";
          if (sqlData.rows.length === 0) {
            output += "No rows returned.\n";
          } else {
            const yourFormatted = formatTable(sqlData.rows);
            output += yourFormatted + "\n";
            output += `Total: ${sqlData.rows.length} row(s)`;
            if (sqlData.truncated) output += " (truncated)";
          }
          if (sqlData.expected_rows !== undefined) {
            output += "\n\nEXPECTED OUTPUT:\n";
            output += "─".repeat(40) + "\n";
            if (sqlData.expected_rows.length === 0) {
              output += "No rows expected.\n";
            } else {
              output += formatTable(sqlData.expected_rows);
              output += `\n\nTotal: ${sqlData.expected_rows.length} row(s)`;
            }
            const yourStr = JSON.stringify(sqlData.rows);
            const expStr = JSON.stringify(sqlData.expected_rows);
            output +=
              yourStr === expStr
                ? "\n\nOutput matches expected!"
                : "\n\n Output does not match expected.";
          }
        } else {
          output = JSON.stringify(sqlData, null, 2)
        }
      } else {
        // Handle regular code - map language to backend language codes
        const languageMap: Record<string, string> = {
          python: "python",
          java: "java",
          javascript: "javascript",
          typescript: "typescript",
          c: "c",
          cpp: "cpp",
        }

        const backendLanguage = languageMap[language] || language

        // Run regular code
        const codeData = await runCodeMutation({
          question_id: Number.parseInt(questionId),
          source_code: code,
          language: backendLanguage,
          stdin: codingQuestion.sample_input || "",
          assessment_id: assessmentData?.candidate_assessment.assessment_id,

        }).unwrap()
        console.log("FULL codeData:", JSON.stringify(codeData, null, 2))

        // Handle response (same as before)
        if (codeData) {
          if (codeData.status === "success" && codeData.data) {

            // New format: has test case results

            const { results, summary } = codeData.data

            // ── Structured RunResult for the new result panel ──
            if (results && results.length > 0) {
              const pct = summary && summary.total_points > 0
                ? (summary.earned_points / summary.total_points) * 100
                : 0
              const structured: RunResult = {
                kind: "tests",
                summary: {
                  passedCount: summary?.passed_count ?? results.filter((r: any) => r.passed).length,
                  totalCases: summary?.total_cases ?? results.length,
                  earnedPoints: summary?.earned_points ?? results.reduce((a: number, r: any) => a + (r.received || 0), 0),
                  totalPoints: summary?.total_points ?? results.reduce((a: number, r: any) => a + (r.points || 0), 0),
                  percentage: pct,
                },
                cases: results.map((tc: any, i: number) => {
                  const status = tc.status || ""
                  const error = !tc.passed
                    ? (status === "Compilation Error" ? (tc.compile_output || tc.stderr) : (tc.stderr || tc.compile_output)) || undefined
                    : undefined
                  return {
                    index: i + 1,
                    passed: !!tc.passed,
                    isHidden: !!tc.is_hidden,
                    earned: tc.received ?? 0,
                    points: tc.points ?? 0,
                    input: tc.is_hidden ? undefined : (tc.input ?? ""),
                    expected: tc.is_hidden ? undefined : (tc.expected_output ?? ""),
                    actual: tc.is_hidden ? undefined : (tc.stdout ?? ""),
                    status: status || undefined,
                    error: error ? String(error).trim() : undefined,
                    time: typeof tc.time === "number" ? tc.time : undefined,
                    memory: typeof tc.memory === "number" ? tc.memory : undefined,
                  }
                }),
              }
              setRunResults((prev) => ({ ...prev, [questionId]: structured }))
            }



            if (results && results.length > 0) {

              output = "Test Case Results:\n"

              output += "═".repeat(40) + "\n"



              results.forEach((testCase: any, index: number) => {

                output += `Test Case ${index + 1}:\n`

                output += `  Status: ${testCase.passed ? "PASSED" : "FAILED"}\n`

                output += `  Points: ${testCase.received}/${testCase.points}\n`



                // Show input/output for non-hidden tests

                if (!testCase.is_hidden) {

                  output += `  Input: ${testCase.input}\n`

                  output += `  Expected: ${testCase.expected_output}\n`

                  output += `  Your Output: ${testCase.stdout}\n`

                }



                // Show error if test failed

                // ✅ FIXED - replace the existing error block with this
                if (!testCase.passed) {

                  const status = testCase.status || ""
                  let errorMsg = ""
                  if (status === "Compilation Error") {
                    errorMsg = testCase.compile_output || testCase.stderr || ""
                  } else {
                    errorMsg = testCase.stderr ||
                      testCase.compile_output ||
                      ""
                  } ""
                  if (errorMsg.trim()) {
                    let errorLabel = "Error"
                    if (status === "Compilation Error") {
                      errorLabel = "Compilation Error"
                    }
                    else if (
                      status === "Runtime Error" ||
                      status === "Segmentation Fault" ||
                      status === "Floating Point Exception" ||
                      status === "Time Limit Exceeded" ||
                      status === "Memory Limit Exceeded"
                    ) {
                      errorLabel = status
                    }
                    output += `  ${errorLabel}:\n`
                    // Indent each line of the error
                    errorMsg.trim().split('\n').forEach((line: string) => {
                      output += `    ${line}\n`
                    })
                  }
                }

                if (testCase.is_hidden) {

                  output += `  (Hidden test case)\n`

                }

                output += "\n"

              })



              // Show summary

              if (summary) {

                output += "Summary:\n"

                output += "─".repeat(40) + "\n"

                output += `Passed: ${summary.passed_count}/${summary.total_cases} test cases\n`

                output += `Score: ${summary.earned_points}/${summary.total_points} points\n`



                const percentage = summary.total_points > 0 ?

                  (summary.earned_points / summary.total_points) * 100 : 0

                output += `Percentage: ${percentage.toFixed(1)}%\n\n`

              }

            } else {

              // No test cases, show single execution result

              output = "✅ Code executed successfully.\n"

              if (results && results[0]) {

                const firstResult = results[0]

                if (firstResult.stdout) {

                  output += `Output: ${firstResult.stdout}\n`

                }

                if (firstResult.time) {

                  output += `Time: ${firstResult.time}s\n`

                }

                if (firstResult.memory) {

                  output += `Memory: ${Math.round(firstResult.memory / 1024)} KB\n`

                }

              }

            }

          } else if (codeData.status === "Accepted") {

            if (codeData.stdout) {
              output = codeData.stdout
            } else if (codeData.output) {
              output = codeData.output
            } else {
              output = "✅ Code executed successfully."
            }

            if (codeData.time) {
              output += `\nTime: ${codeData.time}s`
            }
            if (codeData.memory) {
              output += `\nMemory: ${Math.round(codeData.memory / 1024)} KB`
            }
            setRunResults((prev) => ({
              ...prev,
              [questionId]: {
                kind: "single",
                status: "Accepted",
                stdout: codeData.stdout || codeData.output || undefined,
                time: typeof codeData.time === "number" ? codeData.time : undefined,
                memory: typeof codeData.memory === "number" ? codeData.memory : undefined,
              },
            }))
          } else if (codeData.status === "Compilation Error") {
            output = "Compilation Error:\n"
            if (codeData.compile_output) {
              output += codeData.compile_output
            } else if (codeData.stderr) {
              output += codeData.stderr
            } else {
              output += "Unknown compilation error"
            }
            setRunResults((prev) => ({
              ...prev,
              [questionId]: {
                kind: "single",
                status: "Compilation Error",
                stderr: codeData.compile_output || codeData.stderr || undefined,
              },
            }))
          } else if (codeData.status === "Runtime Error") {
            output = "⚠️ Runtime Error:\n"
            if (codeData.stderr) {
              output += codeData.stderr
            } else if (codeData.compile_output) {
              output += codeData.compile_output
            } else {
              output += "Unknown runtime error"
            }
            setRunResults((prev) => ({
              ...prev,
              [questionId]: {
                kind: "single",
                status: "Runtime Error",
                stderr: codeData.stderr || codeData.compile_output || undefined,
              },
            }))
          } else if (codeData.error) {
            output = `Error: ${codeData.error}`
            setRunResults((prev) => ({
              ...prev,
              [questionId]: { kind: "single", status: "Error", error: String(codeData.error) },
            }))
          } else if (codeData.stdout) {
            output = codeData.stdout
            setRunResults((prev) => ({ ...prev, [questionId]: { kind: "raw", text: codeData.stdout } }))
          } else {
            output = JSON.stringify(codeData, null, 2)
            setRunResults((prev) => ({ ...prev, [questionId]: { kind: "raw", text: output } }))
          }
        } else {
          output = "No response from server"
        }
      }

      setCodeOutputs((prev) => ({ ...prev, [questionId]: output }))
    } catch (error: any) {
      console.error("Run code error:", error)
      const errorMessage =
        error.data?.error ||
        error.data?.detail ||
        error.data?.message ||
        error.message ||
        "Failed to run code"
      setCodeOutputs((prev) => ({
        ...prev,
        [questionId]: `Error: ${errorMessage}`,
      }))
      setRunResults((prev) => ({
        ...prev,
        [questionId]: { kind: "single", status: "Error", error: errorMessage },
      }))
    } finally {
      setIsRunningCode(false)
    }
  }

  const formatSQLResultSimple = (sqlResult: any): string => {
    if (!sqlResult.rows || !Array.isArray(sqlResult.rows)) {
      return JSON.stringify(sqlResult, null, 2)
    }

    const rows = sqlResult.rows

    if (rows.length === 0) {
      return "Query executed successfully.\nNo rows returned."
    }

    let output = ""

    if (Array.isArray(rows[0])) {
      // Simple tab-separated output
      rows.forEach((row, index) => {
        output += `Row ${index + 1}: ${row.join(" | ")}\n`
      })

      output += `\nTotal: ${rows.length} row(s)`
      if (sqlResult.truncated) {
        output += " (truncated)"
      }
    } else {
      // JSON format for objects
      output = JSON.stringify(sqlResult, null, 2)
    }

    return output
  }

  // Grade SQL question
  const handleGradeSQL = async (questionId: string) => {
    const codingQuestion = findCodingQuestion(questionId)
    if (!codingQuestion || codingQuestion.type !== "sql") return

    const language = getCurrentLanguage(questionId)
    const code = answers[questionId] ?? codingQuestion.initialCode[language] ?? ""

    setIsRunningCode(true)
    try {
      const gradeData = await gradeSqlMutation({
        question_id: Number.parseInt(questionId),
        assessment_id: assessmentData?.candidate_assessment.assessment_id,
        query: code,
      }).unwrap()
      let output = ""

      if (gradeData) {
        const { total_points, earned_points, results } = gradeData

        // Calculate percentage
        const percentage = total_points > 0 ? (earned_points / total_points) * 100 : 0

        // Build output string properly
        output += "Grading Results:\n"
        output += "═".repeat(40) + "\n"
        output += `Total Points: ${total_points}\n`
        output += `Earned Points: ${earned_points}\n`
        output += `Score: ${percentage.toFixed(1)}%\n\n`

        if (results && results.length > 0) {
          output += "Test Cases:\n"
          output += "─".repeat(40) + "\n"

          results.forEach((testCase: any, index: number) => {
            output += `Test Case ${index + 1}:\n`
            output += `  Status: ${testCase.passed ? "PASSED" : "FAILED"}\n`
            output += `  Points: ${testCase.received}/${testCase.points}\n`

            // Show error if test failed and has error message
            if (!testCase.passed && testCase.error) {
              output += `  Error: ${testCase.error}\n`
            }

            // Show if test is hidden
            if (testCase.hidden) {
              output += `  (Hidden test case)\n`
            }
            output += "\n"
          })
        } else {
          output += "No test cases available.\n"
        }

        // Show overall status with emoji
        if (percentage === 100) {
          output += "Excellent! All tests passed!\n"
        } else if (percentage >= 70) {
          output += "Good work! Most tests passed.\n"
        } else if (percentage > 0) {
          output += "Some tests passed. Review and try again.\n"
        } else {
          output += "No tests passed. Please check your query.\n"
        }
      } else if (gradeData.error) {
        output = `Error: ${gradeData.error}`
      } else {
        output = "No grading data returned from server"
      }

      setCodeOutputs((prev) => ({ ...prev, [questionId]: output }))
    } catch (error: any) {
      console.error("Grade SQL error:", error)
      const errorMessage =
        error.data?.error || error.data?.detail || error.message || "Failed to grade SQL"
      setCodeOutputs((prev) => ({
        ...prev,
        [questionId]: `Grading Error:\n${errorMessage}`,
      }))
    } finally {
      setIsRunningCode(false)
    }
  }

  // Closes over the memoized transformedAssessment (declared later in
  // render) so language-switch / run handlers don't re-traverse the full
  // question list each call.
  const findCodingQuestion = (questionId: string) => {
    return transformedAssessment?.codingQuestions.find((q) => q.id === questionId) ?? null
  }

  // Proctoring and warning functions
  const showProctoringWarningMessage = useCallback((message: string) => {
    setProctoringWarning(message)
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }
    warningTimeoutRef.current = setTimeout(() => setProctoringWarning(null), 4000)
  }, [])

  useEffect(() => {
    return () => {
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!cameraStream) return;
    if (cameraStream) {
      setIsProctoringActive(true)
    } else {
      setIsProctoringActive(false)
    }
    return () => {
      cameraStream.getTracks().forEach(track => track.stop());
      setIsProctoringActive(false);
    };

  }, [cameraStream]);

  const requestFullscreen = useCallback(async () => {
    const docAny = document as any
    const elem = docAny.documentElement || document.documentElement
    const isFullscreenActive =
      docAny.fullscreenElement ||
      docAny.webkitFullscreenElement ||
      docAny.mozFullScreenElement ||
      docAny.msFullscreenElement

    if (isFullscreenActive || !elem) {
      return
    }

    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen()
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen()
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen()
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen()
      }
      setAssessmentStarted(true)
    } catch (error) {
      console.error("Unable to enforce fullscreen:", error)
    }
  }, [])

  const exitFullscreenSafely = useCallback(async () => {
    const doc = document as any
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      } else if (doc.mozFullScreenElement && doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen()
      } else if (doc.msFullscreenElement && doc.msExitFullscreen) {
        await doc.msExitFullscreen()
      }
    } catch (error) {
      console.error("Unable to exit fullscreen:", error)
    }
  }, [])

  useEffect(() => {
    if (!assessmentStarted) return
    document.body.classList.add("assessment-started")
    return () => {
      document.body.classList.remove("assessment-started")
    }
  }, [assessmentStarted])

  useEffect(() => {
    ; (window as any).__ASSESSMENT_ACTIVE__ = assessmentStarted
  }, [assessmentStarted])

  const navigateToResult = useCallback(() => {
    if (id) {
      // navigate(`/candidate/my-assessments/${id}/result`)
      navigate(`/candidate/my-assessments/${assessmentData?.candidate_assessment.assessment_id}/result`)
    } else {
      navigate("/candidate/my-assessments")
    }
  }, [id, navigate])

  const handleSubmitAssessment = useCallback(async () => {
    if (isSubmissionInProgress.current || !assessmentData) return

    // ✅ Save assessment_id BEFORE anything else
    //  const assessmentId = assessmentData.candidate_assessment.id;

    isSubmissionInProgress.current = true
    setIsSubmitting(true)

    try {
      // Clean up localStorage
      if (id) {
        localStorage.removeItem(`assessment_timer_${id}`);
        localStorage.removeItem(`assessment_answers_${id}`);
      }

      // Save all answers before submitting
      const promises = Object.entries(answers).map(([questionId, answer]) => {
        const codingQuestion = findCodingQuestion(questionId)
        return saveAnswer(questionId, answer, codingQuestion ? getCurrentLanguage(questionId) : undefined)
      })

      await Promise.all(promises)

      // Submit assessment
      await submitAssessmentMutation({
        id: Number(id),
        data: { candidate_assessment_id: assessmentData.candidate_assessment.id },
      }).unwrap()


      // Close the submit modal, show exiting overlay, and ensure fullscreen is exited
      setShowSubmitModal(false)
      setIsExitingFullscreen(true)
      try {
        await exitFullscreenSafely()
      } catch (err) {
        console.error('Failed to exit fullscreen after submission:', err)
      } finally {
        setIsExitingFullscreen(false)
      }

      setAssessmentStarted(false)
      setHasSubmitted(true)
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop())
        setCameraStream(null)
      }
      // navigateToResult()
      // navigate(`/candidate/my-assessments/${id}/result`)
      setShowFeedbackPopup(true)

    } catch (error) {
      console.error("Submission error:", error)
      showProctoringWarningMessage("Submission failed. Please try again.")
      isSubmissionInProgress.current = false
    } finally {
      setIsSubmitting(false)
      isSubmissionInProgress.current = false
    }
  }, [answers, cameraStream, exitFullscreenSafely, navigateToResult, assessmentData, id, showProctoringWarningMessage])


  const handleFeedbackSubmit = async (rating: number, feedbackText: string) => {
    setIsSubmittingFeedback(true);
    try {
      const candidateAssessmentId =

        assessmentData?.candidate_assessment?.id;
      console.log("candidateAssessmentId:", candidateAssessmentId);

      const result = await submitCandidateFeedback({
        id: Number(candidateAssessmentId),
        data: {
          rating: rating,
          comments: feedbackText.trim()
        }
      }).unwrap();

      console.log("API Response:", result);

      setShowFeedbackPopup(false);

      const navigatePath = `/candidate/my-assessments/${candidateAssessmentId}/result`;
      console.log("Navigating to:", navigatePath);
      navigate(navigatePath);

    } catch (error: any) {
      console.error("Feedback submission error:", error);
      setProctoringWarning(error?.data?.message || "Failed to submit feedback");
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const enforceFullscreen = useCallback(() => {
    if (!assessmentStarted || isSubmissionInProgress.current) return
    setShowFullScreenExitModal(true)
    requestFullscreen()
  }, [assessmentStarted, requestFullscreen])

  useEffect(() => {
    if (!assessmentStarted) return
    const handleWindowBlur = () => {
      setTabSwitchCount((prev) => prev + 1)
      showProctoringWarningMessage("App switch detected! Stay in fullscreen mode.")
      enforceFullscreen()
    }
    window.addEventListener("blur", handleWindowBlur)
    return () => window.removeEventListener("blur", handleWindowBlur)
  }, [assessmentStarted, enforceFullscreen, showProctoringWarningMessage])

  const handlePermissionCheck = useCallback(async () => {
    if (!policyConsent) {
      setPermissionStatus("Please agree to the policy to continue.")
      return
    }

    setIsCheckingPermissions(true)
    setPermissionStatus("Requesting camera access...")

    let newStream: MediaStream | null = null
    try {
      try {
        // First try with facingMode constraint (preferred on mobiles)
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: true,
        })
      } catch (err) {
        // Fallback: some desktops or browsers may not honor facingMode; try a simpler request
        console.warn('[v0] facingMode camera request failed, trying default video:', err)
        newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      setCameraStream(newStream)

      setPermissionStatus("Switching to fullscreen...")
      await requestFullscreen()

      // Fetch assessment data after permissions are granted. If the BE
      // refuses (subscription, expired, etc), fetchAssessmentData has
      // already populated `blockingError` and rendered the friendly
      // screen — we just need to release the camera and bail without
      // overwriting that message with a permissions toast.
      const data = await fetchAssessmentData()
      if (!data) {
        if (newStream) {
          newStream.getTracks().forEach((t) => t.stop())
          setCameraStream(null)
        }
        try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
        setPermissionStatus("")
        return
      }

      setAssessmentStarted(true)
      setShowStartGate(false)
      setPermissionStatus("")
      document.body.classList.add("assessment-started")
        ; (window as any).__ASSESSMENT_ACTIVE__ = true
      document.dispatchEvent(new Event("assessmentStarted"))
      showProctoringWarningMessage("Assessment started. Stay in fullscreen mode.")
    } catch (error) {
      console.error("Permission check failed:", error)
      setPermissionStatus("Full screen and camera permissions are required. Please allow access.")
      if (newStream) {
        newStream.getTracks().forEach((track) => track.stop())
      }
      setCameraStream(null);
    } finally {
      setIsCheckingPermissions(false)
    }
  }, [policyConsent, requestFullscreen, showProctoringWarningMessage, fetchAssessmentData])

  // Event listeners for warnings
  useEffect(() => {
    if (!assessmentStarted) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!assessmentStarted) return
      e.preventDefault()
      e.returnValue = ""
      enforceFullscreen()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isEscape = e.key === "Escape"
      const isF11 = e.key === "F11"
      const isAltTab = e.altKey && e.key === "Tab"
      const isMetaKey = e.metaKey || e.key === "Meta"
      const isClipboardShortcut = (e.ctrlKey || e.metaKey) && ["c", "v", "x", "a"].includes(e.key.toLowerCase())

      if (isClipboardShortcut) {
        e.preventDefault()
        setShowCopyPasteWarning(true)
        showProctoringWarningMessage("Clipboard shortcuts are blocked during the assessment.")
        return
      }

      if (!(isEscape || isF11 || isAltTab || isMetaKey)) {
        return
      }

      e.preventDefault()
      showProctoringWarningMessage("Fullscreen exit or shortcut blocked. Assessment must stay in fullscreen.")
      enforceFullscreen()
    }

    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      setShowCopyPasteWarning(true)
      showProctoringWarningMessage("Copy/Paste is disabled during the assessment.")
    }

    const handleContextMenu = (e: MouseEvent) => {
      if (!assessmentStarted) return
      const target = e.target as HTMLElement | null
      if (target?.closest(".code-editor")) return
       e.preventDefault()
      showProctoringWarningMessage("Right click is disabled during the assessment.")
    }

    const handleVisibilityChange = () => {
      if (document.hidden && assessmentStarted) {
        const newCount = tabSwitchCount + 1;
        setTabSwitchCount(newCount);
        showProctoringWarningMessage(`Tab switch detected! ${newCount} of ${MAX_TAB_SWITCHES} violations.`);

        // Auto-submit if exceeding limit
        if (newCount >= MAX_TAB_SWITCHES) {
          showProctoringWarningMessage("Maximum tab switches exceeded! Auto-submitting assessment...");
          handleSubmitAssessment();
        } else {
          enforceFullscreen();
        }
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("copy", handleCopyPaste)
    document.addEventListener("cut", handleCopyPaste)
    document.addEventListener("paste", handleCopyPaste)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("contextmenu", handleContextMenu)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("copy", handleCopyPaste)
      document.removeEventListener("cut", handleCopyPaste)
      document.removeEventListener("paste", handleCopyPaste)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("contextmenu", handleContextMenu)
    }
  }, [assessmentStarted, enforceFullscreen, showProctoringWarningMessage])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const docAny = document as any
      const isFullscreen =
        docAny.fullscreenElement ||
        docAny.webkitFullscreenElement ||
        docAny.mozFullScreenElement ||
        docAny.msFullscreenElement

      if (!isFullscreen) {
        if (assessmentStarted && !isSubmissionInProgress.current) {
          const newCount = fullscreenExitCount + 1;
          setFullscreenExitCount(newCount);
          showProctoringWarningMessage(`Fullscreen exited! ${newCount} of ${MAX_FULLSCREEN_EXITS} violations.`);

          // Auto-submit if exceeding limit
          if (newCount >= MAX_FULLSCREEN_EXITS) {
            showProctoringWarningMessage("Maximum fullscreen exits exceeded! Auto-submitting assessment...");
            handleSubmitAssessment();
          } else {
            enforceFullscreen();
          }
        }
      } else if (showFullScreenExitModal) {
        setShowFullScreenExitModal(false)
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange)
    document.addEventListener("mozfullscreenchange", handleFullscreenChange)
    document.addEventListener("MSFullscreenChange", handleFullscreenChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange)
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange)
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange)
    }
  }, [assessmentStarted, enforceFullscreen, showFullScreenExitModal])

  // Panel resize handlers
  const handlePanelResizeStart = (e: React.MouseEvent, tabType: 'coding' | 'mcq') => {
    e.preventDefault()

    panelResizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startLeft: panelSizes[tabType].left,
      startRight: panelSizes[tabType].right,
      tabType
    }

    document.addEventListener('mousemove', handlePanelResizeMove)
    document.addEventListener('mouseup', handlePanelResizeEnd)
  }

  const handlePanelResizeMove = (e: MouseEvent) => {
    if (!panelResizeRef.current.isResizing) return

    const { startX, startLeft, startRight, tabType } = panelResizeRef.current
    const deltaX = e.clientX - startX
    const containerWidth = document.querySelector('.grid.grid-cols-2')?.clientWidth || 1000

    // Calculate new percentages
    const deltaPercentage = (deltaX / containerWidth) * 100
    let newLeft = startLeft + deltaPercentage
    let newRight = startRight - deltaPercentage

    // Apply constraints (minimum 20% for each panel)
    newLeft = Math.max(20, Math.min(80, newLeft))
    newRight = Math.max(20, Math.min(80, 100 - newLeft))

    // Ensure they add up to 100%
    newLeft = 100 - newRight

    setPanelSizes(prev => ({
      ...prev,
      [tabType]: {
        left: Math.round(newLeft),
        right: Math.round(newRight)
      }
    }))
  }

  const handlePanelResizeEnd = () => {
    panelResizeRef.current.isResizing = false
    document.removeEventListener('mousemove', handlePanelResizeMove)
    document.removeEventListener('mouseup', handlePanelResizeEnd)
  }

  // Cleanup resize event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handlePanelResizeMove)
      document.removeEventListener('mouseup', handlePanelResizeEnd)
    }
  }, [])

  // Esc exits editor fullscreen for keyboard parity.
  useEffect(() => {
    if (!isEditorFullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setIsEditorFullscreen(false) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isEditorFullscreen])

  // formatTime + the 10-minute warning state now live inside <ExamTimer/>.

  // PERF: derive once per assessmentData change. Previously
  // transformApiData ran on EVERY render (4–5 times per re-render via
  // multiple inline call sites), traversing the full question list each
  // time — visible jank on slower laptops.
  const transformedAssessment = useMemo(
    () => (assessmentData ? transformApiData(assessmentData) : null),
    [assessmentData],
  )
  const currentQuestions = useMemo<Question[]>(
    () =>
      transformedAssessment
        ? [
            ...transformedAssessment.mcqQuestions,
            ...transformedAssessment.subjectiveQuestions,
            ...transformedAssessment.codingQuestions,
          ]
        : [],
    [transformedAssessment],
  )
  // "Answered" detection — must distinguish MCQ/subjective (any
  // non-empty text counts) from coding/sql (default template should
  // NOT count). For coding the Monaco editor fires onChange the moment
  // initialCode lands in its value prop, so answers[id] becomes the
  // starter template even though the candidate hasn't touched anything.
  // Use the structured runResults to require at least one test pass —
  // matches user intent: "only mark green once test cases pass".
  const isQuestionAnswered = useCallback(
    (q: { id: string; type: string }) => {
      const ans = answers[q.id]
      if (!ans || !ans.trim()) return false
      if (q.type === "coding" || q.type === "sql") {
        const r = runResults[q.id]
        if (r && r.kind === "tests") {
          return r.summary.passedCount > 0 &&
                 r.summary.passedCount === r.summary.totalCases
        }
        return false
      }
      return true
    },
    [answers, runResults],
  )

  // PERF: answeredCount memoized here — must stay above the loading /
  // already-submitted / exiting-fullscreen early returns below to satisfy
  // the Rules of Hooks (otherwise React sees a different hook count when
  // those overlays render).
  const answeredCount = useMemo(
    () => currentQuestions.reduce((acc, q) => acc + (isQuestionAnswered(q) ? 1 : 0), 0),
    [currentQuestions, isQuestionAnswered],
  )
  const currentQuestionData = currentQuestions[currentQuestion - 1]
  const currentCodingQuestion =
    currentQuestionData?.type === "coding" || currentQuestionData?.type === "sql" ? currentQuestionData : undefined

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))

    // Auto-save with debounce
    const codingQuestion = findCodingQuestion(questionId)
    debouncedSave(questionId, value, codingQuestion ? getCurrentLanguage(questionId) : undefined)
  }

  const handleLanguageChange = (questionId: string, language: string) => {
  const currentLanguage = getCurrentLanguage(questionId)

  // Don't do anything if switching to the same language
  if (currentLanguage === language) return

  // Save current code for current language before switching
  const currentAnswer = answers[questionId] || ""
  const codingQuestion = findCodingQuestion(questionId)
  if (!codingQuestion) return

  // Save current language's code in a separate store
  setAnswers((prev) => ({
    ...prev,
    [`${questionId}_${currentLanguage}`]: currentAnswer, // purana code save karo
    [questionId]: prev[`${questionId}_${language}`] || 
                  codingQuestion.initialCode[language] || "" // naya ya saved code load karo
  }))

  setSelectedLanguages((prev) => ({ ...prev, [questionId]: language }))
  
  const newCode = answers[`${questionId}_${language}`] || 
                  codingQuestion.initialCode[language] || ""
  debouncedSave(questionId, newCode, language)
}

  const handleContinueInFullScreen = useCallback(async () => {
    await requestFullscreen()
    setShowFullScreenExitModal(false)
  }, [requestFullscreen])

  const getCurrentLanguage = (questionId: string) => {
    if (selectedLanguages[questionId]) {
      return selectedLanguages[questionId]
    }

    const codingQuestion = findCodingQuestion(questionId)
    if (codingQuestion?.type === "sql") {
      return "sql"
    }
    return codingQuestion?.languages[0] || "python"
  }

  const handleNext = () => {
    if (currentQuestion < currentQuestions.length) {
      setCurrentQuestion(currentQuestion + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(currentQuestion - 1)
    }
  }


  const totalQuestions = assessmentData ? assessmentData.questions.length : 0

  // Modal Component
  const WarningModal = ({
    isOpen,
    onClose,
    title,
    message,
    onConfirm,
    confirmText = "Continue",
    cancelText = "Cancel",
  }: {
    isOpen: boolean
    onClose: () => void
    title: string
    message: string
    onConfirm: () => void
    confirmText?: string
    cancelText?: string
  }) => {
    if (!isOpen) return null

    return (
      // z-[70] keeps the modal above both the footer (z-[60]) and the
      // camera tile (z-40). Previously z-50 left the footer poking
      // through the backdrop while the submit-confirm dialog was open.
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
        <div className={`rounded-lg p-6 max-w-md w-full mx-4 bg-white`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-bold text-slate-900`}>{title}</h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
          <p className={`mb-6 text-slate-700`}>{message}</p>
          <div className="flex justify-end gap-3">
            {cancelText && (
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                {cancelText}
              </Button>
            )}
            <Button onClick={onConfirm} className="bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                confirmText
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }


  // If server replied that assessment is already submitted, show a friendly message
  // After a successful in-session submit — replace the entire assessment
  // UI with a calm "submitted" screen so the candidate can't keep
  // clicking Prev / Next / Submit on the now-orphaned footer. The
  // optional FeedbackPopup still renders on top from the main return
  // tree via the `hasSubmitted ? null` short-circuit isn't an option
  // here (this branch returns first), so the popup is re-rendered
  // inside this screen too.
  if (hasSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 px-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_44px_-18px_rgba(15,23,42,0.18)]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
          <div className="px-6 py-7 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_8px_22px_-6px_rgba(16,185,129,0.55)] ring-1 ring-white/20">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">Assessment Submitted</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Your answers have been recorded. The report will be ready shortly.
            </p>
            <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
              <Button
                onClick={() => {
                  if (id) navigate(`/candidate/my-assessments/${id}/result`);
                  else navigate('/candidate/my-assessments');
                }}
                className="h-9 bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-xs font-semibold text-white shadow-[0_4px_14px_-3px_rgba(124,58,237,0.55)] hover:shadow-[0_8px_20px_-4px_rgba(124,58,237,0.65)]"
              >
                View Results
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/candidate/my-assessments')}
                className="h-9 text-xs font-semibold border-slate-200"
              >
                Back to my assessments
              </Button>
            </div>
          </div>
        </div>

        {/* Feedback popup still available from this screen */}
        <FeedbackPopup
          isOpen={showFeedbackPopup}
          onClose={() => setShowFeedbackPopup(false)}
          onSubmit={handleFeedbackSubmit}
          isSubmitting={isSubmittingFeedback}
        />
      </div>
    )
  }

  if (alreadySubmittedMessage) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100`}>
        <div className="max-w-lg w-full bg-white border rounded-lg shadow-sm p-6 text-center">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Assessment Already Submitted</h3>
          <p className="text-sm text-slate-600 mb-4">{alreadySubmittedMessage}</p>
          <div className="flex justify-center gap-3">
            <Button
              onClick={() => {
                if (id) navigate(`/candidate/my-assessments/${id}/result`);
                else navigate('/candidate/my-assessments');
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              View Results
            </Button>
            <Button variant="outline" onClick={() => navigate('/candidate/my-assessments')}>Back to Assessments</Button>
          </div>
        </div>
      </div>
    )
  }

  // BE blocker (subscription expired, assessment not yet active, etc).
  // Used to render a misleading "permissions required" toast; now shows
  // a real screen with kind-appropriate CTAs.
  if (blockingError) {
    const isSubscription = blockingError.kind === "subscription"
    const isExpired = blockingError.kind === "expired"
    const heading = isSubscription
      ? "Subscription required"
      : isExpired ? "Assessment unavailable"
      : "Couldn't start this assessment"
    const ringTone = isSubscription
      ? "from-brand-purple to-brand-violet"
      : isExpired ? "from-amber-400 to-amber-500"
      : "from-slate-400 to-slate-500"
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 px-4">
        <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_18px_44px_-18px_rgba(15,23,42,0.18)]">
          <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
          <div className="px-6 py-7 text-center">
            <span className={`mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${ringTone} text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.45)] ring-1 ring-white/20`}>
              {isSubscription ? <Star className="h-6 w-6 fill-white" /> : <AlertTriangle className="h-6 w-6" />}
            </span>
            <h3 className="text-lg font-bold tracking-tight text-slate-900">{heading}</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{blockingError.message}</p>
            <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2">
              {isSubscription && (
                <Button
                  onClick={() => navigate("/candidate/subscription")}
                  className="h-9 bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-xs font-semibold text-white shadow-[0_4px_14px_-3px_rgba(124,58,237,0.55)] hover:shadow-[0_8px_20px_-4px_rgba(124,58,237,0.65)]"
                >
                  View subscription plans
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate("/candidate/my-assessments")}
                className="h-9 text-xs font-semibold border-slate-200"
              >
                Back to my assessments
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className={`mt-4 text-slate-700`}>Loading assessment...</p>
        </div>
      </div>
    )
  }

  // Overlay shown while exiting fullscreen after successful submit
  if (isExitingFullscreen) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-6 text-center max-w-sm w-full mx-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-700" />
          <p className="mt-4 text-sm text-gray-700">Exiting fullscreen and redirecting to results...</p>
        </div>
      </div>
    )
  }
  const isPrevDisabled = currentQuestion <= 1;
  const isNextDisabled = currentQuestion >= currentQuestions.length;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/40 pb-16">
      {proctoringWarning && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-6 py-2 rounded-b-md shadow-lg z-[60] font-semibold text-sm">
          {proctoringWarning}
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/70 shadow-[0_1px_0_0_rgba(15,23,42,0.04),0_4px_18px_-8px_rgba(15,23,42,0.08)]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
        <div className="mx-auto px-5 py-2.5 flex items-center justify-between gap-4">
          {/* Brand + title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.55)] ring-1 ring-white/20">
              <img src="/SkilTechyFavicon.png" alt="" className="h-5 w-5" />
              <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-slate-900">
                {assessmentData?.candidate_assessment.assessment_title || "Assessment"}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-violet">
                <ShieldCheck className="h-3 w-3" /> Proctored Assessment
              </p>
            </div>
          </div>

          {/* Progress meter */}
          <div className="hidden md:flex items-center gap-2.5 min-w-[200px] max-w-[260px]">
            <div className="relative flex-1 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple"
                initial={false}
                animate={{ width: `${currentQuestions.length ? (answeredCount / currentQuestions.length) * 100 : 0}%` }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
              />
              {answeredCount > 0 && (
                <motion.div
                  key={answeredCount}
                  className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                  initial={{ x: "-100%" }}
                  animate={{ x: "300%" }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              )}
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-700 whitespace-nowrap">
              <motion.span key={answeredCount} initial={{ scale: 1.25, color: "#7c3aed" }} animate={{ scale: 1, color: "#334155" }} transition={{ duration: 0.4 }} className="inline-block">
                {answeredCount}
              </motion.span>
              /{currentQuestions.length} <span className="text-slate-400">done</span>
            </span>
          </div>

          {/* Timer chip — isolated child re-renders every second on its own */}
          <ExamTimer
            assessmentData={assessmentData}
            calcRemaining={calculateTimerFromServerTimes}
            active={assessmentStarted}
            onExpire={() => {
              if (!isSubmissionInProgress.current) {
                handleSubmitAssessment();
              }
            }}
          />

          {/* SUBMIT — plain <button> instead of shadcn Button because the
              latter's default `text-primary-foreground` was overriding
              our custom slate text colour and the label rendered blank.
              Quiet outline by default, escalates to solid emerald when
              every question is answered. WarningModal gates the actual
              submission so an accidental click is still recoverable. */}
          {(() => {
            const total = currentQuestions.length
            const allDone = total > 0 && answeredCount >= total
            const disabled = isSubmitting || !assessmentStarted
            return (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                disabled={disabled}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold tracking-tight transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                  allDone
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_14px_-2px_rgba(16,185,129,0.45)] hover:opacity-95"
                    : "border border-slate-200 bg-white text-slate-700 hover:border-brand-violet/40 hover:bg-violet-50/40 hover:text-brand-violet",
                )}
              >
                {allDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                <span>{isSubmitting ? "Submitting…" : allDone ? "Submit" : "Finish"}</span>
              </button>
            )
          })()}
        </div>
      </header>

      {/* QUESTION RAIL — sequential, type-aware, magnetic active pill */}
      <div className="sticky top-[56px] z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="px-3 sm:px-5 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <LayoutGroup id="assessment-rail">
            {currentQuestions.map((q, idx) => {
              const isAnswered = isQuestionAnswered(q)
              const isActive = currentQuestion === idx + 1
              const typeIcon =
                q.type === "coding" ? <Code2 className="h-2.5 w-2.5" />
                : q.type === "sql" ? <Database className="h-2.5 w-2.5" />
                : q.type === "subjective" ? <FileText className="h-2.5 w-2.5" />
                : null
              const typeLabel = q.type === "coding" ? "Code"
                : q.type === "sql" ? "SQL"
                : q.type === "subjective" ? "Long Answer"
                : q.type === "mcq_multiple" ? "Multi-Select"
                : "MCQ"
              return (
                <motion.button
                  key={q.id}
                  onClick={() => setCurrentQuestion(idx + 1)}
                  title={`Q${idx + 1} • ${typeLabel}${isAnswered ? " • Answered" : ""}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.015, duration: 0.18 }}
                  whileHover={!isActive ? { y: -1 } : undefined}
                  whileTap={{ scale: 0.94 }}
                  className={cn(
                    "group relative inline-flex h-8 min-w-[38px] shrink-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold tabular-nums",
                    isActive
                      ? "border-transparent text-white"
                      : isAnswered
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="active-pill-bg"
                      className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-br from-brand-purple to-brand-violet shadow-[0_6px_16px_-3px_rgba(124,58,237,0.5)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span>{idx + 1}</span>
                  {typeIcon && <span className="opacity-70">{typeIcon}</span>}
                  {isAnswered && !isActive && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  )}
                </motion.button>
              )
            })}
          </LayoutGroup>
        </div>
      </div>

      {/* MAIN CONTENT — single conditional renderer.
          PERF: dropped AnimatePresence-on-key wrap. With Monaco inside
          the coding branch, each question change was forcing a full
          editor remount (~80-150ms on slower laptops), which is what
          made navigation feel "bulky". The active-pill magnetic move
          on the rail still gives a clear visual cue. */}
      <main className="px-2 sm:px-3 pt-2">
        {currentCodingQuestion ? (
              <div className="relative w-full">
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full h-[calc(100vh-160px)]"
                  style={{
                    gridTemplateColumns: `${panelSizes.coding.left}% ${panelSizes.coding.right}%`,
                  }}
                >
                  {/* Question Panel */}
                  <Card className="relative rounded-r-none flex flex-col h-full overflow-hidden border-slate-200/70 shadow-sm">
                    <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
                    <CardHeader className="pb-3 pt-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-violet ring-1 ring-inset ring-brand-violet/20">
                            {currentCodingQuestion.type === "sql" ? <Database className="h-3 w-3" /> : <Code2 className="h-3 w-3" />}
                            {currentCodingQuestion.type === "sql" ? "SQL Query" : "Coding"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200/70">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            {currentCodingQuestion.marks} {currentCodingQuestion.marks === 1 ? "mark" : "marks"}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 tabular-nums">
                          Q {currentQuestion} / {currentQuestions.length}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto space-y-4 pr-3 pb-3">
                      <h2 className="text-base font-bold leading-snug tracking-tight text-slate-900">
                        {currentCodingQuestion.title}
                      </h2>
                      <div
                        className="prose prose-sm max-w-none text-slate-700 prose-headings:tracking-tight prose-pre:bg-slate-900 prose-pre:text-emerald-300 prose-code:rounded prose-code:bg-violet-50 prose-code:px-1 prose-code:py-0.5 prose-code:text-brand-violet prose-code:before:content-none prose-code:after:content-none"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentCodingQuestion.description) }}
                      />

                      {/* Sample I/O */}
                      {(currentCodingQuestion.sample_input || currentCodingQuestion.sample_output) && (
                        <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-3 space-y-3">
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            <Play className="h-3 w-3" />
                            Example
                          </div>
                          {currentCodingQuestion.sample_input && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Input</span>
                              <pre className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs font-mono text-emerald-300 overflow-x-auto shadow-inner">
{currentCodingQuestion.sample_input}
                              </pre>
                            </div>
                          )}
                          {currentCodingQuestion.sample_output && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Expected Output</span>
                              <pre className="rounded-lg border border-slate-700 bg-slate-900 p-2.5 text-xs font-mono text-sky-300 overflow-x-auto shadow-inner">
{currentCodingQuestion.sample_output}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Code Editor Panel — fullscreen wraps editor + output together.
                      In fullscreen we leave 60px clear at the bottom so the page
                      footer (Previous / Next / Submit) stays visible — without
                      this the candidate couldn't reach the nav buttons. */}
                  <Card className={cn(
                    "relative flex flex-col overflow-hidden border-slate-200/70 shadow-sm",
                    isEditorFullscreen
                      ? "fixed left-3 right-3 top-3 bottom-[60px] z-[55] rounded-xl bg-white"
                      : "rounded-l-none h-full",
                  )}>
                    {/* Draggable left border */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 bg-transparent hover:bg-brand-violet/15 transition-colors group"
                      onMouseDown={(e) => handlePanelResizeStart(e, 'coding')}
                      style={{ touchAction: "none" }}
                    >
                      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Move className="w-4 h-4 text-brand-violet" />
                      </div>
                    </div>
                    <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-violet via-brand-purple to-brand-violet" />


                    <div className="flex flex-col flex-1 min-h-0 p-2 gap-2">
                      {/* Editor zone — fills available height */}
                      <div className="flex-1 min-h-0">
                        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-400">Loading editor…</div>}>
                        <CodeEditor
                          value={
                            answers[currentCodingQuestion.id] ??
                            currentCodingQuestion.initialCode[getCurrentLanguage(currentCodingQuestion.id)] ??
                            ""
                          }
                          onChange={(value) => handleAnswerChange(currentCodingQuestion.id, value)}
                          language={getCurrentLanguage(currentCodingQuestion.id)}
                          onLanguageChange={(lang) => handleLanguageChange(currentCodingQuestion.id, lang)}
                          initialCode={currentCodingQuestion.initialCode[getCurrentLanguage(currentCodingQuestion.id)] ?? ""}
                          placeholder={
                            currentCodingQuestion.type === "sql"
                              ? "Write your SQL query here..."
                              : "Write your code here..."
                          }
                          onEditorFocus={() => setTerminalExpanded(false)}
                          onRun={() => handleRunCode(currentCodingQuestion.id)}
                          isRunning={isRunningCode}
                          onRunPlain={() => handleRunCodePlain(currentCodingQuestion.id)}
                          isRunnings={isRunningsCode}
                          editorTheme={editorTheme}
                          onEditorThemeChange={setEditorTheme}
                          isFullscreen={isEditorFullscreen}
                          onToggleFullscreen={() => setIsEditorFullscreen((v) => !v)}
                          height="100%"
                        />
                        </Suspense>
                      </div>

                      {/* Output panel — vertical sibling, theme-mirrored to editor.
                          Dark variant uses VS-Code-ish slate-900 (softer than pure
                          slate-950) with calmer text colours so the terminal
                          doesn't read as harsh neon-on-black. */}
                      {(() => {
                        const outDark = editorTheme === "vs-dark"
                        return (
                      <motion.div
                        layout
                        animate={{ height: terminalExpanded ? 280 : 42 }}
                        transition={{ type: "spring", stiffness: 260, damping: 30 }}
                        className={cn(
                          "relative shrink-0 flex flex-col overflow-hidden rounded-xl border",
                          outDark
                            ? "bg-[#1e1e1e] border-slate-800 shadow-[0_-4px_18px_-8px_rgba(0,0,0,0.4)]"
                            : "bg-white border-slate-200 shadow-[0_-4px_18px_-10px_rgba(15,23,42,0.12)]",
                        )}
                      >
                        {/* Output header */}
                        <button
                          type="button"
                          onClick={() => setTerminalExpanded(!terminalExpanded)}
                          className={cn(
                            "group flex items-center justify-between px-3.5 py-2 border-b transition-colors text-left shrink-0",
                            outDark
                              ? "bg-[#252526] border-slate-800 hover:bg-[#2a2a2c]"
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100/70",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "flex h-5 w-5 items-center justify-center rounded",
                              outDark ? "bg-slate-700/70 text-slate-200" : "bg-violet-100 text-brand-violet",
                            )}>
                              <Terminal className="h-3 w-3" />
                            </span>
                            <span className={cn("text-[11px] font-bold uppercase tracking-[0.08em]", outDark ? "text-slate-200" : "text-slate-700")}>
                              Output
                            </span>
                            {codeOutputs[currentCodingQuestion.id] && (
                              <span className={cn(
                                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset",
                                outDark ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25" : "bg-emerald-50 text-emerald-700 ring-emerald-200",
                              )}>
                                <span className={cn("h-1 w-1 rounded-full", outDark ? "bg-emerald-400" : "bg-emerald-500")} />
                                ready
                              </span>
                            )}
                          </div>
                          <span className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded transition-colors",
                            outDark ? "text-slate-400 hover:bg-slate-700/60 hover:text-slate-100" : "text-slate-500 hover:bg-slate-200/60",
                          )}>
                            {terminalExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                          </span>
                        </button>

                        <AnimatePresence>
                          {terminalExpanded && (
                            <motion.div
                              key="output-body"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className={cn(
                                // min-h-0 lets flex children shrink so overflow-y-auto
                                // can actually scroll (default min-height: auto blocks it).
                                "flex-1 min-h-0 overflow-y-auto px-3 py-3",
                                outDark ? "bg-[#1e1e1e]" : "bg-slate-50/50",
                              )}
                            >
                              {(() => {
                                const r = runResults[currentCodingQuestion.id]
                                // Fall back to the legacy raw-text blob if a result
                                // hasn't been parsed yet (e.g. SQL output, restored
                                // from localStorage).
                                if (!r && codeOutputs[currentCodingQuestion.id]) {
                                  return (
                                    <CodeRunResultPanel
                                      result={{ kind: "raw", text: codeOutputs[currentCodingQuestion.id] }}
                                      dark={outDark}
                                    />
                                  )
                                }
                                return <CodeRunResultPanel result={r ?? null} dark={outDark} />
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                        )
                      })()}
                    </div>
                  </Card>
                </div>
              </div>
        ) : currentQuestionData ? (
          <div className="flex justify-center items-start min-h-[calc(100vh-160px)] py-3 px-3 sm:px-6">
            <Card className="relative w-full max-w-3xl overflow-hidden border-slate-200/70 shadow-[0_12px_36px_-16px_rgba(15,23,42,0.18)]">
              <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple" />
              <CardHeader className="pb-4 pt-5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-violet ring-1 ring-inset ring-brand-violet/20">
                      {currentQuestionData.type === "subjective" ? <FileText className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-brand-violet" />}
                      {currentQuestionData.type === "mcq_single" ? "Single Choice" : currentQuestionData.type === "mcq_multiple" ? "Multiple Choice" : "Long Answer"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200/70">
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      {currentQuestionData.marks} {currentQuestionData.marks === 1 ? "mark" : "marks"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {answers[currentQuestionData.id] && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Saved
                      </span>
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 tabular-nums">
                      Q {currentQuestion} / {currentQuestions.length}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pb-6">
                {/* Question content */}
                <div>
                  <h2 className="text-lg font-bold leading-snug tracking-tight text-slate-900">
                    {currentQuestionData.title}
                  </h2>
                  {currentQuestionData.description && (
                    <div
                      className="mt-2 prose prose-sm max-w-none text-slate-700 prose-headings:tracking-tight prose-pre:bg-slate-900 prose-pre:text-emerald-300 prose-code:rounded prose-code:bg-violet-50 prose-code:px-1 prose-code:py-0.5 prose-code:text-brand-violet prose-code:before:content-none prose-code:after:content-none"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentQuestionData.description) }}
                    />
                  )}
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                {/* Answer area */}
                <div className="space-y-3">
                      {currentQuestionData.type === "mcq_single" && (
                        <div className="space-y-2.5">
                          {(currentQuestionData as MCQQuestion).options.map((option, idx) => {
                            const isSelected = answers[currentQuestionData.id] === option.id
                            return (
                              <motion.button
                                key={option.id}
                                type="button"
                                onClick={() => handleAnswerChange(currentQuestionData.id, option.id)}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.04, duration: 0.22 }}
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.99 }}
                                className={cn(
                                  "group relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                                  isSelected
                                    ? "border-brand-violet/40 bg-gradient-to-br from-violet-50/70 to-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.35)] ring-1 ring-inset ring-brand-violet/25"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm",
                                )}
                              >
                                <span className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all duration-200",
                                  isSelected
                                    ? "bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)]"
                                    : "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
                                )}>
                                  {option.id}
                                </span>
                                <span className={cn(
                                  "flex-1 text-sm leading-relaxed transition-colors",
                                  isSelected ? "font-semibold text-slate-900" : "text-slate-700",
                                )}>
                                  {option.text}
                                </span>
                                <AnimatePresence>
                                  {isSelected && (
                                    <motion.span
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 480, damping: 22 }}
                                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-violet text-white shadow-[0_2px_6px_-1px_rgba(124,58,237,0.55)]"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </motion.button>
                            )
                          })}
                        </div>
                      )}

                      {currentQuestionData.type === "mcq_multiple" && (
                        <div className="space-y-2.5">
                          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-violet">
                            <span className="h-1 w-1 rounded-full bg-brand-violet" />
                            Select all that apply
                          </p>
                          {(currentQuestionData as MCQQuestion).options.map((option, idx) => {
                            const selected = (answers[currentQuestionData.id] || "").split(",").filter(Boolean)
                            const isChecked = selected.includes(option.id)
                            return (
                              <motion.button
                                key={option.id}
                                type="button"
                                onClick={() => {
                                  const next = isChecked ? selected.filter((s) => s !== option.id) : [...selected, option.id]
                                  handleAnswerChange(currentQuestionData.id, next.join(","))
                                }}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.04, duration: 0.22 }}
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.99 }}
                                className={cn(
                                  "group relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                                  isChecked
                                    ? "border-brand-violet/40 bg-gradient-to-br from-violet-50/70 to-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.35)] ring-1 ring-inset ring-brand-violet/25"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm",
                                )}
                              >
                                <span className={cn(
                                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-all duration-200",
                                  isChecked
                                    ? "bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)]"
                                    : "bg-slate-100 text-slate-600 group-hover:bg-slate-200",
                                )}>
                                  {option.id}
                                </span>
                                <span className={cn(
                                  "flex-1 text-sm leading-relaxed transition-colors",
                                  isChecked ? "font-semibold text-slate-900" : "text-slate-700",
                                )}>
                                  {option.text}
                                </span>
                                <AnimatePresence>
                                  {isChecked && (
                                    <motion.span
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: "spring", stiffness: 480, damping: 22 }}
                                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-violet text-white shadow-[0_2px_6px_-1px_rgba(124,58,237,0.55)]"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={3} />
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                              </motion.button>
                            )
                          })}
                        </div>
                      )}

                      {currentQuestionData.type === "subjective" && (
                        <div className="relative">
                          <Textarea
                            value={answers[currentQuestionData.id] || ""}
                            onChange={(e) => handleAnswerChange(currentQuestionData.id, e.target.value)}
                            className="min-h-[280px] rounded-xl border-slate-200 bg-white text-sm leading-relaxed shadow-sm transition-all duration-200 focus-visible:border-brand-violet/40 focus-visible:ring-2 focus-visible:ring-brand-violet/15"
                            placeholder="Type your detailed answer here..."
                          />
                          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-1 w-1 rounded-full bg-emerald-500" />
                              Auto-saving as you type
                            </span>
                            <span className="tabular-nums font-medium">
                              {(answers[currentQuestionData.id] || "").length} chars
                            </span>
                          </div>
                        </div>
                      )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      {/* STATUS FOOTER — proctoring/fullscreen pills removed (noise to
          the candidate; that info still lives in the header timer chip
          and the question rail). Left side now shows an explicit
          progress + "Submit Assessment" intent so the primary CTA reads
          as the final action, not "submit this question". */}
      <footer className="fixed bottom-0 inset-x-0 z-[60] bg-white/90 backdrop-blur-md border-t border-slate-200/70 shadow-[0_-4px_20px_-4px_rgba(15,23,42,0.08)]">
        <div className="mx-auto px-3 sm:px-5 py-2 flex items-center justify-between gap-3">
          {/* LEFT — answered progress, explicit submission scope */}
          {(() => {
            const total = currentQuestions.length
            const remaining = Math.max(0, total - answeredCount)
            const allDone = total > 0 && answeredCount >= total
            const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0
            return (
              <div className="hidden sm:flex items-center gap-3 min-w-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    {allDone ? "Ready to submit" : "Assessment progress"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums text-slate-700">
                      {answeredCount}<span className="text-slate-400">/{total}</span>
                    </span>
                    <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-slate-200/80">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 220, damping: 30 }}
                        className={cn(
                          "absolute inset-y-0 left-0 rounded-full",
                          allDone
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple",
                        )}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {allDone
                        ? "all answered"
                        : remaining === 1
                          ? "1 question left"
                          : `${remaining} questions left`}
                    </span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* RIGHT — just Prev / Next. Submit lives in the top header
              now so candidates don't fat-finger it next to Next. */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={isPrevDisabled}
              className="h-9 px-3 text-xs font-semibold border-slate-200 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Previous
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={isNextDisabled}
              className="h-9 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      </footer>

      {assessmentStarted && cameraStream && (
        <FixedCameraTile
          cameraStream={cameraStream}
          isProctoringActive={isProctoringActive}
        />
      )}
      {/* Dark Overlay Modal is open */}
      {/* Extra backdrop — z-[65] sits between the footer (z-[60]) and
          the WarningModal (z-[70]) so the rest of the page dims but the
          modal itself stays clean. */}
      {showSubmitModal && <div className="fixed inset-0 bg-black bg-opacity-50 z-[65]" />}
      {showCopyPasteWarning && <div className="fixed inset-0 bg-black bg-opacity-50 z-[65]" />}

      <FullscreenExitModal
        open={showFullScreenExitModal}
        exitCount={fullscreenExitCount}
        onContinue={handleContinueInFullScreen}
        onAutoSubmit={handleSubmitAssessment}
      />

      <WarningModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Assessment"
        message="Are you sure you want to submit your assessment? Once submitted, you cannot make any changes."
        onConfirm={handleSubmitAssessment}
        confirmText="Yes, Submit"
        cancelText="Cancel"
      />

      <WarningModal
        isOpen={showCopyPasteWarning}
        onClose={() => setShowCopyPasteWarning(false)}
        title="Copy/Paste Detected"
        message="Copying and pasting is not allowed during the assessment. This incident has been recorded."
        onConfirm={() => setShowCopyPasteWarning(false)}
        confirmText="I Understand"
        cancelText="Cancel"
      />


      <FeedbackPopup
        isOpen={showFeedbackPopup}
        onClose={() => setShowFeedbackPopup(false)}
        onSubmit={handleFeedbackSubmit}
        isSubmitting={isSubmittingFeedback}
      />

      <StartGateModal
        open={showStartGate}
        eyebrow="Proctored Assessment"
        enableCamera
        enableVoiceRecording={false}
        policyConsent={policyConsent}
        isCheckingPermissions={isCheckingPermissions}
        permissionStatus={permissionStatus}
        onPolicyChange={setPolicyConsent}
        onCheckPermissions={handlePermissionCheck}
      />
    </div>
  )
}

export default AssessmentTestInterface
