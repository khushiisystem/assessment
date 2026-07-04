import { sanitizeHtml } from "@/lib/sanitize";
import React, { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  Video,
  VideoOff,
  Clock,
  Save,
  Volume2,
  Pause,
  StopCircle,
  ArrowRight,
  CheckCircle,
  Mic,
  MicOff,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Play,
  Code2,
  LogOut,
  Send,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useLazyTakeAiAssessmentQuery,
  useSaveProctoringIncidentMutation,
  useGetPresignedUrlMutation,
  useGetVideoPartUrlMutation,
  useCompleteMultipartUploadMutation,
  useUploadVideoMutation,
  useUploadVideoFormMutation,
  useUploadAudioMutation,
  useSaveAiAnswerMutation,
  useSubmitAiAssessmentMutation,
  useLazyCheckAiAssessmentStatusQuery,
  useRunCodeMutation,
  useLazyCheckQuestionsReadyQuery,
  usePrepareQuestionsAsyncMutation,
  useGetProfileQuery,
} from '@/store';
// CodingWorkspace (the split-pane IDE: problem | editor + console) is
// lazy-loaded so its Monaco-based bundle only ships when the candidate actually
// hits a coding question. Prefetched below as soon as the assessment loads with
// any coding questions.
const CodingWorkspace = lazy(() => import('./CodingWorkspace'));
import { QuestionProgress } from '@/components/interview-room/QuestionProgress';
import { StartGateModal } from '@/components/interview-room/StartGateModal';
import { FullscreenExitModal } from '@/components/interview-room/FullscreenExitModal';
import { WhisperFailureModal } from '@/components/interview-room/WhisperFailureModal';
import { SubmitConfirmModal } from '@/components/interview-room/SubmitConfirmModal';
import { CameraTile } from '@/components/interview-room/CameraTile';
import { VoiceWaveform } from '@/components/interview-room/VoiceWaveform';
import { useFullscreenWatcher } from '@/hooks/useFullscreenWatcher';
import { useQuestionTimer } from '@/hooks/useQuestionTimer';
import { useCamera } from '@/hooks/useCamera';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { cn } from '@/lib/utils';
import { getStarterCode } from './codeTemplates';

// Type for questions (supports both text and coding)
interface QuestionData {
  text: string;
  type: 'text' | 'coding';
  source: string;
  question_id?: number;
  sample_input?: string;
  sample_output?: string;
  marks?: number;
}

// Types
interface ProctoringAlert {
  type: string;
  timestamp: string;
  severity: string;
  message: string;
}

interface AssessmentData {
  id: number;
  title: string;
  description: string;
  role_type: string;
  experience_level: string;
  start_date: string;
  end_date: string;
  instructions: string;
  num_questions: number;
  enable_voice_recording: boolean;
  enable_camera: boolean;
  created_by_username: string;
  coding_time_limit?: number;
}

interface CandidateAssessment {
  id: number;
  candidate_username: string;
  assigned_by_username: string;
  start_time: string;
  end_time: string | null;
  status: string;
  generated_questions: string[];
  ai_feedback: string;
  cheating_alerts: ProctoringAlert[];
  multiple_faces_count: number;
  gaze_violation_count: number;
  no_face_detection_count: number;
  total_proctor_warnings: number;
}

// Face mesh types
interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}

interface FaceMeshResults {
  multiFaceLandmarks: FaceLandmark[][];
}

// Declare global MediaPipe types
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}

const AiAssessmentTestInterface: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  // Polling state: waiting for backend to finish async question generation
  const [questionsReady, setQuestionsReady] = useState<boolean>(false);
  const [pollingMessage, setPollingMessage] = useState<string>('Preparing your interview questions...');
  const [pollingElapsedSec, setPollingElapsedSec] = useState<number>(0);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);
  const pollingAttemptsRef = useRef<number>(0);
  // True once we've polled past the generous window without questions becoming
  // ready — drives a "taking longer than expected" screen with a manual retry
  // instead of silently stalling.
  const [prepTimedOut, setPrepTimedOut] = useState<boolean>(false);
  // Bump to restart the whole prepare/poll effect (the manual retry button).
  const [prepRetryNonce, setPrepRetryNonce] = useState<number>(0);
  // Fast first 8 polls (every 1 s) catch the common case where the BE already
  // has the questions cached or finishes generation in <10 s. After that we
  // back off to 3 s. The window is ~6 min because LLM question generation can
  // genuinely take several minutes — giving up at 2 min stranded candidates
  // mid-generation.
  const FAST_POLL_INTERVAL_MS = 1000;
  const SLOW_POLL_INTERVAL_MS = 3000;
  const FAST_POLL_LIMIT = 8;
  const MAX_POLL_ATTEMPTS = 120; // 8×1 + 112×3 ≈ 344 s ≈ 5.7 min
  const [assessmentData, setAssessmentData] = useState<AssessmentData | null>(null);
  const [candidateAssessment, setCandidateAssessment] = useState<CandidateAssessment | null>(null);
  const [questions, setQuestions] = useState<QuestionData[]>([]);

  // Camera and recording states
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [isMicActive, setIsMicActive] = useState<boolean>(true);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const [recordingTime, setRecordingTime] = useState<number>(0);

  // Video recording refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const proctoringIntervalRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [editTimer, setEditTimer] = useState<number>(30);
  const [isInEditMode, setIsInEditMode] = useState<boolean>(false);
  const editTimerRef = useRef<number | null>(null);

  // Start gate states
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [cameraSize, setCameraSize] = useState<'sm' | 'md' | 'lg'>('md');
  const { data: profileData } = useGetProfileQuery();
  const candidateName = [profileData?.first_name, profileData?.last_name].filter(Boolean).join(' ') || profileData?.email || 'Candidate';
  const candidateInitial = (profileData?.first_name?.[0] || profileData?.email?.[0] || 'C').toUpperCase();
  const [showStartGate, setShowStartGate] = useState<boolean>(true);
  const [policyConsent, setPolicyConsent] = useState<boolean>(false);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("");
  const [isAssessmentStarted, setIsAssessmentStarted] = useState<boolean>(false);
  const [totalAssessmentTime, setTotalAssessmentTime] = useState<number>(0);

  // Question states
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [questionTime, setQuestionTime] = useState<number>(120);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(true);
  const [showProctoringAlert, setShowProctoringAlert] = useState<boolean>(false);
  // The specific violation behind the currently-visible proctoring popup, so the
  // floating alert shows a distinct title + message per movement type
  // (no face / multiple faces / looking away) instead of a generic banner.
  const [proctoringAlert, setProctoringAlert] = useState<{
    type: 'no_face' | 'multiple_faces' | 'gaze';
    title: string;
    message: string;
  } | null>(null);

  // Coding question states
  const [codeAnswers, setCodeAnswers] = useState<Record<number, string>>({});
  const [codeLanguages, setCodeLanguages] = useState<Record<number, string>>({});
  const [isRunningCode, setIsRunningCode] = useState<boolean>(false);
  const [codeResults, setCodeResults] = useState<Record<number, any>>({});
  // Per-(question, language) code cache so switching language is non-destructive:
  // each language keeps its own buffer and the first switch seeds the starter.
  const [codeByLang, setCodeByLang] = useState<Record<number, Record<string, string>>>({});
  // "Run Code" (independent run) output, kept separate from codeResults so a plain
  // run never overwrites the test-case results that get saved as the answer.
  const [codePlainResults, setCodePlainResults] = useState<Record<number, any>>({});
  // Which run the console should show per question: 'tests' (Run Tests) or 'run'
  // (Run Code). Defaults to 'tests' so saved/loaded results show on revisit.
  const [lastRunMode, setLastRunMode] = useState<Record<number, 'tests' | 'run'>>({});
  // Editable stdin for "Run Code", pre-filled from the question's sample input.
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});
  // Editor chrome controlled by the parent (the CodeEditor is a controlled
  // component for theme + fullscreen so the surrounding panel can react).
  const [codeEditorTheme, setCodeEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark');
  const [isCodeEditorFullscreen, setIsCodeEditorFullscreen] = useState<boolean>(false);

  // Modal states
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [showFullscreenExitModal, setShowFullscreenExitModal] = useState<boolean>(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState<number>(0);
  const [showWhisperFailureModal, setShowWhisperFailureModal] = useState<boolean>(false);

  // UI states
  const [isProctoringActive, setIsProctoringActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Question numbers (1-indexed) whose voice answer has been recorded and
  // uploaded. The upload IS the submission (the BE transcribes the audio after
  // the assessment is submitted), so once a question is here we show an
  // "Answer submitted" confirmation + "Record again" instead of the mic CTA.
  const [audioSubmittedQuestions, setAudioSubmittedQuestions] = useState<Record<number, boolean>>({});

  // Voice recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [lastRecordedQuestionNumber, setLastRecordedQuestionNumber] = useState<number | null>(null);

  // Video recording states (multipart upload)
  const [interviewMediaRecorder, setInterviewMediaRecorder] = useState<MediaRecorder | null>(null);
  const [interviewVideoChunks, setInterviewVideoChunks] = useState<Blob[]>([]);
  const [multipartUploadData, setMultipartUploadData] = useState<any>(null);
  const [uploadedParts, setUploadedParts] = useState<any[]>([]);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const stopRequestedTimeRef = useRef<number | null>(null);
  // Non-stale mirror of uploadedParts — onstop/complete run inside closures
  // captured at recorder-creation time, where the state value is frozen at [].
  const uploadedPartsRef = useRef<any[]>([]);
  // Monotonic S3 part number, bumped atomically
  const partCounterRef = useRef<number>(0);
  // Resolves once onstop has flushed every chunk AND all part uploads settle.
  // stopVideoRecording() awaits this before completeMultipartUpload() runs,
  // so a late upload_part can't hit an already-completed UploadId (NoSuchUpload).
  const recordingFinalizedRef = useRef<Promise<void> | null>(null);

  // Direct S3 Upload refs and queue
  const accumulatedBlobsRef = useRef<Blob[]>([]);
  const accumulatedSizeRef = useRef<number>(0);
  const activeUploadsCountRef = useRef<number>(0);
  const uploadQueueRef = useRef<(() => Promise<void>)[]>([]);
  const pendingUploadsPromiseRef = useRef<Promise<void> | null>(null);
  const resolvePendingUploadsRef = useRef<(() => void) | null>(null);

  // Proctoring states
  const [multipleFaceCount, setMultipleFaceCount] = useState<number>(0);
  const [gazeViolationCount, setGazeViolationCount] = useState<number>(0);
  const [multipleFaceActive, setMultipleFaceActive] = useState<boolean>(false);
  // setter-only — getter is unread by the UI, kept as a state slot so the
  // proctoring callback stays a stable setter reference.
  const [, setFaceCount] = useState(0);
  const [cameraBoxAlert, setCameraBoxAlert] = useState(false);
  const faceMeshRef = useRef<any>(null);
  const cameraUtilsRef = useRef<any>(null);
  // Hard stop for proctoring. The MediaPipe onResults callback is registered
  // once with a stale onFaceDetection closure, so toggling React state does NOT
  // silence warnings — onFaceDetection reads this ref first and bails out.
  const proctoringStoppedRef = useRef<boolean>(false);
  const previousFaceCountRef = useRef(0);
  const lastIncidentTimeRef = useRef(0);
  const faceHistoryRef = useRef<number[]>([]);
  const STABLE_FRAME_WINDOW = 10;
  const spikeStartTimeRef = useRef<number | null>(null);
  const SPIKE_CONFIRMATION_TIME = 200; // ms
  // ADD THESE NEW STATES FROM SECOND CODE:
  const [noFaceDetectionCount, setNoFaceDetectionCount] = useState<number>(0);
  const lastNoFaceDetectionRef = useRef<number>(0);
  const isCurrentlyLookingAwayRef = useRef<boolean>(false);

  const alertTimeoutRef = useRef<number | null>(null);
  const { toast } = useToast();

  // RTK Query hooks
  const [triggerTakeAiAssessment] = useLazyTakeAiAssessmentQuery();
  const [checkQuestionsReady] = useLazyCheckQuestionsReadyQuery();
  const [saveProctoringIncident] = useSaveProctoringIncidentMutation();
  const [getPresignedUrl] = useGetPresignedUrlMutation();
  const [getVideoPartUrl] = useGetVideoPartUrlMutation();
  const [completeMultipartUploadMutation] = useCompleteMultipartUploadMutation();
  const [uploadVideo] = useUploadVideoMutation();
  const [uploadVideoForm] = useUploadVideoFormMutation();
  const [uploadAudio] = useUploadAudioMutation();
  const [saveAiAnswer] = useSaveAiAnswerMutation();
  const [runCode] = useRunCodeMutation();
  const [submitAiAssessment] = useSubmitAiAssessmentMutation();
  const [prepareQuestionsAsync] = usePrepareQuestionsAsyncMutation();
  const [checkAiAssessmentStatus] = useLazyCheckAiAssessmentStatusQuery();

  // Constants
  const MULTIPLE_FACE_COOLDOWN = 3000;
  const TEXT_QUESTION_TIME_LIMIT = 120; // 2 minutes for text questions
  const FACE_NOT_DETECTED_COOLDOWN = 5000;
  const GAZE_COOLDOWN = 3000;
  // Global throttle across ALL proctoring alert types. The per-type cooldowns
  // above can still interleave (no-face → gaze → multiple-face) and fire every
  // frame, so this enforces a single min gap between ANY two alerts/screenshots.
  const GLOBAL_ALERT_COOLDOWN = 4000; // ms
  const lastAlertTimeRef = useRef<number>(0);

  // ==================== PROCTORING INCIDENT BATCHING ====================
  // To keep load off the backend, violations are NOT sent per-incident. They are
  // buffered locally and uploaded in one request (an `incidents` JSON list plus
  // the matching `screenshots` files, same order) at three points only:
  //   1. a periodic safety flush every PROCTOR_FLUSH_INTERVAL_MS (so a crash/close
  //      loses at most one interval of data),
  //   2. on submit / proctoring stop (the main flush — drains everything left),
  //   3. a PROCTOR_MAX_QUEUE backstop, so a pathological burst can't build an
  //      unbounded request before the next interval tick.
  const PROCTOR_FLUSH_INTERVAL_MS = 60000; // periodic safety flush
  const PROCTOR_MAX_QUEUE = 25; // backstop: flush early if the buffer grows past this
  const incidentQueueRef = useRef<
    Array<{ incident_type: string; timestamp: string; details: string; screenshot?: File }>
  >([]);
  const proctorFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest resolved assessment id, mirrored into a ref so the unmount flush
  // (captured with an empty dep array) still sends the correct id instead of
  // the null it would close over from first render.
  const assessmentIdRef = useRef<string | number | null>(null);

  const getQuestionTimeLimit = (questionIndex?: number) => {
    const idx = questionIndex ?? currentQuestion;
    const q = questions[idx];
    if (q?.type === 'coding') {
      return (assessmentData?.coding_time_limit || 10) * 60; // admin-set minutes → seconds
    }
    return TEXT_QUESTION_TIME_LIMIT;
  };

  const lastGazeViolationTimeRef = useRef<number>(0);

  // Add this flag to track if recording was started for current question
  const [recordingStartedForCurrentQuestion, setRecordingStartedForCurrentQuestion] = useState<boolean>(false);

  // ==================== POLL QUESTIONS READY, THEN FETCH ASSESSMENT DATA ====================
  useEffect(() => {
    // Ref guard: prevents interval from firing after we've already loaded
    const finishedRef = { current: false };

    const doLoadAssessment = async () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setQuestionsReady(true);
      await fetchAssessmentData();
    };

    // Schedule the next poll using fast pacing for the first FAST_POLL_LIMIT
    // attempts, then slow back-off. setTimeout (recursive) instead of
    // setInterval so the cadence can change without resetting the clock.
    const scheduleNextPoll = () => {
      if (finishedRef.current) return
      const interval =
        pollingAttemptsRef.current < FAST_POLL_LIMIT
          ? FAST_POLL_INTERVAL_MS
          : SLOW_POLL_INTERVAL_MS
      pollingTimeoutRef.current = window.setTimeout(poll, interval)
    }

    const poll = async () => {
      if (finishedRef.current) return;
      try {
        const statusData = await checkQuestionsReady(Number(id)).unwrap();
        pollingAttemptsRef.current += 1;

        if (statusData?.ready) {
          await doLoadAssessment();
          return;
        }

        // Past the window and still not ready — don't force a load that would
        // just bounce off a 'generating' response and dead-end. Surface a
        // retry screen and stop polling.
        if (pollingAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
          finishedRef.current = true;
          setPrepTimedOut(true);
          return;
        }

        const dots = '.'.repeat((pollingAttemptsRef.current % 3) + 1);
        setPollingMessage(`Preparing your interview questions${dots}`);
        scheduleNextPoll();
      } catch {
        // check-questions endpoint failed — try loading directly (the questions
        // may already be ready even though /check-questions errored).
        await doLoadAssessment();
      }
    };

    const startQuestionPreparation = async () => {
      // OPTIMISATION 1: peek at the status BEFORE firing the heavy
      // prepareQuestionsAsync mutation. If the BE already has cached
      // questions for this assignment (resume / refresh case), we skip
      // the prepare call entirely and the very first poll resolves to
      // ready → loader closes in well under a second.
      try {
        const preCheck = await checkQuestionsReady(Number(id)).unwrap()
        if (preCheck?.ready) {
          await doLoadAssessment()
          return
        }
      } catch {
        // status endpoint unavailable — fall through to the normal path
      }

      try {
        await prepareQuestionsAsync(Number(id)).unwrap();
      } catch (error) {
        console.warn('Question preparation trigger failed or was already started:', error);
      }

      // Poll immediately, then back off with fast → slow cadence.
      poll();
    };

    // Fresh start (initial mount or manual retry): reset counters/flags.
    pollingAttemptsRef.current = 0;
    setPrepTimedOut(false);
    setPollingElapsedSec(0);

    startQuestionPreparation();

    // Elapsed-seconds ticker so the loader can show real progress text.
    const elapsedTicker = window.setInterval(
      () => setPollingElapsedSec((s) => s + 1),
      1000,
    )

    return () => {
      finishedRef.current = true; // prevent any in-flight poll from proceeding
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
      window.clearInterval(elapsedTicker)
    };
  }, [id, prepRetryNonce]); // eslint-disable-line react-hooks/exhaustive-deps


  const fetchAssessmentData = async () => {
    try {
      const data = await triggerTakeAiAssessment(Number(id)).unwrap();

      // BE returns HTTP 202 with `{status: 'generating', ...}` while the
      // async question generation is still in flight. RTK Query's
      // unwrap() treats any 2xx as success, so without this guard we
      // tried to populate state with undefined assessment / questions /
      // responses and the page rendered "Assessment not found". Keep
      // the candidate on the loader and let the polling loop pick it up
      // on the next /status/ tick.
      if ((data as any)?.status === 'generating') {
        // Questions still being generated. The poll loop that called us has
        // already stopped, so show the retry screen rather than freezing on
        // an endless "Finalising…" with no way forward.
        setQuestionsReady(false)
        setPollingMessage('Finalising your interview questions…')
        setPrepTimedOut(true)
        return
      }

      setAssessmentData(data.assessment);
      setCandidateAssessment(data.candidate_assessment);
      // Mirror the assessment id for the unmount-time incident flush.
      assessmentIdRef.current = data.assessment?.id ?? data.candidate_assessment?.id ?? null;

      // Handle both legacy string[] and new QuestionData[] format
      const rawQuestions = data.questions || [];
      const normalizedQuestions: QuestionData[] = rawQuestions.map((q: any) =>
        typeof q === 'string'
          ? { text: q, type: 'text' as const, source: 'unknown' }
          : q
      );
      setQuestions(normalizedQuestions);

      // Load existing responses
      if (data.responses) {
        const formattedAnswers: Record<number, string> = {};
        const loadedCodeAnswers: Record<number, string> = {};
        const loadedCodeLanguages: Record<number, string> = {};
        const loadedCodeResults: Record<number, any> = {};
        Object.entries(data.responses).forEach(([key, value]: [string, any]) => {
          const qNum = parseInt(key);
          formattedAnswers[qNum] = value.answer_text || '';
          if (value.code_answer) loadedCodeAnswers[qNum] = value.code_answer;
          if (value.code_language) loadedCodeLanguages[qNum] = value.code_language;
          if (value.code_execution_results && value.code_execution_results.length > 0) {
            loadedCodeResults[qNum] = { data: { results: value.code_execution_results } };
          }
        });
        setAnswers(formattedAnswers);
        if (Object.keys(loadedCodeAnswers).length > 0) setCodeAnswers(loadedCodeAnswers);
        if (Object.keys(loadedCodeLanguages).length > 0) setCodeLanguages(loadedCodeLanguages);
        if (Object.keys(loadedCodeResults).length > 0) setCodeResults(loadedCodeResults);

        // Load answer for current question (defaults to question 1)
        const currentQuestionNum = 1; // Start with question 1
        setTranscribedText(formattedAnswers[currentQuestionNum] || '');
      }

      // Set proctoring counts from backend
      if (data.candidate_assessment) {
        setMultipleFaceCount(data.candidate_assessment.multiple_faces_count);
        setGazeViolationCount(data.candidate_assessment.gaze_violation_count);
        setNoFaceDetectionCount(data.candidate_assessment.no_face_detection_count || 0);
      }

      setLoading(false);

      // Set initial timer based on first question type
      const firstQ = normalizedQuestions[0];
      if (firstQ?.type === 'coding') {
        setQuestionTime((data.assessment?.coding_time_limit || 10) * 60);
      } else {
        setQuestionTime(TEXT_QUESTION_TIME_LIMIT);
      }
    } catch (error: any) {
      console.error('Error fetching assessment:', error);
      const errorStatus = error?.data?.status;
      if (errorStatus === 'introduction_pending') {
        navigate(`/candidate/ai-assessment/${id}/introduction`);
        return;
      }
      // BE returns 202 with status='generating' when the async question
      // generation is still in flight. Keep the candidate on the polling
      // loader instead of navigating away — the existing readiness poll
      // will flip the screen as soon as questions are ready.
      if (errorStatus === 'generating') {
        setQuestionsReady(false)
        setPollingMessage('Finalising your interview questions…')
        setPrepTimedOut(true)
        return
      }
      toast({
        title: 'Error',
        description: error?.data?.message || 'Failed to load assessment. Please try again.',
        variant: 'destructive',
        duration: 3000
      });
      navigate('/candidate/completed-assessments');
    }
  };


  const loadAnswerForQuestion = (questionNumber: number) => {
    // Get answer from local answers state
    const answer = answers[questionNumber] || '';
    setTranscribedText(answer);
  };

  // ==================== CAMERA INITIALIZATION ====================
  // The original inline effect's cleanup also stopped the question-recording
  // timer and any in-flight media recorder — useCamera lets us pass that as
  // `onCleanupExtra` so the chained cleanup runs identically.
  useCamera({
    enabled: !!(assessmentData?.enable_camera && isAssessmentStarted),
    videoRef,
    cameraStream,
    setCameraStream,
    setIsCameraActive,
    setCameraError,
    setIsProctoringActive,
    onStreamReady: initializeProctoring,
    onCleanupExtra: () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    },
    rebindDeps: [isAssessmentStarted, cameraSize, isCameraActive],
  });

  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) { resolve(undefined); return; }

        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load: ${src}`));
        document.head.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // Load both MediaPipe bundles in parallel — they're independent, so
        // awaiting them sequentially just doubled the wait before proctoring
        // could initialise.
        await Promise.all([
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'),
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
        ]);
      } catch (error) {
        console.error('FaceMesh load failed:', error);
      }
    };

    init();
  }, []);

  // ==================== QUESTION TIMER ====================
  // Behaviour mirrors the previous inline effect exactly — the interval is
  // restarted every second (driven by `questionTime` in the dep list inside
  // the hook), preserving the drift profile of the original implementation.
  useQuestionTimer({
    enabled: isTimerRunning && isAssessmentStarted,
    remainingSec: questionTime,
    onSecondElapsed: () => {
      setQuestionTime((prev) => {
        if (prev <= 1) {
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    },
  });

  const captureScreenshot = useCallback(async (): Promise<File | null> => {
    if (!videoRef.current) return null;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      
      // Draw current video frame to canvas
      ctx.drawImage(videoRef.current, 0, 0);
      
      // Convert to Blob/File
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          const file = new File([blob], `violation_${Date.now()}.jpg`, { type: 'image/jpeg' });
          resolve(file);
        }, 'image/jpeg', 0.8); // 0.8 is quality
      });
    } catch (err) {
      console.error("Screenshot capture failed:", err);
      return null;
    }
  }, []);

  const getFaceCenter = (landmarks: any) => {
    const left = landmarks[234];
    const right = landmarks[454];
    const top = landmarks[10];
    const bottom = landmarks[152];

    return {
      x: (left.x + right.x) / 2,
      y: (top.y + bottom.y) / 2,
    };
  };

  const isDuplicateFace = (faceA: any, faceB: any) => {
    const c1 = getFaceCenter(faceA);
    const c2 = getFaceCenter(faceB);

    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < 0.08 && Math.abs(c1.y - c2.y) < 0.05; // tuned for real-world stability
  };

  const getFaceSize = (landmarks: any) => {
    const left = landmarks[234];
    const right = landmarks[454];
    return Math.abs(left.x - right.x);
  };

  const onFaceDetection = async (results: FaceMeshResults) => {
   // Hard stop (ref, not state) — survives the stale onResults closure so
   // warnings never fire once the candidate has submitted.
   if (proctoringStoppedRef.current) return;
   if (!isAssessmentStarted) return;
   // Camera intentionally turned off by the candidate — don't run detection
   // (the video track is disabled, so frames are black and would otherwise
   // trigger a stream of false "no face" violations).
   if (!isCameraActive) return;

    // Capture timestamp at detection start for precise timing
    const detectionStartTime = Date.now();
    const detectionTimestamp = new Date(detectionStartTime);

    let faces = results.multiFaceLandmarks || [];

    // STEP 1: Remove small/noisy faces FIRST
    const avgFaceSize = faces.reduce((sum, f) => sum + getFaceSize(f), 0) / faces.length;

    faces = faces.filter(face => getFaceSize(face) > avgFaceSize * 0.5);

    // STEP 2: Deduplicate ALL faces (not just 2)
    const uniqueFaces: any[] = [];

    faces.forEach(face => {
      const isDuplicate = uniqueFaces.some(existing =>
        isDuplicateFace(existing, face)
      );

      if (!isDuplicate) {
        uniqueFaces.push(face);
      }
    });

    faces = uniqueFaces;

    // STEP 3: Final count
    const currentFaces = faces.length;
    setFaceCount(currentFaces);

  
    if (currentFaces === 0) {
      const now = Date.now();

      // Only trigger warning once every 5 seconds, and never more often than
      // the global alert cooldown (stops millisecond-rate spam on face flicker).
      if (
        now - lastNoFaceDetectionRef.current > FACE_NOT_DETECTED_COOLDOWN &&
        now - lastAlertTimeRef.current > GLOBAL_ALERT_COOLDOWN
      ) {
        const screenshot = await captureScreenshot();
        showProctoringAlertWithTimeout({
          type: 'no_face',
          title: 'No face detected',
          message: 'Please ensure your face is visible to the camera.',
        });

        // Show toast notification
        toast({
          title: 'Proctoring Alert',
          description: '⚠ No face detected. Please ensure your face is visible to the camera.',
          variant: 'destructive',
          duration: 3000,
        });

        sendProctorViolation("no_face", detectionTimestamp.toISOString(),"No face detected - please sit in front of camera", screenshot || undefined);

        // Update last detection time
        lastNoFaceDetectionRef.current = now;
        lastAlertTimeRef.current = now;
        setNoFaceDetectionCount(prev => prev + 1);

        // Visual feedback - make camera border red
        setCameraBoxAlert(true);
        setTimeout(() => 
         setCameraBoxAlert(false), 1500);
      }

      // Reset multiple face tracking when no faces
      previousFaceCountRef.current = 0;
      setMultipleFaceActive(false);
      isCurrentlyLookingAwayRef.current = false;
      return;
    }

    // Reset no-face detection timer since we have a face
      lastNoFaceDetectionRef.current = 0;

    // STEP 3: TEMPORAL SMOOTHING

    faceHistoryRef.current.push(currentFaces);

    if (faceHistoryRef.current.length > STABLE_FRAME_WINDOW) {
      faceHistoryRef.current.shift();
    }

    const multiFrameCount =
      faceHistoryRef.current.filter(f => f >= 2).length;

    const stabilityRatio =
      multiFrameCount / faceHistoryRef.current.length;

    const lastFrames = faceHistoryRef.current.slice(-3);

    const isStableMultipleFaces =
      stabilityRatio > 0.7 || lastFrames.every(f => f >= 2);


    // STEP 4: MULTIPLE FACE DETECTION
      const now = Date.now();
    //  Detect transition: 1 → multiple
    if (currentFaces > 1 && previousFaceCountRef.current <= 1) {
      if (!spikeStartTimeRef.current) {
        spikeStartTimeRef.current = now;
      }
    }

    //  Confirm only if stable for defined time
    const isSpikeConfirmed =
      spikeStartTimeRef.current &&
      now - spikeStartTimeRef.current > SPIKE_CONFIRMATION_TIME;

    // Reset spike if back to normal
    if (currentFaces <= 1 && stabilityRatio < 0.3) {
      setMultipleFaceActive(false);
    }

    // Final trigger
    if (
      isStableMultipleFaces &&
      isSpikeConfirmed &&
      !multipleFaceActive &&
      now - lastIncidentTimeRef.current > MULTIPLE_FACE_COOLDOWN &&
      now - lastAlertTimeRef.current > GLOBAL_ALERT_COOLDOWN
    ) {
        const screenshot = await captureScreenshot();
        setMultipleFaceCount(prev => prev + 1);
        setMultipleFaceActive(true);
      lastIncidentTimeRef.current = now;
      lastAlertTimeRef.current = now;
        showProctoringAlertWithTimeout({
          type: 'multiple_faces',
          title: 'Multiple faces detected',
          message: 'Only the candidate should be visible in the frame.',
        });

        toast({
          title: 'Proctoring Alert',
          description: `⚠ Multiple faces detected`,
          variant: 'destructive',
          duration: 3000,
        });

        // Send with precise detection timestamp
         sendProctorViolation(
        "multiple_faces",
        detectionTimestamp.toISOString(),
        "Multiple faces detected",
        screenshot || undefined
      );

      setCameraBoxAlert(true);
      setTimeout(() => setCameraBoxAlert(false), 3000);
      }
      // Update previous face count for next frame
    previousFaceCountRef.current = currentFaces;

    /* ============================================
     GAZE MOVEMENT DETECTION - ONLY IF SINGLE FACE
    ============================================ */
    if (currentFaces === 1) {
      const landmarks = faces[0];
      if (landmarks && landmarks.length >= 263) {
        // Get required landmarks
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const noseTip = landmarks[1];
        const forehead = landmarks[10];

        // Calculate gaze metrics
        const gazeRatio = Math.abs(leftEye.x - rightEye.x);
        const eyeAvgY = (leftEye.y + rightEye.y) / 2;
        const verticalRatio = Math.abs(eyeAvgY - noseTip.y);
        const faceWidth = gazeRatio;
        const faceHeight = Math.abs(forehead.y - noseTip.y);
        const faceRatio = faceWidth / faceHeight;

        const isLookingAway =
          gazeRatio < 0.04 ||        // Looking left/right
          verticalRatio > 0.25 ||    // Looking up/down
          faceRatio < 0.55 ||        // Face turned left
          faceRatio > 1.45;          // Face turned right

        if (
          isLookingAway &&
          !isCurrentlyLookingAwayRef.current &&
          now - lastGazeViolationTimeRef.current > GAZE_COOLDOWN &&
          now - lastAlertTimeRef.current > GLOBAL_ALERT_COOLDOWN) {
          const screenshot = await captureScreenshot();

          setGazeViolationCount(prev => prev + 1);
          isCurrentlyLookingAwayRef.current = true;
          lastGazeViolationTimeRef.current = now;
          lastAlertTimeRef.current = now;

          sendProctorViolation(
            "gaze", detectionTimestamp.toISOString(),
             "Looking away from screen - please focus on the assessment",screenshot || undefined  );

          // Show warning
          showProctoringAlertWithTimeout({
            type: 'gaze',
            title: 'Looking away',
            message: 'Please keep your eyes on the screen.',
          });

          toast({
            title: 'Proctoring Alert',
            description: '⚠ Looking Away. Please look at the screen',
            variant: 'destructive',
            duration: 3000,
          });

          // Visual feedback - yellow border for gaze violation
          setCameraBoxAlert(true);
          setTimeout(() => {
            if (!multipleFaceActive) setCameraBoxAlert(false);
          }, 1000);
        } else if (!isLookingAway) {
          isCurrentlyLookingAwayRef.current = false;
        }
      }
    } else {
      // Reset gaze tracking when multiple faces
      isCurrentlyLookingAwayRef.current = false;
    }
  };

  // The `stream` argument is kept for symmetry with the caller, but face
  // detection uses `videoRef.current` directly via the mediapipe Camera util.
  // Declared as a function (not a const arrow) so it's hoisted within the
  // component scope and can be referenced by useCamera() earlier in the body.
  async function initializeProctoring(_stream: MediaStream) {
    if (!assessmentData?.enable_camera || !window.FaceMesh) return;

    try {
      faceMeshRef.current = new window.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });

      faceMeshRef.current.setOptions({
        maxNumFaces: 2,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      faceMeshRef.current.onResults(onFaceDetection);

      if (window.Camera && videoRef.current) {
        cameraUtilsRef.current = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (faceMeshRef.current && videoRef.current) {
              await faceMeshRef.current.send({ image: videoRef.current });
            }
          },
          width: 640,
          height: 480,
        });
        await cameraUtilsRef.current.start();
        setIsProctoringActive(true);
      }
    } catch (error) {
      console.error('FaceMesh init failed:', error);
    }
  }

  // ==================== CLEANUP ON UNMOUNT ====================
  useEffect(() => {
    return () => {
      // Best-effort: flush any proctoring incidents still buffered before the
      // component tears down.
      void flushProctorIncidents();
      // Cleanup on component unmount
      if (proctorFlushTimerRef.current) {
        clearInterval(proctorFlushTimerRef.current);
      }
      if (proctoringIntervalRef.current) {
        clearInterval(proctoringIntervalRef.current);
      }
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (editTimerRef.current) {
        clearInterval(editTimerRef.current);
      }
      if (cameraUtilsRef.current) {
        cameraUtilsRef.current.stop();
      }
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
    };
  }, []);

  // ==================== PERIODIC PROCTORING SAFETY FLUSH ====================
  // Upload whatever violations have buffered every PROCTOR_FLUSH_INTERVAL_MS so a
  // crash/close loses at most one interval of data. The main flush still happens
  // on submit / proctoring stop; this is just the safety net. Flushing an empty
  // buffer is a no-op, so it's safe to run for the whole component lifetime.
  useEffect(() => {
    proctorFlushTimerRef.current = setInterval(() => {
      void flushProctorIncidents();
    }, PROCTOR_FLUSH_INTERVAL_MS);
    return () => {
      if (proctorFlushTimerRef.current) {
        clearInterval(proctorFlushTimerRef.current);
        proctorFlushTimerRef.current = null;
      }
    };
  }, []);

  const showProctoringAlertWithTimeout = (
    alert?: { type: 'no_face' | 'multiple_faces' | 'gaze'; title: string; message: string },
  ) => {
    // Clear any existing timeout
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }

    // Record which movement triggered this alert so the popup renders the
    // matching title + message (falls back to a generic banner if omitted).
    if (alert) {
      setProctoringAlert(alert);
    }

    // Show the alert
    setShowProctoringAlert(true);

    // Set timeout to hide after 3 seconds
    alertTimeoutRef.current = setTimeout(() => {
      setShowProctoringAlert(false);
    }, 3000);
  };

  // Flush ALL buffered proctoring incidents to the backend in ONE request:
  // `incidents` is a JSON list of {incident_type, timestamp, details, severity}
  // and the matching screenshots are appended (in the same order) under the
  // `screenshots` field. Called by the periodic safety timer, the queue backstop,
  // and on submit / proctoring stop. Always drains the whole buffer.
  const flushProctorIncidents = async () => {
    const queue = incidentQueueRef.current;
    if (queue.length === 0) return;

    // Splice the whole buffer out synchronously so a concurrent flush (interval
    // tick vs. submit) can't grab the same incidents — the detection callback
    // fires every frame and the timer/submit can overlap.
    const batch = queue.splice(0, queue.length);
    if (batch.length === 0) return;

    try {
      const formData = new FormData();
      formData.append(
        "assessment_id",
        String(assessmentData?.id || candidateAssessment?.id || assessmentIdRef.current),
      );
      formData.append("send_email", "false");

      // JSON list — order matches the screenshots appended below. `screenshot`
      // carries the file name so the backend can also match by name if needed.
      const incidents = batch.map((item) => ({
        incident_type: item.incident_type,
        timestamp: item.timestamp,
        details: item.details,
        severity: "medium",
        screenshot: item.screenshot?.name ?? null,
      }));
      formData.append("incidents", JSON.stringify(incidents));

      // Append the screenshot files in the same order as the JSON list.
      batch.forEach((item) => {
        if (item.screenshot) {
          formData.append("screenshots", item.screenshot);
        }
      });

      await saveProctoringIncident(formData).unwrap();
    } catch (error) {
      console.error("Failed to send proctoring incident batch:", error);
    }
  };

  // Enqueue a single violation. The API call is deferred — the buffer is
  // uploaded by the periodic safety timer / on submit. Only a pathological burst
  // that crosses PROCTOR_MAX_QUEUE before the next tick forces an early flush, so
  // a single request can't grow unbounded.
  const sendProctorViolation = (
    incidentType: string,
    timestamp?: string,
    details?: string,
    screenshotFile?: File
  ) => {
    incidentQueueRef.current.push({
      incident_type: incidentType,
      timestamp: timestamp || new Date().toISOString(),
      details: details || "",
      screenshot: screenshotFile,
    });

    // Backstop only (don't await — detection must stay responsive).
    if (incidentQueueRef.current.length >= PROCTOR_MAX_QUEUE) {
      void flushProctorIncidents();
    }
  };

  const enqueueUpload = (uploadFn: () => Promise<void>) => {
    if (!pendingUploadsPromiseRef.current) {
      pendingUploadsPromiseRef.current = new Promise<void>((resolve) => {
        resolvePendingUploadsRef.current = resolve;
      });
    }
    uploadQueueRef.current.push(uploadFn);
    processQueue();
  };

  const processQueue = async () => {
    if (activeUploadsCountRef.current >= 3) return;
    const nextUpload = uploadQueueRef.current.shift();
    if (!nextUpload) {
      if (activeUploadsCountRef.current === 0 && resolvePendingUploadsRef.current) {
        resolvePendingUploadsRef.current();
        pendingUploadsPromiseRef.current = null;
        resolvePendingUploadsRef.current = null;
      }
      return;
    }

    activeUploadsCountRef.current++;
    try {
      await nextUpload();
    } catch (err) {
      console.error("Queue upload error:", err);
    } finally {
      activeUploadsCountRef.current--;
      processQueue();
    }
  };

  // ==================== VIDEO RECORDING (MULTIPART UPLOAD) ====================
  const initializeMultipartUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('ai_assessment_id', id!);
      formData.append('file_name', 'complete_interview.webm');
      formData.append('file_type', 'video/webm');
      formData.append('use_multipart', 'true');

      const data = await getPresignedUrl(formData).unwrap();

      setMultipartUploadData(data);
      return data;
    } catch (error) {
      console.error('Failed to initialize multipart upload:', error);
      throw error;
    }
  };

  const startVideoRecording = async (providedStream?: MediaStream) => {
    const streamToUse = providedStream || cameraStream;
    if (!streamToUse || !isCameraActive) {
      toast({
        title: "Error",
        description: "Camera is not available",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    chunksRef.current = [];
    stopRequestedTimeRef.current = null;

    try {
      // Try to initialize S3 multipart upload, but don't block recording if it fails
      let multipartData: any = null;
      try {
        multipartData = await initializeMultipartUpload();
      } catch (s3Error) {
        console.warn('S3 multipart init failed, will use direct upload at end:', s3Error);
      }

      // Check if the stream is still active
      if (streamToUse.getTracks().every(track => track.readyState !== 'live')) {
        throw new Error('Camera stream is no longer active');
      }

      // Try different mimeTypes in order of preference
      const mimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
        ''
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }
      const options: MediaRecorderOptions = {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 1000000
      };

      const recorder = new MediaRecorder(streamToUse, options);
      setInterviewMediaRecorder(recorder);
      setInterviewVideoChunks([]);
      setUploadedParts([]);

      // Reset the per-recording upload bookkeeping. These refs (not state) are
      // the source of truth inside the recorder callbacks below.
      uploadedPartsRef.current = [];
      partCounterRef.current = 0;
      accumulatedBlobsRef.current = [];
      accumulatedSizeRef.current = 0;
      activeUploadsCountRef.current = 0;
      uploadQueueRef.current = [];
      pendingUploadsPromiseRef.current = null;
      resolvePendingUploadsRef.current = null;

      // Deferred that resolves once onstop has finished flushing + uploading.
      let resolveFinalized: () => void = () => {};
      recordingFinalizedRef.current = new Promise<void>((res) => {
        resolveFinalized = res;
      });

      // Store the multipart data for use in callbacks
      const currentMultipartData = multipartData;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          setInterviewVideoChunks(prev => [...prev, event.data]);

          // Only attempt chunk upload if S3 multipart was initialized
          if (!currentMultipartData) return;

          accumulatedBlobsRef.current.push(event.data);
          accumulatedSizeRef.current += event.data.size;

          if (accumulatedSizeRef.current >= 5 * 1024 * 1024) {
            const chunkToUpload = new Blob(accumulatedBlobsRef.current, { type: selectedMimeType });
            accumulatedBlobsRef.current = [];
            accumulatedSizeRef.current = 0;

            const partNumber = ++partCounterRef.current;
            enqueueUpload(async () => {
              try {
                await uploadChunkToS3(chunkToUpload, partNumber, currentMultipartData);
              } catch (error) {
                console.error(`Failed to upload chunk part ${partNumber}:`, error);
              }
            });
          }
        }
      };

      recorder.onstop = async () => {
        try {
          // Clear recording timer
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // If there are leftovers in the accumulator, upload them as the final part.
          if (currentMultipartData && accumulatedBlobsRef.current.length > 0) {
            const chunkToUpload = new Blob(accumulatedBlobsRef.current, { type: selectedMimeType });
            accumulatedBlobsRef.current = [];
            accumulatedSizeRef.current = 0;

            const partNumber = ++partCounterRef.current;
            enqueueUpload(async () => {
              try {
                await uploadChunkToS3(chunkToUpload, partNumber, currentMultipartData);
              } catch (error) {
                console.error(`Failed to upload chunk part ${partNumber}:`, error);
              }
            });
          }

          // Wait for every queued part upload to settle
          if (currentMultipartData && pendingUploadsPromiseRef.current) {
            await pendingUploadsPromiseRef.current;
          }

          const blob = new Blob(chunksRef.current, { type: selectedMimeType });

          const durationAtStop = stopRequestedTimeRef.current ?? recordingTime;

          // If recording is too short, show error and discard
          if (durationAtStop < 30) {
            chunksRef.current = [];
            setInterviewVideoChunks([]);
            setRecordedBlob(null);
            toast({
              title: "Recording Too Short",
              description: "Please record a video longer than 30 seconds.",
              variant: "destructive",
              duration: 4000
            });
            stopRequestedTimeRef.current = null;
            return;
          }

          stopRequestedTimeRef.current = null;
          setRecordedBlob(blob);
        } finally {
          resolveFinalized();
        }
      };

      // Start recording with 5-second slices to accumulate chunk sizes
      recorder.start(5000);
      // Start recording timer
      const recordingTimer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Store timer reference
      timerRef.current = recordingTimer;

    } catch (error: any) {
      console.error('Failed to start video recording:', error);
      toast({
        title: "Recording Error",
        description: error.message || "Failed to start video recording",
        variant: "destructive",
        duration: 3000
      });
    }
  };

  const uploadChunkToS3 = async (chunk: Blob, partNumber: number, multipartData?: any) => {
    const dataToUse = multipartData || multipartUploadData;
    if (!dataToUse) {
      console.error('No multipart upload data available');
      return;
    }

    const MAX_ATTEMPTS = 3;
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { presigned_url } = await getVideoPartUrl({
          upload_id: dataToUse.upload_id,
          file_key: dataToUse.file_key,
          part_number: partNumber,
        }).unwrap();

        const response = await fetch(presigned_url, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': chunk.type || 'video/webm',
          },
        });

        if (!response.ok) {
          throw new Error(`S3 upload failed with status: ${response.status}`);
        }

        let etag = response.headers.get('ETag');
        if (!etag) {
          throw new Error('ETag header not returned by S3. ExposeHeaders setting may be missing.');
        }

        if (!etag.startsWith('"')) etag = `"${etag}"`;

        const existingIndex = uploadedPartsRef.current.findIndex(p => p.PartNumber === partNumber);
        if (existingIndex >= 0) {
          uploadedPartsRef.current[existingIndex] = { PartNumber: partNumber, ETag: etag };
        } else {
          uploadedPartsRef.current = [...uploadedPartsRef.current, { PartNumber: partNumber, ETag: etag }];
        }
        setUploadedParts(uploadedPartsRef.current);

        return { etag };
      } catch (error: any) {
        lastError = error;
        const httpStatus = error?.status ?? error?.data?.status ?? 0;
        const transient = httpStatus >= 500 || httpStatus === 0 || error instanceof TypeError;
        if (attempt < MAX_ATTEMPTS && transient) {
          const backoff = 400 * Math.pow(2, attempt - 1); // 400, 800, 1600 ms
          console.warn(
            `[chunk-upload] chunk ${partNumber} attempt ${attempt} failed (status=${httpStatus}), retrying in ${backoff}ms`,
          );
          await new Promise((r) => window.setTimeout(r, backoff));
          continue;
        }
        break;
      }
    }
    console.error(`Failed to upload chunk ${partNumber} after ${MAX_ATTEMPTS} attempts:`, lastError);
    throw lastError;
  };

  const completeMultipartUpload = async (multipartData?: any) => {
    try {
      const dataToUse = multipartData || multipartUploadData;
      if (!dataToUse) {
        // Try fallback single upload instead
        await fallbackSingleUpload();
        return;
      }

      if (uploadedPartsRef.current.length === 0) {
        await fallbackSingleUpload();
        return;
      }

      // Sort parts by PartNumber (read from the ref — uploadedParts state is
      // stale here because chunk uploads run in async callbacks).
      const sortedParts = uploadedPartsRef.current
        .map(part => ({
          PartNumber: part.PartNumber, // Use the actual part number from S3
          ETag: part.ETag
        }))
        .sort((a, b) => a.PartNumber - b.PartNumber);

      const data = await completeMultipartUploadMutation({
        upload_id: dataToUse.upload_id,
        file_key: dataToUse.file_key,
        parts: sortedParts,
        ai_assessment_id: id
      }).unwrap();

      // Clear the chunks after successful upload
      chunksRef.current = [];
      setInterviewVideoChunks([]);

      return data;
    } catch (error: any) {
      console.error('Failed to complete multipart upload:', error);
      await fallbackSingleUpload();
      throw error;
    }
  };

  const fallbackSingleUpload = async (videoBlob?: Blob) => {
    const blobToUpload = videoBlob || (recordedBlob || (interviewVideoChunks.length > 0
      ? new Blob(interviewVideoChunks, { type: 'video/webm' })
      : null));

    if (!blobToUpload) {
      // No video data available — silently skip the fallback upload.
      return;
    }

    // Try S3 presigned URL first
    try {
      const formData = new FormData();
      formData.append('ai_assessment_id', id!);
      formData.append('file_name', 'complete_interview.webm');
      formData.append('file_type', 'video/webm');
      formData.append('use_multipart', 'false');

      const presignData = await getPresignedUrl(formData).unwrap();

      const { url, fields, s3_url } = presignData;
      const s3FormData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        s3FormData.append(key, value as string);
      });
      s3FormData.append('file', blobToUpload, 'complete_interview.webm');

      const uploadResponse = await fetch(url, {
        method: 'POST',
        body: s3FormData
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 upload failed: ${uploadResponse.status}`);
      }

      await uploadVideo({
        ai_assessment_id: id,
        s3_url: s3_url
      }).unwrap();

      chunksRef.current = [];
      setInterviewVideoChunks([]);
    } catch (s3Error) {
      console.warn('S3 upload failed, trying direct upload to backend:', s3Error);

      const directFormData = new FormData();
      directFormData.append('ai_assessment_id', id!);
      directFormData.append('video_file', new File([blobToUpload], 'complete_interview.webm', { type: 'video/webm' }));

      await uploadVideoForm(directFormData).unwrap();

      chunksRef.current = [];
      setInterviewVideoChunks([]);
    }
  };

  const stopVideoRecording = async () => {
    if (interviewMediaRecorder && interviewMediaRecorder.state !== 'inactive') {
      stopRequestedTimeRef.current = recordingTime; // Capture current time
      interviewMediaRecorder.stop();

      // Clear recording timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Block until onstop has flushed the final chunk and every queued part
      // upload has settled. completeMultipartUpload() runs right after this in
      // confirmSubmit — without the wait it would complete the upload while
      // chunks are still in flight, killing the UploadId (NoSuchUpload 500).
      if (recordingFinalizedRef.current) {
        await recordingFinalizedRef.current;
      }
    }
  };

  // ==================== VOICE RECORDING ====================
  const startAudioRecording = async () => {
    try {
      // Cancel any in-flight TTS so the auto-replay doesn't bleed into
      // the mic when the candidate starts answering.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      // Set flag that recording was started for this question
      setRecordingStartedForCurrentQuestion(true);
      setLastRecordedQuestionNumber(currentQuestion + 1);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options = [
        { mimeType: 'audio/wav' },
        { mimeType: 'audio/mp4' },
        { mimeType: 'audio/ogg;codecs=opus' },
        { mimeType: 'audio/webm;codecs=opus' },
        { mimeType: 'audio/webm' },
        {}
      ];

      let selectedOptions = {};
      for (let option of options) {
        if (MediaRecorder.isTypeSupported(option.mimeType || '')) {
          selectedOptions = option;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedOptions);
      setMediaRecorder(recorder);
      setAudioChunks([]);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingDuration(0);
      setIsInEditMode(false);
      setEditTimer(30);
      setQuestionTime(getQuestionTimeLimit());  
      setIsTimerRunning(true); 

      // Clear any existing edit timer
      if (editTimerRef.current) {
        clearInterval(editTimerRef.current);
      }

      // Start recording duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearInterval(timerRef.current!);
        setIsRecording(false);

        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType });

          // Start transcription
          await uploadAudioAndTranscribe(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      recorder.start();

      toast({
        title: 'Recording Started',
        description: 'Recording will automatically stop after 2 minutes.',
        duration: 2000,
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      toast({
        title: 'Recording Error',
        description: 'Failed to access microphone. Please check permissions.',
        variant: 'destructive',
        duration: 3000
      });
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorder) return;

    if (!isPaused) {
      mediaRecorder.pause();
      clearInterval(timerRef.current!);
    } else {
      mediaRecorder.resume();
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    setIsPaused(!isPaused);
  };

  const stopAudioRecording = () => {
    if (mediaRecorder && isRecording) {
      // Stop the 2-minute question timer immediately. The useQuestionTimer
      // hook clears its own interval on the next render when `enabled` flips.
      //setIsTimerRunning(false);

      mediaRecorder.stop();

      toast({
        title: 'Recording Submitted',
        description: 'Transcription in progress...',
        duration: 2000,
        variant: 'success'
      });
    }
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const waitForAssessmentUploads = async () => {
    // We only hard-wait for the *answers* to be persisted — those are what
    // the AI scoring task actually consumes. The interview video is
    // proctoring evidence; scoring does not depend on it. Previously this
    // blocked for a full 5 min on `has_interview_video`, so a broken S3
    // multipart upload (NoSuchUpload) stranded the candidate on this screen
    // for minutes AND delayed the start of report generation. Now we
    // proceed as soon as responses are saved, give the video a short
    // best-effort grace window, and never throw — getting the answers to
    // the BE so scoring can start is the priority.
    // Only a light confirmation that answers landed — not a long poll.
    // 3 checks x 2s = ~6 s max, then proceed regardless.
    const maxAttempts = 3; // hard cap: 3 status checks
    const VIDEO_GRACE_ATTEMPTS = 1; // one extra check to let a chunked video land

    let responsesDoneAt = -1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let statusData: any = null;
      try {
        const statusResp = await checkAiAssessmentStatus(Number(id)).unwrap();
        statusData = statusResp?.data;
      } catch {
        // Status endpoint blipped — count it as an attempt and keep going.
      }

      const responsesDone =
        statusData?.responses_count >= statusData?.expected_questions;

      if (responsesDone) {
        // Answers are persisted — scoring can run. If the video already
        // landed too, return right away; otherwise give it a brief grace
        // window before proceeding without it.
        if (statusData?.has_interview_video) return statusData;
        if (responsesDoneAt < 0) responsesDoneAt = attempt;
        if (attempt - responsesDoneAt >= VIDEO_GRACE_ATTEMPTS) return statusData;
      }

      await wait(2000);
    }

    // Don't block the candidate any longer — proceed to the result screen,
    // which polls for the report on its own.
    return null;
  };

  const moveAfterQueuedTranscription = () => {
    setIsInEditMode(false);
    setEditTimer(30);
    setRecordingStartedForCurrentQuestion(false);
    setAudioChunks([]);
    setRecordingDuration(0);
    setLastRecordedQuestionNumber(null);

    if (currentQuestion < questions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      setQuestionTime(getQuestionTimeLimit(nextIndex));
      setIsTimerRunning(true);
      loadAnswerForQuestion(nextIndex + 1);

      toast({
        title: 'Moving to Next Question',
        description: `Your audio is saved and will be transcribed after submission.`,
        variant: 'success',
        duration: 2500
      });
    } else {
      setShowSubmitModal(true);
    }
  };

  const uploadAudioAndTranscribe = async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      setShowWhisperFailureModal(true);
      setIsTranscribing(false);
      return;
    }

    setIsTranscribing(true);

    try {
      const questionNumber = currentQuestion + 1;
      const formData = new FormData();
      formData.append('ai_assessment_id', id!);
      formData.append('question_number', questionNumber.toString());
      formData.append('audio', audioBlob, `question_${questionNumber}_audio.webm`);

      const data = await uploadAudio(formData).unwrap();

      const failed =
        data?.status === 'error' || data?.status === 'failed' || data?.success === false;

      if (failed) {
        throw new Error(data?.message || 'Audio upload failed');
      }

      // Upload succeeded → the answer is submitted (the BE transcribes the
      // audio after the assessment is submitted, so there's no text to show
      // here). Mark the question submitted and show a confirmation; the
      // candidate can move on or re-record. No auto-advance.
      setAudioSubmittedQuestions((prev) => ({ ...prev, [questionNumber]: true }));
      setRecordingStartedForCurrentQuestion(false);
      setAudioChunks([]);
      setRecordingDuration(0);
      setIsInEditMode(false);
      toast({
        title: 'Answer submitted',
        description: 'Your spoken answer has been saved.',
        variant: 'success',
        duration: 2500,
      });
    } catch (error) {
      console.error('[upload-audio] failed:', error);
      setShowWhisperFailureModal(true);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleWhisperFailureOk = () => {
    setShowWhisperFailureModal(false);
    // Restart the 2-minute timer when user clicks OK
    setQuestionTime(getQuestionTimeLimit());
    setIsTimerRunning(true);

    toast({
      title: 'Timer Restarted',
      description: 'You can try recording your answer again.',
      duration: 2000,
      variant: 'success'
    });
  };

  // ==================== ANSWER MANAGEMENT ====================
  const saveAnswerToBackend = async (questionNumber: number, answerText: string, codeResultOverride?: any) => {
    try {
      const questionData = questions[questionNumber - 1];
      const isCoding = questionData?.type === 'coding';

      if (isCoding) {
        // Prefer a freshly-returned run result (state may not have flushed yet
        // when we auto-save immediately after a Run).
        const results = codeResultOverride?.data ?? codeResults[questionNumber]?.data;
        await saveAiAnswer({
          ai_assessment_id: id,
          question_number: questionNumber,
          question_text: questionData?.text || '',
          question_type: 'coding',
          code_answer: codeAnswers[questionNumber] || '',
          code_language: codeLanguages[questionNumber] || 'python',
          coding_question_id: questionData?.question_id,
          code_execution_results: results?.results || [],
          code_marks_earned: results?.summary?.earned_points || 0,
          code_marks_total: results?.summary?.total_points || 0,
          answer: codeAnswers[questionNumber] || '',
        }).unwrap();
      } else {
        await saveAiAnswer({
          ai_assessment_id: id,
          question_number: questionNumber,
          question_text: questionData?.text || '',
          answer: answerText
        }).unwrap();
      }
      return true;
    } catch (error) {
      console.error('Error saving answer:', error);
      throw error;
    }
  };

  // ==================== CODE EXECUTION ====================
  const handleRunCode = async () => {
    const qNum = currentQuestion + 1;
    const questionData = questions[currentQuestion];
    if (!questionData?.question_id) return;

    setIsRunningCode(true);
    try {
      const resp = await runCode({
        question_id: typeof questionData.question_id === 'string'
          ? parseInt(String(questionData.question_id).replace(/\D/g, ''))  // "core_565" → 565
          : questionData.question_id,
        code: codeAnswers[qNum] || '',        // "source_code" → "code"
        language: codeLanguages[qNum] || 'python',
        assessment_id: id,                    // optional but useful for auto-save
     }).unwrap();

      setCodeResults(prev => ({ ...prev, [qNum]: resp }));
      setLastRunMode(prev => ({ ...prev, [qNum]: 'tests' }));
      toast({ title: 'Tests run', description: `${resp?.data?.summary?.passed_count || 0}/${resp?.data?.summary?.total_cases || 0} test cases passed`, duration: 3000 });

      // Auto-save the code answer right after a run so the candidate never
      // loses work — saving on Run (in addition to Next / time-over) means the
      // latest code + its execution results are always persisted. We read the
      // fresh result from `resp` since setCodeResults hasn't flushed yet.
      try {
        await saveAnswerToBackend(qNum, codeAnswers[qNum] || '', resp);
        setAnswers(prev => ({ ...prev, [qNum]: codeAnswers[qNum] || '' }));
      } catch (saveErr) {
        console.error('Auto-save after run failed:', saveErr);
      }
    } catch (error: any) {
      console.error('Run code error:', error);
      const errMsg = error?.data?.detail || 'Failed to run code';
      setCodeResults(prev => ({ ...prev, [qNum]: { error: errMsg } }));
      setLastRunMode(prev => ({ ...prev, [qNum]: 'tests' }));
      toast({ title: 'Error', description: errMsg, variant: 'destructive', duration: 3000 });
    } finally {
      setIsRunningCode(false);
    }
  };

  // ── "Run Code" — execute independently of the test cases ─────────────────────
  // Sends use_custom_input + stdin so the candidate sees the raw program output
  // for a given input. We surface ONLY the first execution's stdout/stderr (no
  // pass/fail verdict) and deliberately omit assessment_id so the backend does
  // NOT auto-save — a plain run must never mark the question answered or
  // overwrite the saved test results.
  const handleRunPlain = async () => {
    const qNum = currentQuestion + 1;
    const questionData = questions[currentQuestion];
    if (!questionData?.question_id) return;

    const stdin = customInputs[qNum] ?? questionData.sample_input ?? '';
    setIsRunningCode(true);
    try {
      const resp = await runCode({
        question_id: typeof questionData.question_id === 'string'
          ? parseInt(String(questionData.question_id).replace(/\D/g, ''))
          : questionData.question_id,
        code: codeAnswers[qNum] || '',
        language: codeLanguages[qNum] || 'python',
        use_custom_input: true,
        stdin,
        // No assessment_id → backend skips auto-save (independent run).
      }).unwrap();

      const first = resp?.data?.results?.[0];
      setCodePlainResults(prev => ({ ...prev, [qNum]: {
        stdout: first?.stdout ?? '',
        stderr: first?.stderr ?? '',
        compile_output: first?.compile_output ?? '',
        status: first?.status ?? '',
        stdin,
        error: resp?.data?.error || resp?.error,
      } }));
      setLastRunMode(prev => ({ ...prev, [qNum]: 'run' }));
    } catch (error: any) {
      console.error('Run code (plain) error:', error);
      const errMsg = error?.data?.detail || 'Failed to run code';
      setCodePlainResults(prev => ({ ...prev, [qNum]: { error: errMsg } }));
      setLastRunMode(prev => ({ ...prev, [qNum]: 'run' }));
      toast({ title: 'Error', description: errMsg, variant: 'destructive', duration: 3000 });
    } finally {
      setIsRunningCode(false);
    }
  };

  // ── Language switch — preserve each language's buffer, seed starter on first ──
  // visit. Stashes the current code under the old language, then restores the new
  // language's cached buffer or its starter template.
  const handleLanguageChange = (newLang: string) => {
    const qNum = currentQuestion + 1;
    const oldLang = codeLanguages[qNum] || 'python';
    if (newLang === oldLang) return;
    const current = codeAnswers[qNum] ?? '';

    const cached = codeByLang[qNum]?.[newLang];
    const nextCode = cached !== undefined ? cached : getStarterCode(newLang);

    setCodeByLang(prev => ({ ...prev, [qNum]: { ...prev[qNum], [oldLang]: current } }));
    setCodeLanguages(prev => ({ ...prev, [qNum]: newLang }));
    setCodeAnswers(prev => ({ ...prev, [qNum]: nextCode }));
  };

  // Seed starter code the first time a coding question is shown with an empty
  // buffer (a saved/typed answer is always preserved).
  useEffect(() => {
    const q = questions[currentQuestion];
    if (q?.type !== 'coding') return;
    const qNum = currentQuestion + 1;
    setCodeAnswers(prev => {
      if (prev[qNum] !== undefined && prev[qNum] !== '') return prev;
      const lang = codeLanguages[qNum] || 'python';
      return { ...prev, [qNum]: getStarterCode(lang) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, questions]);

  const saveAnswer = async () => {
    const isCoding = questions[currentQuestion]?.type === 'coding';
    const qNum = currentQuestion + 1;
    const hasContent = isCoding ? codeAnswers[qNum]?.trim() : transcribedText.trim();

    if (hasContent) {
      setIsSaving(true);
      try {
        await saveAnswerToBackend(qNum, isCoding ? codeAnswers[qNum] : transcribedText);

        // Update local answers state immediately
        setAnswers(prev => ({
          ...prev,
          [qNum]: isCoding ? codeAnswers[qNum] : transcribedText
        }));

        toast({
          title: 'Answer Saved',
          description: isCoding ? 'Your code has been saved.' : 'Your answer has been saved.',
          variant: 'success',
          duration: 2000
        });

        return true;
      } catch (error) {
        console.error('Save error:', error);
        toast({
          title: 'Save Error',
          description: 'Failed to save answer. Please try again.',
          variant: 'destructive',
          duration: 3000
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    }
    return false;
  };

  const saveAnswerAndContinue = async (moveToNext: boolean = true) => {
    // Clear edit timer if active
    if (editTimerRef.current) {
      clearInterval(editTimerRef.current);
      editTimerRef.current = null;
    }

    // Exit edit mode
    setIsInEditMode(false);

    // Save current answer
    const isCoding = questions[currentQuestion]?.type === 'coding';
    const qNum = currentQuestion + 1;
    const hasContent = isCoding ? codeAnswers[qNum]?.trim() : transcribedText.trim();

    if (hasContent) {
      setIsSaving(true);
      try {
        await saveAnswerToBackend(qNum, isCoding ? codeAnswers[qNum] : transcribedText);

        // Update local answers state
        setAnswers(prev => ({
          ...prev,
          [qNum]: isCoding ? codeAnswers[qNum] : transcribedText
        }));

        toast({
          title: 'Answer Saved',
          description: moveToNext ? 'Moving to next question...' : 'Answer saved successfully',
          variant: 'success',
          duration: 2000
        });

        // If moving to next question
        if (moveToNext) {
          // Reset states for new question
          setRecordingStartedForCurrentQuestion(false);
          setAudioChunks([]);
          setRecordingDuration(0);

          // Move to next question or show submit modal
          if (currentQuestion < questions.length - 1) {
            const nextIndex = currentQuestion + 1;
            setCurrentQuestion(nextIndex);
            setQuestionTime(getQuestionTimeLimit(nextIndex));
            setIsTimerRunning(true);
            loadAnswerForQuestion(nextIndex + 1);
            setLastRecordedQuestionNumber(null);
          } else {
            setShowSubmitModal(true);
          }
        }

        return true;
      } catch (error) {
        console.error('Save error:', error);
        toast({
          title: 'Save Error',
          description: 'Failed to save answer. Please try again.',
          variant: 'destructive',
          duration: 3000
        });
        return false;
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAnswerChange = (text: string) => {
    setTranscribedText(text);
  };

  // ==================== DEVICE TOGGLES ====================
  // Mute/unmute the live mic by flipping the audio tracks' `enabled` flag —
  // the track stays open (so the recorder can still grab it) but stops
  // carrying audio while muted. Muting the mic does NOT affect proctoring,
  // which is video-only.
  const toggleMic = () => {
    if (!cameraStream) {
      toast({ title: 'Microphone unavailable', description: 'No active media stream.', variant: 'destructive', duration: 2000 });
      return;
    }
    if (isRecording) {
      toast({ title: 'Recording in progress', description: 'Stop the recording before muting the mic.', variant: 'destructive', duration: 2500 });
      return;
    }
    const next = !isMicActive;
    cameraStream.getAudioTracks().forEach((t) => { t.enabled = next; });
    setIsMicActive(next);
    toast({ title: next ? 'Microphone on' : 'Microphone muted', variant: next ? 'success' : 'destructive', duration: 1800 });
  };

  // NOTE: `toggleCamera` is defined further down (it fully stops / re-acquires
  // the camera stream). The status-panel Cam button and the CameraTile both
  // call that one — we don't redeclare it here.

  // ==================== QUESTION NAVIGATION ====================
  // ADD THIS EFFECT HERE - After saveAnswer and before handleTimeExpired
  useEffect(() => {
    if (isAssessmentStarted && questions.length > 0) {
      // Load answer for current question whenever it changes
      const currentQuestionNumber = currentQuestion + 1;
      const savedAnswer = answers[currentQuestionNumber] || '';

      // Only update if different to avoid unnecessary re-renders
      if (transcribedText !== savedAnswer) {
        setTranscribedText(savedAnswer);
      }
    }
  }, [currentQuestion, answers, isAssessmentStarted, questions.length]);

  const handleTimeExpired = async () => {
    setIsTimerRunning(false);

    const isCoding = questions[currentQuestion]?.type === 'coding';

    // For coding questions, just save and move on (no voice recording logic)
    if (isCoding) {
      await saveAnswer();
      if (currentQuestion < questions.length - 1) {
        const nextIndex = currentQuestion + 1;
        setCurrentQuestion(nextIndex);
        setQuestionTime(getQuestionTimeLimit(nextIndex));
        setIsTimerRunning(true);
        loadAnswerForQuestion(nextIndex + 1);
        toast({ title: 'Time Expired', description: `Moving to question ${nextIndex + 1}`, variant: 'destructive', duration: 2000 });
      } else {
        // Last question — the 2-min timer ran out, so submit automatically
        // instead of waiting on a manual modal click.
        toast({ title: 'Time Expired', description: 'Submitting your assessment…', variant: 'destructive', duration: 2500 });
        await confirmSubmit();
      }
      return;
    }

    // Check if recording was started for this question
    const wasRecordingStarted = recordingStartedForCurrentQuestion ||
      (lastRecordedQuestionNumber === currentQuestion + 1);

    if (isRecording) {
      // If recording is still active when time expires, stop it and start transcription
      stopAudioRecording();
      toast({
        title: 'Time Expired',
        description: 'Recording stopped. Transcription in progress.',
        variant: 'destructive',
        duration: 3000
      });
    } else if (wasRecordingStarted && audioChunks.length > 0) {
      // If recording was started but not stopped, and we have audio chunks
      toast({
        title: 'Time Expired',
        description: 'Starting 30-second review period.',
        variant: 'destructive',
        duration: 3000
      });
      startEditTimer();
    } else {
      // No recording was done - move immediately to next question

      // Save current answer if any
      if (transcribedText.trim()) {
        await saveAnswer();
      }

      // ✅ IMMEDIATELY move to next question
      if (currentQuestion < questions.length - 1) {
        // Reset states for new question
        setIsInEditMode(false);
        setEditTimer(30);
        setRecordingStartedForCurrentQuestion(false);
        setAudioChunks([]);
        setRecordingDuration(0);

        // Move to next question
        const nextIndex = currentQuestion + 1;
        setCurrentQuestion(nextIndex);
        setQuestionTime(getQuestionTimeLimit(nextIndex));
        setIsTimerRunning(true);

        // Load answer for the new question
        loadAnswerForQuestion(nextIndex + 1);

        setLastRecordedQuestionNumber(null);

        toast({
          title: 'Moving to Next Question',
          description: `Question ${nextIndex + 1} of ${questions.length}`,
          variant: 'success',
          duration: 2000
        });
      } else {
        // Last question — 2-min timer expired, so auto-submit rather than
        // parking the candidate on a manual confirmation modal.
        toast({ title: 'Time Expired', description: 'Submitting your assessment…', variant: 'destructive', duration: 2500 });
        await confirmSubmit();
      }
    }
  };
  // Add this useEffect after the handleTimeExpired function (around line 1170)
  useEffect(() => {
    // This effect monitors when editTimer reaches 0 and triggers autoSaveAndNext
    if (editTimer === 0 && isInEditMode) {
      // Clear the timer if it's still running
      if (editTimerRef.current) {
        clearInterval(editTimerRef.current);
        editTimerRef.current = null;
      }
      // Call autoSaveAndNext after a small delay to ensure state is updated
      setTimeout(() => {
        autoSaveAndNext();
      }, 100);
    }
  }, [editTimer, isInEditMode]);

  const startEditTimer = () => {

    setIsInEditMode(true);
    setEditTimer(30);

    toast({
      title: 'Edit Mode Active',
      description: 'You have 30 seconds to review and edit your answer.',
      duration: 3000,
      variant: 'success'
    });

    // Clear any existing timer first
    if (editTimerRef.current) {
      clearInterval(editTimerRef.current);
    }

    editTimerRef.current = setInterval(() => {
      setEditTimer(prev => {
        if (prev <= 1) {
          // Clear the timer immediately
          if (editTimerRef.current) {
            clearInterval(editTimerRef.current);
            editTimerRef.current = null;
          }
          // Set timer to 0 first
          setEditTimer(0);
          // Call autoSaveAndNext immediately
          autoSaveAndNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const autoSaveAndNext = async () => {

    // Only proceed if we're still in edit mode
    if (!isInEditMode) return;

    // Clear the edit timer first
    if (editTimerRef.current) {
      clearInterval(editTimerRef.current);
      editTimerRef.current = null;
    }

    setIsInEditMode(false);

    try {
      // Save the current answer
      if (transcribedText.trim()) {
        setIsSaving(true);
        await saveAnswerToBackend(currentQuestion + 1, transcribedText);

        // Update local answers state
        setAnswers(prev => ({
          ...prev,
          [currentQuestion + 1]: transcribedText
        }));

        toast({
          title: 'Answer Auto-saved',
          description: 'Moving to next question...',
          variant: 'success',
          duration: 2000
        });
      }

    } catch (error) {
      console.error('Error auto-saving answer:', error);
      toast({
        title: 'Auto-Save Failed',
        description: 'Failed to auto-save answer. Please save manually.',
        variant: 'destructive',
        duration: 3000
      });
      return; // Don't proceed to next question if save fails
    } finally {
      setIsSaving(false);
    }

    // ✅ IMMEDIATELY move to next question after successful save
    // Reset states for new question
    setRecordingStartedForCurrentQuestion(false);
    setAudioChunks([]);
    setRecordingDuration(0);

    // Move to next question or show submit modal
    if (currentQuestion < questions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      setQuestionTime(getQuestionTimeLimit(nextIndex));
      setIsTimerRunning(true);
      loadAnswerForQuestion(nextIndex + 1);
      setLastRecordedQuestionNumber(null);
    } else {
      // Reached the last question via a timed-out review window — submit
      // automatically so the 2-minute-per-question contract holds.
      await confirmSubmit();
    }
  };

  // Update handleNextQuestion to use this function:
  const handleNextQuestion = async () => {
    // Clear edit timer if active
    if (editTimerRef.current) {
      clearInterval(editTimerRef.current);
      editTimerRef.current = null;
    }
    // If in edit mode, use the saveAndContinue function
    if (isInEditMode) {
      await saveAnswerAndContinue(true);
      return;
    }

    // Clear edit timer if active
    if (editTimerRef.current) {
      clearInterval(editTimerRef.current);
    }

    // Save current answer - check if successful
    const saveSuccessful = await saveAnswer();
    const isCoding = questions[currentQuestion]?.type === 'coding';
    const hasContent = isCoding ? codeAnswers[currentQuestion + 1]?.trim() : transcribedText.trim();

    if (!saveSuccessful && hasContent) {
      // If save failed but there's content, show warning
      toast({
        title: 'Save Failed',
        description: 'Could not save answer. Please try again.',
        variant: 'destructive',
        duration: 3000
      });
      return; // Don't proceed to next question
    }

    // Cancel any ongoing recording
    if (isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }

    // Reset states for new question
    setIsInEditMode(false);
    setEditTimer(30);
    setRecordingStartedForCurrentQuestion(false);
    setAudioChunks([]);
    setRecordingDuration(0);

    // Move to next question
    if (currentQuestion < questions.length - 1) {
      const nextIndex = currentQuestion + 1;
      setCurrentQuestion(nextIndex);
      setQuestionTime(getQuestionTimeLimit(nextIndex));
      setIsTimerRunning(true);

      // Reset the textarea before loading any saved answer (defensive — keeps
      // the field blank when there's no prior answer for the new question).
      setTranscribedText('');
      loadAnswerForQuestion(nextIndex + 1);

      setLastRecordedQuestionNumber(null);
    } else {
      setShowSubmitModal(true);
    }
  };

  // ==================== START GATE ====================
  const handlePermissionCheck = async () => {
    if (!policyConsent) {
      setPermissionStatus("Please agree to the policy to continue.");
      return;
    }

    setIsCheckingPermissions(true);
    setPermissionStatus("Requesting camera access...");

    try {
      // Request camera and microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true,
      });

      setCameraStream(stream);
      setIsCameraActive(true);
      setIsMicActive(true);
      setIsProctoringActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Request fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      }

      // Start assessment
      setIsAssessmentStarted(true);
      setShowStartGate(false);
      setPermissionStatus("");

      // Start timers and recording
      setQuestionTime(getQuestionTimeLimit());
      setIsTimerRunning(true);
      await startVideoRecording(stream);

      toast({
        title: "Assessment Started",
        description: "Camera and fullscreen are now active. Stay in fullscreen mode.",
        variant: "success",
        duration: 3000
      });

    } catch (error: any) {
      console.error("Permission check failed:", error);
      setPermissionStatus("Camera and fullscreen permissions are required. Please allow access.");

      toast({
        title: "Permission Required",
        description: "Please allow camera and fullscreen access to continue.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsCheckingPermissions(false);
    }
  };

  // ==================== FULLSCREEN MONITORING ====================
  // Stable callbacks so useFullscreenWatcher's effect doesn't re-attach DOM
  // listeners on every parent render. setState(prev => …) avoids reading the
  // current count from the closure.
  const handleFullscreenExit = useCallback(() => {
    setFullscreenExitCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        toast({
          title: 'Final Warning',
          description: 'Next fullscreen exit will auto-submit your assessment!',
          variant: 'destructive',
          duration: 3000,
        });
      }
      return next;
    });
    setShowFullscreenExitModal(true);
  }, [toast]);
  const handleFullscreenEnter = useCallback(() => {
    setShowFullscreenExitModal(false);
  }, []);
  useFullscreenWatcher({
    isAssessmentStarted,
    isModalOpen: showFullscreenExitModal,
    onExit: handleFullscreenExit,
    onEnter: handleFullscreenEnter,
  });

  // ==================== TAB SWITCH MONITORING ====================
  useEffect(() => {
    if (!isAssessmentStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        toast({
          title: "Tab Switch Detected",
          description: "Stay on this tab to continue the assessment.",
          variant: "destructive",
          duration: 3000
        });
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isAssessmentStarted) {
        e.preventDefault();
        e.returnValue = "Are you sure you want to leave? Your assessment may be auto-submitted.";
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isAssessmentStarted]);

  // ==================== TOTAL ASSESSMENT TIMER ====================
  useEffect(() => {
    if (!isAssessmentStarted) return;

    const totalTimer = setInterval(() => {
      setTotalAssessmentTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(totalTimer);
  }, [isAssessmentStarted]);

  // ==================== STOP CAMERA + PROCTORING ====================
  // Single place to fully shut down capture + proctoring. Called the moment the
  // submit modal opens (so the camera tile goes dark and no more warnings fire)
  // and again from confirmSubmit for the auto-submit path that skips the modal.
  const haltProctoringAndCamera = useCallback(() => {
    proctoringStoppedRef.current = true;

    // Stop the MediaPipe frame loop + clear any pending proctoring timers.
    try { cameraUtilsRef.current?.stop?.(); } catch { /* best effort */ }
    if (proctoringIntervalRef.current) {
      clearInterval(proctoringIntervalRef.current);
      proctoringIntervalRef.current = null;
    }
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
      alertTimeoutRef.current = null;
    }
    setIsProctoringActive(false);
    setShowProctoringAlert(false);
    setCameraBoxAlert(false);

    // Stop the camera/mic tracks so the live tile goes dark. The interview
    // MediaRecorder still flushes its buffered chunks on stop() (handled by
    // the background finalize in confirmSubmit), so this doesn't lose video.
    setCameraStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
    setIsCameraActive(false);
    setIsMicActive(false);
  }, []);

  // Pause proctoring warnings while the submit confirm modal is open (they were
  // still popping over the modal). Keep the camera live so a Cancel can resume
  // cleanly without re-acquiring the stream. The FULL camera+proctoring stop
  // happens on actual submit (confirmSubmit → haltProctoringAndCamera). If the
  // candidate cancels, resume warnings.
  useEffect(() => {
    if (showSubmitModal) {
      proctoringStoppedRef.current = true;
      setShowProctoringAlert(false);
      setCameraBoxAlert(false);
    } else if (isAssessmentStarted && !isSubmitting) {
      // Modal was cancelled (not a submit) — resume proctoring.
      proctoringStoppedRef.current = false;
    }
  }, [showSubmitModal, isAssessmentStarted, isSubmitting]);

  // ==================== SUBMISSION ====================
  const confirmSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Save final answer
      await saveAnswer();

      setIsAssessmentStarted(false);
      if (proctoringIntervalRef.current) {
        clearInterval(proctoringIntervalRef.current);
        proctoringIntervalRef.current = null;
      }

      // Stop audio + camera + proctoring immediately (idempotent — the
      // submit-modal effect usually fired this already, but the time-expired
      // auto-submit path skips the modal, so call it here too).
      if (isRecording) {
        stopAudioRecording();
      }
      haltProctoringAndCamera();

      // Flush any proctoring incidents still buffered so the last few violations
      // aren't lost when capture stops.
      void flushProctorIncidents();

      // Finalize the interview video in the BACKGROUND. It is proctoring
      // evidence only — scoring uses the per-question answers/audio, which are
      // already persisted — so submission must NOT wait on flushing the last
      // video chunks or completing the S3 multipart upload. Previously this
      // awaited the whole finalize AND, on a complete() failure, a full
      // re-upload of the entire video via fallbackSingleUpload, which made
      // submit take minutes. interview_video_url is set at upload init, so the
      // backend submit gate still passes without waiting for this.
      void (async () => {
        try {
          await stopVideoRecording();
          await completeMultipartUpload();
        } catch (e) {
          console.warn('Background video finalize failed (non-blocking):', e);
        }
      })();

      // Submit assessment
      const submitResponse = await submitAiAssessment({
        id: Number(id),
        data: {
          // Add proctoring data to the request body
          proctoring_counts: {
            multiple_faces_count: multipleFaceCount,
            gaze_violation_count: gazeViolationCount,
            no_face_detection_count: noFaceDetectionCount
          }
        }
      }).unwrap();

      toast({
        title: 'Assessment Submitted',
        description: submitResponse?.task_id
          ? 'Your assessment is submitted. Report generation is processing.'
          : 'Your assessment has been submitted successfully.',
        variant: 'success',
        duration: 3000
      });

      // Exit fullscreen only after successful submission
      await exitFullscreenSafely();

      setShowSubmitModal(false);
      navigate(`/candidate/ai-assessment/${id}/result`);
    } catch (error: any) {
      console.error('Error submitting assessment:', error);

      // Check if it's just a video upload error
      if (error.message?.includes('upload') || error.message?.includes('video')) {
        toast({
          title: 'Video Upload Error',
          description: 'Assessment submitted but video upload failed. Your answers have been saved.',
          variant: 'warning',
          duration: 4000
        });
        // Exit fullscreen when we are proceeding to results despite upload issues
        await exitFullscreenSafely();
        setShowSubmitModal(false);
        navigate(`/candidate/ai-assessment/${id}/result`);
      } else {
        toast({
          title: 'Submission Error',
          description: 'Failed to submit assessment. Please try again.',
          variant: 'destructive',
          duration: 3000
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleSubmit = async () => {
    // Stop the 2-minute question timer. useQuestionTimer self-clears on next
    // render via the `enabled` gate.
    setIsTimerRunning(false);

    // If recording is active, stop it to trigger transcription
    if (isRecording && mediaRecorder) {
      stopAudioRecording();

      // Show a message that transcription will start
      toast({
        title: 'Recording Submitted',
        description: 'Transcription in progress. You will have 30 seconds to review.',
        duration: 3000,
        variant: 'success'
      });

      // Set flag that submission was triggered
      setRecordingStartedForCurrentQuestion(true);
      setLastRecordedQuestionNumber(currentQuestion + 1);
    }
    // If we have recorded audio but not transcribed yet
    else if (audioChunks.length > 0 && !isInEditMode) {
      // Create audio blob and trigger transcription
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder?.mimeType });
      await uploadAudioAndTranscribe(audioBlob);
    }
    // If we're already in edit mode or have text, save and show submit modal
    else if (transcribedText.trim() || isInEditMode) {
      // Save current answer
      await saveAnswer();

      // Show submit modal
      setShowSubmitModal(true);
    }
    // No answer provided
    else {
      toast({
        title: 'No Answer',
        description: 'Please provide an answer before submitting.',
        variant: 'destructive',
        duration: 3000
      });
    }
  };

  // ==================== UTILITY FUNCTIONS ====================
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatQuestionTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Resolve the best female-sounding English voice from whatever the
  // browser exposes. Order:
  //   1. Exact known-good names (Google UK English Female, Zira, etc.)
  //   2. Any voice whose name explicitly contains "female"
  //   3. Heuristic by common female voice name fragments
  //   4. Any English voice as last fallback
  const pickFemaleVoice = (): SpeechSynthesisVoice | null => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null
    const voices = window.speechSynthesis.getVoices()
    if (!voices.length) return null
    const exact = [
      "Google UK English Female",
      "Microsoft Zira - English (United States)",
      "Microsoft Zira Desktop",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny Online (Natural) - English (United States)",
      "Samantha",
      "Karen",
      "Tessa",
      "Victoria",
      "Allison",
      "Susan",
      "Ava",
    ]
    let v: SpeechSynthesisVoice | undefined = voices.find((vv) => exact.includes(vv.name))
    if (!v) v = voices.find((vv) => /female/i.test(vv.name) && /^en/i.test(vv.lang))
    if (!v) {
      const hints = ["Zira", "Aria", "Jenny", "Samantha", "Karen", "Victoria", "Allison", "Tessa", "Susan", "Ava", "Joanna", "Salli", "Kimberly"]
      v = voices.find((vv) => hints.some((h) => vv.name.includes(h)) && /^en/i.test(vv.lang))
    }
    if (!v) v = voices.find((vv) => /^en/i.test(vv.lang))
    return v ?? null
  }

  const speakQuestion = async () => {
    const questionText = questions[currentQuestion]?.text || ''
    if (!('speechSynthesis' in window) || !questionText) return
    speechSynthesis.cancel()
    // Strip HTML tags before speaking — questions can be rendered HTML.
    const plain = questionText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    const utterance = new SpeechSynthesisUtterance(plain)
    utterance.rate = 0.95
    utterance.pitch = 1.05
    utterance.volume = 0.95
    const female = pickFemaleVoice()
    if (female) {
      utterance.voice = female
      utterance.lang = female.lang
    }
    speechSynthesis.speak(utterance)
  }

  // Voice list is empty until `voiceschanged` fires on some browsers
  // (Chrome especially) — trigger one early load + listen for updates so
  // pickFemaleVoice() returns a real voice on the very first auto-replay.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.getVoices()
    const handler = () => window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener("voiceschanged", handler)
    return () => window.speechSynthesis.removeEventListener("voiceschanged", handler)
  }, [])

  // Auto-replay the current question through TTS whenever the candidate
  // moves to a new question (or when the questions list first arrives).
  // Small delay so the question card paints first; recording in-flight
  // is left alone to avoid mic interference.
  useEffect(() => {
    if (!isAssessmentStarted) return
    const q = questions[currentQuestion]
    if (!q?.text || q.type === "coding") return
    if (isRecording || isTranscribing) return
    const t = window.setTimeout(() => {
      try { speakQuestion() } catch { /* TTS unavailable */ }
    }, 600)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion, questions.length, isAssessmentStarted])

  const toggleCamera = async () => {
    if (isCameraActive && cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
      setIsCameraActive(false);
      setIsProctoringActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });
        setCameraStream(stream);
        setIsCameraActive(true);
        setIsProctoringActive(true);
        setCameraError('');
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err: any) {
        setCameraError(err.message || 'Unable to access camera');
        setIsCameraActive(false);
        setIsProctoringActive(false);
      }
    }
  };

  const handleContinueInFullScreen = async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      }
      setShowFullscreenExitModal(false);
    } catch (error) {
      console.error("Failed to return to fullscreen:", error);
    }
  };

  // Safely exit fullscreen across browsers
  const exitFullscreenSafely = async () => {
    const docAny = document as any;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (docAny.webkitFullscreenElement && docAny.webkitExitFullscreen) {
        await docAny.webkitExitFullscreen();
      } else if (docAny.mozFullScreenElement && docAny.mozCancelFullScreen) {
        await docAny.mozCancelFullScreen();
      } else if (docAny.msFullscreenElement && docAny.msExitFullscreen) {
        await docAny.msExitFullscreen();
      }
    } catch (err) {
      console.error("Error exiting fullscreen:", err);
    }
  };

  const handleAutoSubmit = async () => {
    setShowFullscreenExitModal(false);
    await confirmSubmit();
  };

  // ==================== DERIVED VALUES (memoized) ====================
  // Build the answered-question set from the answers map only when the map
  // changes. Without this, a fresh Set is allocated every render and breaks
  // referential equality for <QuestionProgress/> props.
  // Only count questions that actually have a non-empty answer. fetchAssessmentData
  // seeds `answers` from the BE responses with `answer_text || ''`, so unanswered
  // questions land here as empty strings — counting raw Object.keys inflated the
  // "answered" tally (and lit up progress segments) for questions the candidate
  // never answered. Match the `.trim()` test used by allQuestionsAnswered.
  const answeredSet = useMemo(
    () => {
      const s = new Set<number>();
      // Text/code answers with content.
      Object.entries(answers).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim().length > 0) s.add(Number(k) - 1);
      });
      // Voice answers that have been recorded + uploaded (submitted).
      Object.keys(audioSubmittedQuestions).forEach((k) => {
        if (audioSubmittedQuestions[Number(k)]) s.add(Number(k) - 1);
      });
      return s;
    },
    [answers, audioSubmittedQuestions],
  );

  // Every question has an answer (typed/code text OR a submitted voice answer).
  // When true on the last question, the action row collapses to a single
  // "Submit interview" CTA and skips the redundant "Save answer" step.
  const allQuestionsAnswered = useMemo(
    () =>
      questions.length > 0 &&
      questions.every((_, i) => !!answers[i + 1]?.trim() || !!audioSubmittedQuestions[i + 1]),
    [questions, answers, audioSubmittedQuestions],
  );

  // Subtitle is derived from two assessment fields; recompute only when they
  // load/change instead of on every render.
  const progressSubtitle = useMemo(
    () =>
      [
        assessmentData?.role_type?.replace('_', ' '),
        assessmentData?.experience_level?.replace('_', ' '),
      ]
        .filter(Boolean)
        .join(' · '),
    [assessmentData?.role_type, assessmentData?.experience_level],
  );

  // Stable callbacks for the exit ConfirmationDialog. Without useCallback both
  // closures get a fresh identity each render, which would invalidate any
  // future React.memo on the dialog.
  const handleExitDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setShowExitConfirm(false);
  }, []);
  const handleExitConfirmed = useCallback(async () => {
    setShowExitConfirm(false);
    await exitFullscreenSafely();
    navigate('/candidate/dashboard');
  }, [navigate]);

  // Stable callbacks for the modal children — each becomes a stable identity
  // so the memoized modal subcomponents don't re-render on parent ticks.
  const handleSubmitModalCancel = useCallback(() => setShowSubmitModal(false), []);

  // Prefetch the lazy CodingWorkspace chunk in the background as soon as we know
  // the assessment includes at least one coding question. Keeps the UX
  // identical to the pre-Phase-3 eager import — the chunk is in cache long
  // before the candidate ever reaches a coding question.
  useEffect(() => {
    if (questions.some((q) => q.type === 'coding')) {
      // Fire-and-forget — failure is fine, the Suspense boundary will load on
      // demand instead.
      void import('./CodingWorkspace');
    }
  }, [questions]);

  // ==================== RENDERING ====================
  if (loading && prepTimedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center space-y-5 max-w-sm mx-auto p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">Still preparing your questions</h2>
            <p className="text-sm text-gray-500">
              Generation is taking longer than usual. Your assessment isn't lost — tap below to check again.
            </p>
            <p className="text-[11px] tabular-nums text-gray-400">
              Waited {Math.floor(pollingElapsedSec / 60)}:{String(pollingElapsedSec % 60).padStart(2, '0')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPrepRetryNonce((n) => n + 1)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
          >
            <Loader2 className="h-4 w-4" />
            Check again
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-6 max-w-sm mx-auto p-8">
          {/* Pulsing AI icon */}
          <div className="relative inline-flex">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
            </span>
          </div>

          {/* Message + live elapsed counter */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">
              {!questionsReady ? 'Preparing Your Interview' : 'Almost Ready...'}
            </h2>
            <p className="text-gray-500 text-sm">{pollingMessage}</p>
            <p className="text-[11px] text-gray-400 tabular-nums">
              Elapsed: {Math.floor(pollingElapsedSec / 60)}:{String(pollingElapsedSec % 60).padStart(2, '0')}
            </p>
          </div>

          {/* Animated shimmer progress — caps at 90% so it never claims
              "done" before the BE actually returns. Curve is exponential
              so the bar leaps forward early and slows down, matching the
              candidate's expectation that "the first few seconds matter
              most". */}
          <div className="mx-auto w-56 h-1.5 rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 transition-all duration-500 ease-out"
              style={{
                width: `${Math.min(92, Math.round(92 * (1 - Math.exp(-pollingElapsedSec / 45))))}%`,
              }}
            />
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>

          <p className="text-xs text-gray-400">
            {pollingElapsedSec < 10
              ? 'This usually takes just a few seconds'
              : pollingElapsedSec < 30
                ? 'Tailoring questions to your role — almost there'
                : pollingElapsedSec < 90
                  ? 'Generating your questions — this can take a minute or two'
                  : 'Almost there — finalising your tailored questions…'}
          </p>
        </div>
      </div>
    );
  }


  if (!assessmentData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-500" />
        <span className="ml-2">Assessment not found</span>
      </div>
    );
  }

  // Coding questions swap the stacked Question/Answer cards for a split-pane
  // IDE (CodingWorkspace) and collapse the camera sidebar to reclaim width.
  const isCoding = questions[currentQuestion]?.type === 'coding';

  // Action row — shared by the text Answer Card and the coding workspace so the
  // Skip/Next/Submit logic lives in exactly one place. mt-auto pins it to the
  // bottom of whichever flex column owns it.
  const footerActions = (
    <div className="mt-auto border-t border-slate-200/70 pt-4">
      {/* When every question has a saved answer, collapse the row
          to a single full-width Submit CTA — no redundant "Save
          answer" or per-question revalidation needed. */}
      {allQuestionsAnswered && currentQuestion === questions.length - 1 ? (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
            <CheckCircle className="h-3 w-3" />
            All {questions.length} answers saved
          </div>
          <button
            type="button"
            // Open the confirm modal directly. Going through
            // handleSubmit here wrongly fired a "No Answer" warning
            // for voice answers (transcribedText/audioChunks are
            // empty once the audio is uploaded) even though every
            // question was already submitted.
            onClick={() => setShowSubmitModal(true)}
            disabled={isRecording || isTranscribing || isSaving || isRunningCode}
            className="group relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-500 to-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(16,185,129,0.6)] ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(16,185,129,0.7)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_28px_-6px_rgba(16,185,129,0.3)]"
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
            <Send className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span className="relative">Submit interview</span>
          </button>
        </div>
      ) : (
        // Manual "Save answer" removed — answers auto-save on Next,
        // on time-over, and (for coding) right after Run.
        <div className="flex flex-wrap items-center justify-end gap-3">
          {currentQuestion < questions.length - 1 ? (
            <button
              type="button"
              onClick={handleNextQuestion}
              // Skipping is allowed — the candidate can move on
              // without answering. Only block while a recording /
              // transcription / save is mid-flight, otherwise we'd
              // navigate away from an in-progress capture.
              disabled={isRecording || isTranscribing || isSaving || isRunningCode}
              title={(questions[currentQuestion]?.type === 'coding'
                ? !codeAnswers[currentQuestion + 1]?.trim()
                : !(transcribedText.trim() || audioSubmittedQuestions[currentQuestion + 1])) ? 'Skip this question and move on' : undefined}
              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_22px_-6px_rgba(124,58,237,0.3)]"
            >
              {(questions[currentQuestion]?.type === 'coding'
                ? !codeAnswers[currentQuestion + 1]?.trim()
                : !(transcribedText.trim() || audioSubmittedQuestions[currentQuestion + 1])) ? 'Skip question' : 'Next question'}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              // Open the confirm modal directly so the last question
              // can be submitted even if it's left unanswered. The
              // confirm flow (confirmSubmit) saves any current answer
              // before submitting.
              onClick={() => setShowSubmitModal(true)}
              disabled={isRecording || isTranscribing || isSaving || isRunningCode}
              className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500 via-emerald-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_-6px_rgba(16,185,129,0.6)] ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-6px_rgba(16,185,129,0.7)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_10px_28px_-6px_rgba(16,185,129,0.3)]"
            >
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
              <Send className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span className="relative">Submit interview</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative h-screen overflow-hidden text-slate-900 bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(124,58,237,0.10)_0%,rgba(124,58,237,0)_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]">
      {/* Decorative aurora orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] overflow-hidden">
        <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-violet/15 blur-3xl" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-brand-purple/15 blur-3xl" />
      </div>
      {/* Start Gate Modal */}
      <StartGateModal
        open={showStartGate}
        enableCamera={assessmentData?.enable_camera}
        enableVoiceRecording={assessmentData?.enable_voice_recording}
        policyConsent={policyConsent}
        isCheckingPermissions={isCheckingPermissions}
        permissionStatus={permissionStatus}
        onPolicyChange={setPolicyConsent}
        onCheckPermissions={handlePermissionCheck}
      />

      {/* Fullscreen Exit Modal */}
      <FullscreenExitModal
        open={showFullscreenExitModal}
        exitCount={fullscreenExitCount}
        onContinue={handleContinueInFullScreen}
        onAutoSubmit={handleAutoSubmit}
      />

      {/* Whisper Failure Modal */}
      <WhisperFailureModal
        open={showWhisperFailureModal}
        onAcknowledge={handleWhisperFailureOk}
      />

      {/* Submit Confirmation Modal */}
      <SubmitConfirmModal
        open={showSubmitModal}
        isSubmitting={isSubmitting}
        onCancel={handleSubmitModalCancel}
        onConfirm={confirmSubmit}
      />

      {/* Proctoring Warning Popup — title + message change per movement type
          (no face / multiple faces / looking away) so the candidate sees
          exactly which proctoring rule was triggered. */}
      {showProctoringAlert && (multipleFaceCount > 0 || gazeViolationCount > 0 || noFaceDetectionCount > 0) && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-40 max-w-xs">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-lg leading-none">
              {proctoringAlert?.type === 'multiple_faces'
                ? '👥'
                : proctoringAlert?.type === 'gaze'
                ? '👁️'
                : proctoringAlert?.type === 'no_face'
                ? '🙅'
                : null}
              {!proctoringAlert && <AlertTriangle className="w-4 h-4" />}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm">
                {proctoringAlert?.title ?? 'Proctoring Alert'}
              </span>
              {proctoringAlert?.message && (
                <span className="text-xs text-white/90">{proctoringAlert.message}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exit confirmation modal */}
      {isAssessmentStarted && (
        <ConfirmationDialog
          open={showExitConfirm}
          title="Exit the interview?"
          description="Your progress so far will be saved as incomplete. You can restart from your dashboard."
          confirmText="Exit interview"
          cancelText="Stay"
          confirmTone="danger"
          onOpenChange={handleExitDialogOpenChange}
          onConfirm={handleExitConfirmed}
        />
      )}

      {/* Logo watermark — subtle, decorative, behind content */}
      {isAssessmentStarted && (
        <div aria-hidden className="pointer-events-none absolute right-8 bottom-8 z-0 flex items-center gap-2 opacity-[0.07]">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white">
            <img src="/SkilTechyFavicon.png" alt="" className="h-6 w-6" />
          </span>
          <span className="text-xl font-bold tracking-tight text-brand-purple">SkilTechy</span>
        </div>
      )}

      {/* Floating top-right cluster — candidate identity + timer + pause + exit */}
      {isAssessmentStarted && (
        <div className="pointer-events-auto absolute right-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2 sm:right-5 sm:top-4">
          {/* Candidate identity chip */}
          <div className="hidden items-center gap-2 rounded-full border border-slate-200/60 bg-white/75 py-1 pl-1 pr-3 shadow-[0_8px_24px_-12px_rgba(61,7,95,0.30)] backdrop-blur-xl backdrop-saturate-150 sm:inline-flex">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-[11px] font-bold text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20">
              {candidateInitial}
              <span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
            </span>
            <span className="max-w-[140px] truncate text-xs font-semibold text-slate-700">{candidateName}</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-violet ring-1 ring-inset ring-violet-200/80">
              Premium
            </span>
          </div>

          {/* Finish early — always available so the candidate can submit
              mid-assessment, leaving the remaining questions unanswered. The
              confirm modal (SubmitConfirmModal → confirmSubmit) handles saving
              the current answer and the actual submission. */}
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            disabled={isRecording || isTranscribing || isSaving || isRunningCode}
            title="Submit the assessment now"
            className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_22px_-8px_rgba(16,185,129,0.6)] ring-1 ring-white/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-8px_rgba(16,185,129,0.7)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Send className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            Finish &amp; submit
          </button>

          {/* Timer + actions */}
          <div className="relative inline-flex items-center gap-2 rounded-full border border-slate-200/60 bg-white/75 px-3.5 py-1.5 shadow-[0_10px_30px_-12px_rgba(61,7,95,0.35),0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur-xl backdrop-saturate-150">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-bold tabular-nums text-slate-900">
              {formatQuestionTime(totalAssessmentTime)}
            </span>
            <span aria-hidden className="mx-1 h-4 w-px bg-slate-200/80" />
            <button
              type="button"
              onClick={() => setIsTimerRunning((v) => !v)}
              title={!isTimerRunning ? "Resume" : "Pause"}
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-violet-50/80 hover:text-brand-violet hover:shadow-[0_4px_14px_-4px_rgba(124,58,237,0.4)]"
            >
              {!isTimerRunning ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowExitConfirm(true)}
              title="Exit interview"
              className="group inline-flex h-7 w-7 items-center justify-center rounded-full text-rose-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-50 hover:shadow-[0_4px_14px_-4px_rgba(244,63,94,0.4)]"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container — left panel (camera + status + devices) | right panel (progress + Q + A) */}
      <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-row gap-3 overflow-hidden px-3 pb-3 pt-16 sm:gap-4 sm:px-5 sm:pb-4 sm:pt-20">

        {/* LEFT PANEL — collapses to a compact tile on coding questions so the
            split-pane IDE gets the reclaimed width. Candidates can still expand
            the camera via the size control; proctoring stays active regardless. */}
        <aside className={cn("hidden shrink-0 flex-col gap-3 md:flex", isCoding ? 'md:w-44' : cameraSize === 'sm' ? 'md:w-56' : cameraSize === 'lg' ? 'md:w-80' : 'md:w-64')}>
          {/* Camera tile */}
          {assessmentData.enable_camera && (
            <CameraTile
              ref={videoRef}
              isCameraActive={isCameraActive}
              cameraError={cameraError}
              cameraBoxAlert={cameraBoxAlert}
              isProctoringActive={isProctoringActive}
              cameraSize={cameraSize}
              onCameraSizeChange={setCameraSize}
              // Toggle the live camera on/off. Proctoring is paused while the
              // camera is off (see the guard in onFaceDetection).
              onToggleCamera={toggleCamera}
            />
          )}

          {/* Status + device controls */}
          <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_30px_-18px_rgba(61,7,95,0.22)] backdrop-blur-xl">
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-violet">
              <span className="h-1 w-5 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet" />
              Status &amp; devices
            </h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between rounded-lg bg-slate-50/70 px-2.5 py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative h-2 w-2 rounded-full bg-rose-500">
                    {isTimerRunning && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500 opacity-60" />}
                  </span>
                  <span className="font-medium text-slate-700">{isTimerRunning ? 'Recording' : 'Paused'}</span>
                </span>
                {(multipleFaceCount + gazeViolationCount + noFaceDetectionCount) > 0 && (
                  <span className="inline-flex items-center gap-1 text-rose-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="font-semibold">{multipleFaceCount + gazeViolationCount + noFaceDetectionCount}</span>
                  </span>
                )}
              </div>

              {/* Mic + Cam are read-only status indicators now — turning either
                  off mid-interview would compromise proctoring, so they're
                  no-op divs with a passive emerald dot when active. Replay
                  stays as a button because it's safe to re-trigger TTS. */}
              <div className="grid grid-cols-3 gap-1 pt-1">
                <button
                  type="button"
                  onClick={toggleMic}
                  title={isMicActive ? "Mute microphone" : "Unmute microphone"}
                  className={cn(
                    "inline-flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5",
                    isMicActive ? "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300" : "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300",
                  )}
                >
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                    {isMicActive ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    {isMicActive && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                    )}
                  </span>
                  Mic
                </button>
                <button
                  type="button"
                  onClick={toggleCamera}
                  title={isCameraActive ? "Turn camera off" : "Turn camera on"}
                  className={cn(
                    "inline-flex flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5",
                    isCameraActive ? "border-emerald-200 bg-emerald-50/70 text-emerald-700 hover:border-emerald-300" : "border-rose-200 bg-rose-50 text-rose-600 hover:border-rose-300",
                  )}
                >
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                    {isCameraActive ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                    {isCameraActive && (
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                    )}
                  </span>
                  Cam
                </button>
                <button
                  type="button"
                  onClick={speakQuestion}
                  title="Replay question audio"
                  className="group inline-flex flex-col items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Replay
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT PANEL */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Proctoring Alerts Badge */}
          {candidateAssessment && candidateAssessment.total_proctor_warnings > 0 && (
            <div className="flex items-center gap-2 text-xs text-rose-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{candidateAssessment.total_proctor_warnings} proctor warnings</span>
            </div>
          )}

        <QuestionProgress
          current={currentQuestion}
          total={questions.length}
          answered={answeredSet}
          subtitle={progressSubtitle}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {/* Question + Answer column (single column, single screen) */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
            {isCoding ? (
              /* ========== CODING QUESTION — split-pane IDE ========== */
              <>
                <Suspense fallback={<div className="min-h-0 flex-1 rounded-2xl border border-slate-200/60 bg-white/85" />}>
                  <CodingWorkspace
                    questionText={questions[currentQuestion]?.text || 'No question available.'}
                    sampleInput={questions[currentQuestion]?.sample_input}
                    sampleOutput={questions[currentQuestion]?.sample_output}
                    marks={questions[currentQuestion]?.marks}
                    questionNumber={currentQuestion + 1}
                    timeLabel={formatQuestionTime(questionTime)}
                    saved={!!answers[currentQuestion + 1]}
                    value={codeAnswers[currentQuestion + 1] || ''}
                    onChange={(value) => setCodeAnswers(prev => ({ ...prev, [currentQuestion + 1]: value }))}
                    language={codeLanguages[currentQuestion + 1] || 'python'}
                    // Switching language swaps in that language's starter (or its
                    // cached buffer) without losing the current language's work.
                    onLanguageChange={handleLanguageChange}
                    // Run Tests → all test cases + verdict + auto-save.
                    // Run Code  → independent run against custom stdin, output only.
                    onRun={handleRunCode}
                    onRunPlain={handleRunPlain}
                    isRunning={isRunningCode}
                    editorTheme={codeEditorTheme}
                    onEditorThemeChange={setCodeEditorTheme}
                    isFullscreen={isCodeEditorFullscreen}
                    onToggleFullscreen={() => setIsCodeEditorFullscreen(f => !f)}
                    result={codeResults[currentQuestion + 1]}
                    mode={lastRunMode[currentQuestion + 1] || 'tests'}
                    plainResult={codePlainResults[currentQuestion + 1]}
                    customInput={customInputs[currentQuestion + 1] ?? (questions[currentQuestion]?.sample_input || '')}
                    onCustomInputChange={(v) => setCustomInputs(prev => ({ ...prev, [currentQuestion + 1]: v }))}
                  />
                </Suspense>
                {footerActions}
              </>
            ) : (
            <>
            {/* Previous answer review — appears from Q2 onward, gives the
                candidate a quick confirmation that the last answer landed and
                lets them peek at what they submitted. */}
            {currentQuestion > 0 && answers[currentQuestion] && (
              <details className="group/prev relative shrink-0 overflow-hidden rounded-xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/70 to-white/85 px-4 py-2 backdrop-blur-xl">
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.45)] ring-1 ring-white/20">
                    <CheckCircle className="h-3 w-3" />
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700 whitespace-nowrap">
                    Q{currentQuestion} answered
                  </span>
                  <span className="min-w-0 truncate text-[11px] text-slate-500">
                    — {answers[currentQuestion]}
                  </span>
                  <span aria-hidden className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-emerald-700 transition-transform duration-200 group-open/prev:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-2 rounded-lg bg-white/70 p-2.5 text-[12px] leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {answers[currentQuestion]}
                </div>
              </details>
            )}

            {/* Question Card — overflow-y-auto (not hidden) so a long prompt or
                a coding question's sample input/output scrolls into view inside
                the 30vh cap instead of being clipped. */}
            <div className="group relative max-h-[30vh] shrink-0 overflow-y-auto rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(61,7,95,0.32)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_30px_60px_-28px_rgba(61,7,95,0.40)] sm:p-5">
              {/* Decorative gradient orb (top-right corner) */}
              <span aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-brand-violet/12 to-brand-purple/0 blur-3xl" />
              {/* Top thin gradient hairline */}
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />

              <div className="relative mb-5 flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-slate-100 to-slate-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600 ring-1 ring-inset ring-slate-200">
                    Q{currentQuestion + 1}
                  </span>
                  {questions[currentQuestion]?.type === 'coding' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-indigo-700 ring-1 ring-inset ring-indigo-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                      <Code2 className="w-3 h-3" /> Coding
                    </span>
                  )}
                  {questions[currentQuestion]?.marks && (
                    <span className="inline-flex items-center rounded-full bg-gradient-to-br from-violet-50 to-violet-100/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-brand-violet ring-1 ring-inset ring-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                      {questions[currentQuestion].marks} pts
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-rose-50 to-rose-100/70 px-3 py-1.5 text-xs font-bold tabular-nums text-rose-600 ring-1 ring-inset ring-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    <Clock className="w-3.5 h-3.5" />
                    {formatQuestionTime(questionTime)}
                  </span>
                </div>
              </div>

              <div
                className="prose prose-slate relative max-w-none text-[15px] leading-[1.7] text-slate-800 sm:text-base"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(questions[currentQuestion]?.text || 'No question available.'),
                }}
              />

              {/* Sample I/O for coding questions */}
              {questions[currentQuestion]?.type === 'coding' && (questions[currentQuestion]?.sample_input || questions[currentQuestion]?.sample_output) && (
                <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {questions[currentQuestion]?.sample_input && (
                    <div className="group/io rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3.5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        <span className="h-1 w-1 rounded-full bg-indigo-500" />
                        Sample input
                      </p>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{questions[currentQuestion].sample_input}</pre>
                    </div>
                  )}
                  {questions[currentQuestion]?.sample_output && (
                    <div className="group/io rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3.5 shadow-sm transition-shadow duration-200 hover:shadow-md">
                      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">
                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                        Sample output
                      </p>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">{questions[currentQuestion].sample_output}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Answer Card */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_44px_-24px_rgba(61,7,95,0.30)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_30px_60px_-28px_rgba(61,7,95,0.38)] sm:p-5">
              <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/25 to-transparent" />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-violet">
                  <span className="h-1 w-6 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet" />
                  Your answer
                </h3>
                {answers[currentQuestion + 1] && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                    <CheckCircle className="w-3 h-3" /> Saved
                  </span>
                )}
              </div>

                {/* ========== TEXT / VOICE QUESTION UI ==========
                    Only non-coding questions reach this Answer Card now — coding
                    questions render the split-pane CodingWorkspace above. Centered
                    in the free vertical space so the recorder sits in the middle
                    of the card instead of clinging to the top. */}
                  <div className="flex min-h-0 flex-1 flex-col justify-center">
                    {/* Voice recording controls — premium animated experience.
                        Used to be gated behind `assessmentData.enable_voice_recording`,
                        which meant assessments that didn't opt-in had no recorder
                        at all — candidates lost the speak-your-answer affordance
                        completely. Keep the mic always available for text
                        questions; candidates can still type instead. */}
                    {true && (
                      <div className="mb-4 relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_36px_-22px_rgba(61,7,95,0.22)] backdrop-blur-xl">
                        <span aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-violet/12 blur-2xl" />
                        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent" />

                        {/* Edit mode banner */}
                        {isInEditMode && (
                          <div className="relative mb-3 flex items-center justify-between gap-3 rounded-xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50 to-indigo-100/70 px-3 py-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-[0_4px_12px_-2px_rgba(99,102,241,0.45)] ring-1 ring-white/20">
                                <Clock className="h-3 w-3" />
                              </span>
                              <span className="text-xs font-bold tracking-tight text-indigo-800">Edit mode</span>
                              <span className="text-[10px] text-indigo-600">— auto-save in</span>
                            </div>
                            <span className="font-mono text-sm font-bold tabular-nums text-indigo-700">
                              {formatQuestionTime(editTimer)}
                            </span>
                          </div>
                        )}

                        {/* IDLE — premium Start Recording CTA. Hidden once the
                            answer has been submitted (the confirmation block
                            below takes over) and while transcribing, so the mic
                            button never flickers back after a recording. */}
                        {!isRecording && !isInEditMode && !isTranscribing && !audioSubmittedQuestions[currentQuestion + 1] && (
                          <div className="relative flex flex-col items-center py-3">
                            <button
                              type="button"
                              onClick={startAudioRecording}
                              disabled={isTranscribing}
                              className="group relative inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Start recording"
                            >
                              {/* Radar ping rings — fire constantly so the button always invites interaction */}
                              <span aria-hidden className="absolute inset-0 -m-1 rounded-full bg-brand-violet/15 animate-ping" style={{ animationDuration: '2.2s' }} />
                              <span aria-hidden className="absolute inset-0 -m-3 rounded-full bg-brand-violet/10 animate-ping" style={{ animationDuration: '2.2s', animationDelay: '0.4s' }} />
                              {/* Active state — instant scale-up on press */}
                              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_10px_28px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/20 transition-all duration-150 group-hover:scale-110 group-hover:shadow-[0_14px_34px_-6px_rgba(124,58,237,0.7)] group-active:scale-95">
                                <Mic className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" />
                                <span aria-hidden className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/0 via-white/25 to-white/0" />
                              </span>
                            </button>
                            <p className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-brand-violet">
                              Tap to start recording
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              Up to 2 minutes · transcribed automatically
                            </p>
                          </div>
                        )}

                        {/* RECORDING — animated waveform + controls */}
                        {isRecording && (
                          <div className="relative space-y-3">
                            {/* Status row */}
                            <div className="flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/95 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white ring-1 ring-inset ring-white/30">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-80" />
                                  <span className="relative h-full w-full rounded-full bg-white" />
                                </span>
                                {isPaused ? 'Paused' : 'Recording'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100/70 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 ring-1 ring-inset ring-slate-200">
                                <Clock className="h-3 w-3 text-slate-500" />
                                {formatRecordingTime(recordingDuration)} / 2:00
                              </span>
                            </div>

                            {/* Live audio-reactive waveform — bars track the
                                candidate's real voice level via an AnalyserNode
                                wired to the recorder's stream. */}
                            <VoiceWaveform stream={mediaRecorder?.stream ?? null} paused={isPaused} />

                            {/* Progress bar — brand gradient with smooth tween */}
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-brand-purple via-brand-violet to-brand-purple shadow-[0_0_8px_rgba(124,58,237,0.4)] transition-all duration-500 ease-out"
                                style={{ width: `${(recordingDuration / 120) * 100}%` }}
                              />
                            </div>

                            {/* Action row */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={togglePauseRecording}
                                className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-md active:translate-y-0"
                              >
                                {isPaused ? (
                                  <><Volume2 className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" /> Resume</>
                                ) : (
                                  <><Pause className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" /> Pause</>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={stopAudioRecording}
                                className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_-6px_rgba(244,63,94,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(244,63,94,0.65)] active:translate-y-0"
                              >
                                <StopCircle className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                Stop &amp; submit
                              </button>
                            </div>
                          </div>
                        )}

                        {/* EDIT MODE — Save & continue button */}
                        {isInEditMode && (
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => saveAnswerAndContinue(true)}
                              disabled={isSaving || !transcribedText.trim()}
                              className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_22px_-6px_rgba(124,58,237,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.65)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_8px_22px_-6px_rgba(124,58,237,0.3)]"
                            >
                              {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                              ) : (
                                <><ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" /> Save &amp; continue</>
                              )}
                            </button>
                          </div>
                        )}

                        {/* SUBMITTED — shown once the voice answer is recorded
                            and uploaded. Replaces the mic CTA (no flicker), and
                            offers a "Record again" escape hatch if the candidate
                            wants to redo it. */}
                        {!isRecording && !isTranscribing && !isInEditMode && audioSubmittedQuestions[currentQuestion + 1] && (
                          <div className="flex flex-col items-center gap-3 py-3">
                            <div className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/70 px-3 py-2.5 shadow-sm">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.45)] ring-1 ring-white/20">
                                <CheckCircle className="h-4 w-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold tracking-tight text-emerald-900">Answer submitted</p>
                                <p className="text-[11px] leading-relaxed text-emerald-700/90">
                                  Your spoken answer is saved. Move on with Next, or re-record below.
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAudioSubmittedQuestions((prev) => {
                                  const next = { ...prev };
                                  delete next[currentQuestion + 1];
                                  return next;
                                });
                                setQuestionTime(getQuestionTimeLimit()); 
                                setIsTimerRunning(true); 
                                startAudioRecording();
                              }}
                              className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-md active:translate-y-0"
                            >
                              <Mic className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                              Record again
                            </button>
                          </div>
                        )}

                        {/* TRANSCRIBING — animated multi-step */}
                        {isTranscribing && (
                          <div className="relative mt-3 overflow-hidden rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/70 px-3 py-2.5 shadow-sm">
                            <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                            <div className="flex items-center gap-2">
                              <span className="relative flex h-5 w-5 items-center justify-center">
                                <span aria-hidden className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-500 animate-spin" style={{ animationDuration: '0.8s' }} />
                                <Loader2 className="h-3 w-3 text-amber-700 animate-spin" />
                              </span>
                              <span className="text-xs font-bold tracking-tight text-amber-800">Transcribing your answer…</span>
                              <div className="ml-auto flex items-center gap-1">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    aria-hidden
                                    className="h-1 w-1 rounded-full bg-amber-600 animate-bounce"
                                    style={{ animationDelay: `${i * 120}ms` }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                      </div>
                    )}
                  </div>

                {footerActions}
            </div>
            </>
            )}
          </div>

        </div>

        </div>
      </div>
    </div>
  );
};

export default AiAssessmentTestInterface;
