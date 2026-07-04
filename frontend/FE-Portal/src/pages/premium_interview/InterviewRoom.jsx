import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api, transcribeAudio } from '@/lib/api';

const DIFFICULTY_COLORS = {
  easy: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  hard: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

const MULTIPART_CHUNK_SIZE = 5 * 1024 * 1024;

function pickRecordingMimeType() {
  const mimeTypes = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    '',
  ];

  return mimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || '';
}

function scoreColor(s) {
  return s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-rose-400';
}

function AIAvatar({ speaking, thinking }) {
  return (
    <div className="relative flex flex-col items-center">
      {speaking && (
        <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-ping scale-110" />
      )}
      <div
        className={`absolute inset-0 rounded-full border-2 transition-all duration-300 ${speaking
          ? 'border-purple-400 scale-105 opacity-80'
          : thinking
            ? 'border-blue-400/50 animate-pulse'
            : 'border-white/10'
          }`}
      />
      <div
        className={`relative w-24 h-24 rounded-full flex items-center justify-center text-4xl shadow-2xl transition-all duration-300 ${speaking
          ? 'bg-gradient-to-br from-purple-600 to-blue-700 shadow-purple-500/40'
          : thinking
            ? 'bg-gradient-to-br from-blue-700 to-indigo-800 shadow-blue-500/30'
            : 'bg-gradient-to-br from-gray-700 to-gray-800'
          }`}
      >
        {'\u{1F916}'}
      </div>
      {speaking && (
        <div className="absolute -bottom-5 flex items-end gap-0.5 h-4">
          {[3, 5, 7, 5, 8, 4, 6, 3, 5, 7].map((h, i) => (
            <div
              key={i}
              className="w-0.5 bg-purple-400 rounded-full animate-pulse"
              style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms`, animationDuration: `${400 + i * 60}ms` }}
            />
          ))}
        </div>
      )}
      {thinking && !speaking && (
        <div className="absolute -bottom-5 flex gap-1">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function MicButton({ recording, transcribing, disabled, onStart, onStop }) {
  return (
    <button
      type="button"
      disabled={disabled || transcribing}
      onClick={recording ? onStop : onStart}
      className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${recording
        ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/40 scale-110'
        : transcribing
          ? 'bg-gray-700 cursor-wait'
          : 'bg-gray-800 hover:bg-gray-700 border border-white/10'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {recording && <div className="absolute inset-0 rounded-full bg-rose-500/30 animate-ping" />}
      {transcribing ? (
        <div className="w-5 h-5 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
      ) : recording ? (
        <div className="w-4 h-4 bg-white rounded-sm" />
      ) : (
        <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-7 7.93V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.07A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z" />
        </svg>
      )}
    </button>
  );
}

export default function InterviewRoom() {
  const params = useParams();
  const sessionId = params.sessionId || params.session_id;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};

  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [isFollowup, setIsFollowup] = useState(false);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [scores, setScores] = useState([]);
  const [lastFeedback, setLastFeedback] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [role, setRole] = useState(state?.role ?? '');
  const [difficulty, setDifficulty] = useState(state?.difficulty ?? 'medium');
  const [candidateName, setCandidateName] = useState(state?.candidateName ?? '');
  const [interviewMode] = useState(state?.interviewMode ?? 'role');

  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [questionTimer, setQuestionTimer] = useState(120);
  const [timerActive, setTimerActive] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showFullscreenWarn, setShowFullscreenWarn] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const intentionalExitRef = useRef(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const fullInterviewRecorderRef = useRef(null);
  const fullInterviewChunksRef = useRef([]);
  const fullInterviewMimeTypeRef = useRef('video/webm');
  const mediaUploadStartedRef = useRef(false);
  const textareaRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const prevAvatarSpeakingRef = useRef(false);
  const answerRef = useRef('');
  const timerStartedRef = useRef(false);

  const speakText = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.onstart = () => setAvatarSpeaking(true);
    utter.onend = () => setAvatarSpeaking(false);
    utter.onerror = () => setAvatarSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setAvatarSpeaking(false);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setCameraError('');

      const mimeType = pickRecordingMimeType();
      fullInterviewChunksRef.current = [];
      fullInterviewMimeTypeRef.current = mimeType || 'video/webm';

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 1200000 } : undefined,
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          fullInterviewChunksRef.current.push(event.data);
        }
      };

      fullInterviewRecorderRef.current = recorder;
      recorder.start(15000);
    } catch {
      setCameraError('Camera access denied or unavailable.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (fullInterviewRecorderRef.current?.state === 'recording') {
      fullInterviewRecorderRef.current.stop();
    }
    fullInterviewRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const baseAudioTrack = streamRef.current?.getAudioTracks?.()[0];
      if (!baseAudioTrack) {
        throw new Error('Microphone is not available.');
      }
      const stream = new MediaStream([baseAudioTrack.clone()]);
      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, `audio_answer_q${questionNumber}.webm`);
          formData.append('question_number', String(questionNumber));

          const [transcriptionResult, uploadResult] = await Promise.allSettled([
            transcribeAudio(blob),
            api.uploadAnswerAudio(sessionId, formData),
          ]);

          if (transcriptionResult.status === 'fulfilled') {
            const text = transcriptionResult.value;
            setAnswer((prev) => prev ? `${prev} ${text}` : text);
          } else {
            throw transcriptionResult.reason;
          }

          if (uploadResult.status === 'rejected') {
            console.error('Premium audio upload failed:', uploadResult.reason);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Transcription failed.');
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied.');
    }
  }, [questionNumber, sessionId]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const uploadInterviewVideoBlob = useCallback(async (blob) => {
    if (!blob || !blob.size || !sessionId) return null;

    const initData = new FormData();
    initData.append('file_name', `premium_interview_${sessionId}.webm`);
    initData.append('file_type', blob.type || fullInterviewMimeTypeRef.current || 'video/webm');
    initData.append('use_multipart', 'true');

    const uploadMeta = await api.initializeInterviewVideoUpload(sessionId, initData);
    const parts = [];

    for (let offset = 0, partNumber = 1; offset < blob.size; offset += MULTIPART_CHUNK_SIZE, partNumber += 1) {
      const chunk = blob.slice(offset, offset + MULTIPART_CHUNK_SIZE, blob.type || 'video/webm');
      const formData = new FormData();
      formData.append('chunk', chunk, `chunk_${partNumber}.webm`);
      formData.append('chunk_index', String(partNumber));
      formData.append('upload_id', uploadMeta.upload_id);
      formData.append('file_key', uploadMeta.file_key);

      const response = await api.uploadInterviewVideoChunk(sessionId, formData);
      parts.push({
        PartNumber: partNumber,
        ETag: response.etag,
      });
    }

    return api.completeInterviewVideoUpload(sessionId, {
      upload_id: uploadMeta.upload_id,
      file_key: uploadMeta.file_key,
      parts,
    });
  }, [sessionId]);

  const finalizeInterviewMedia = useCallback(async () => {
    if (mediaUploadStartedRef.current) return null;
    mediaUploadStartedRef.current = true;
    setUploadingMedia(true);

    try {
      if (recording) {
        stopRecording();
      }

      const recorder = fullInterviewRecorderRef.current;
      let blob = null;

      if (recorder) {
        if (recorder.state !== 'inactive') {
          blob = await new Promise((resolve) => {
            recorder.addEventListener('stop', () => {
              resolve(new Blob(
                fullInterviewChunksRef.current,
                { type: fullInterviewMimeTypeRef.current || 'video/webm' },
              ));
            }, { once: true });
            recorder.stop();
          });
        } else if (fullInterviewChunksRef.current.length > 0) {
          blob = new Blob(
            fullInterviewChunksRef.current,
            { type: fullInterviewMimeTypeRef.current || 'video/webm' },
          );
        }
      }

      if (blob?.size) {
        await uploadInterviewVideoBlob(blob);
      }

      return blob;
    } catch (error) {
      mediaUploadStartedRef.current = false;
      throw error;
    } finally {
      setUploadingMedia(false);
    }
  }, [recording, stopRecording, uploadInterviewVideoBlob]);

  const applyInterviewData = useCallback((data) => {
    if (data.question) { setCurrentQuestion(data.question); speakText(data.question); }
    if (data.question_number) setQuestionNumber(data.question_number);
    if (data.total_questions) setTotalQuestions(data.total_questions);
    setIsFollowup(data.is_followup ?? false);
    if (data.scores) setScores(data.scores);
    if (data.conversation) setHistory(data.conversation);
    setQuestionTimer(120);
    timerStartedRef.current = false;
  }, [speakText]);

  const exitFullscreen = useCallback(() => {
    intentionalExitRef.current = true;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const doSubmit = useCallback(async (answerText) => {
    stopSpeaking();
    stopTimer();
    setSubmitting(true); setThinking(true); setError('');
    try {
      const res = await api.submitAnswer(sessionId, answerText || '[No answer — time expired]');
      const newConv = res.conversation ?? [];
      const lastAns = [...newConv].reverse().find((c) => c.type === 'answer');
      if (lastAns?.score !== undefined) {
        setLastFeedback({ score: lastAns.score, feedback: lastAns.feedback ?? '' });
        setShowFeedback(true); setHistory(newConv);
        if (res.scores) setScores(res.scores);
      }
      setThinking(false);
      if (res.status === 'completed') {
        setTimeout(async () => {
          try {
            await finalizeInterviewMedia();
          } catch (mediaError) {
            console.error('Premium interview media upload failed:', mediaError);
          }
          exitFullscreen();
          navigate(
            `/candidate/AiInterviewResults/${sessionId}`,
            {
              state: {
                report: res.final_report,
                role,
                difficulty,
                candidateName,
                scores: res.scores,
              },
              replace: true,
            }
          );
        }, 2500);
        return;
      }
      setTimeout(() => {
        setShowFeedback(false); setLastFeedback(null);
        applyInterviewData(res); setAnswer('');
        textareaRef.current?.focus();
      }, 2500);
    } catch (err) {
      setThinking(false);
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }, [sessionId, role, difficulty, candidateName, navigate, stopSpeaking, stopTimer, applyInterviewData, exitFullscreen, finalizeInterviewMedia]);

  useEffect(() => {
    // Enter fullscreen when interview room mounts
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }

    // Warn if user exits fullscreen unexpectedly
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        if (intentionalExitRef.current) {
          intentionalExitRef.current = false;
        } else {
          setShowFullscreenWarn(true);
        }
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);

    startCamera();
    if (state?.interviewData) {
      applyInterviewData(state.interviewData);
    } else if (sessionId) {
      api.getSession(sessionId).then((s) => {
        setRole(s.role); setDifficulty(s.difficulty); setCandidateName(s.candidate_name);
        setTotalQuestions(s.max_questions); setQuestionNumber(s.question_number); setScores(s.scores);
        if (s.status === 'completed') navigate(`/results/${sessionId}`, { replace: true });
      });
    }
    return () => { stopCamera(); stopSpeaking(); stopTimer(); exitFullscreen(); document.removeEventListener('fullscreenchange', onFsChange); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { answerRef.current = answer; }, [answer]);

  useEffect(() => {
    if (prevAvatarSpeakingRef.current && !avatarSpeaking && currentQuestion && !showFeedback && !submitting && !timerStartedRef.current) {
      timerStartedRef.current = true;
      setQuestionTimer(120);
      setTimerActive(true);
    }
    prevAvatarSpeakingRef.current = avatarSpeaking;
  }, [avatarSpeaking, currentQuestion, showFeedback, submitting]);

  useEffect(() => {
    if (!timerActive) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    timerIntervalRef.current = setInterval(() => {
      setQuestionTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          setTimerActive(false);
          doSubmit(answerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timerActive, doSubmit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    await doSubmit(answer.trim());
  };

  const handleEndCall = async () => {
    setEnding(true);
    try {
      const res = await api.endInterview(sessionId);
      try {
        await finalizeInterviewMedia();
      } catch (mediaError) {
        console.error('Premium interview media upload failed:', mediaError);
      }
      exitFullscreen();
      navigate(
        `/candidate/AiInterviewResults/${sessionId}`,
        {
          state: {
            report: res.final_report,
            role,
            difficulty,
            candidateName,
            scores: res.scores,
          },
          replace: true,
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end interview.');
      setEnding(false);
      setShowEndConfirm(false);
    }
  };

  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const progress = Math.round(((questionNumber - 1) / totalQuestions) * 100);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">

      {/* Fullscreen Exit Warning Modal */}
      {showFullscreenWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-gray-900 border border-rose-500/30 rounded-2xl p-7 max-w-sm w-full mx-4 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-xl">
                ⚠️
              </div>
              <div>
                <div className="font-semibold text-white">Fullscreen Exited!</div>
                <div className="text-xs text-rose-400 mt-0.5">This will be flagged in your report</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              You have exited fullscreen mode. Leaving fullscreen during an interview is considered a security violation and will be recorded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowFullscreenWarn(false); document.documentElement.requestFullscreen().catch(() => {}); }}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold text-white transition"
              >
                Return to Fullscreen
              </button>
              <button
                onClick={() => { setShowFullscreenWarn(false); setShowEndConfirm(true); }}
                className="flex-1 py-2.5 rounded-xl border border-rose-500/30 bg-rose-600/10 hover:bg-rose-600/20 text-sm font-medium text-rose-400 transition"
              >
                End Interview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Call Confirmation Modal */}
      {showEndConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-7 max-w-sm w-full mx-4 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-white">End Interview?</div>
                <div className="text-xs text-gray-500 mt-0.5">Your progress will be saved</div>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              All answered questions and scores will be saved and a partial report will be generated.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndConfirm(false)}
                disabled={ending}
                className="flex-1 py-2.5 rounded-xl border border-white/10 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleEndCall}
                disabled={ending}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {ending ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Ending…</> : 'End Interview'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold text-sm">Z</div>
          <div>
            <div className="text-sm font-semibold leading-tight">{candidateName || 'Candidate'}</div>
            <div className="text-xs text-gray-500 leading-tight">{role}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {avgScore !== null && <div className={`text-sm font-mono font-bold ${scoreColor(avgScore)}`}>{avgScore.toFixed(1)}/10</div>}
          <span className={`text-xs px-3 py-1 rounded-full border capitalize font-medium ${DIFFICULTY_COLORS[difficulty] ?? 'text-gray-400 border-white/10'}`}>{difficulty}</span>
          {interviewMode !== 'role' && (
            <span className={`text-xs px-3 py-1 rounded-full border font-medium ${interviewMode === 'hybrid'
              ? 'text-blue-300 bg-blue-500/10 border-blue-500/30'
              : 'text-purple-300 bg-purple-500/10 border-purple-500/30'
              }`}>
              {interviewMode === 'hybrid' ? '🔀 Hybrid' : '📄 Resume'}
            </span>
          )}
          <span className="text-xs text-gray-600 hidden sm:block">Q {questionNumber}/{totalQuestions}</span>
          <button
            onClick={() => setShowEndConfirm(true)}
            disabled={submitting || ending}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-rose-600/15 border border-rose-500/30 hover:bg-rose-600/30 text-rose-400 text-xs font-semibold transition disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.25 6.75A2.25 2.25 0 014.5 4.5h1.372c.516 0 .966.351 1.091.852l1.106 4.423a1.125 1.125 0 01-.26 1.043l-1.498 1.498a10.513 10.513 0 005.273 5.273l1.498-1.498a1.125 1.125 0 011.043-.26l4.423 1.106c.5.125.852.575.852 1.091V19.5a2.25 2.25 0 01-2.25 2.25h-2.25C8.552 21.75 2.25 15.448 2.25 7.5V6.75z" />
            </svg>
            End Call
          </button>
        </div>
      </header>

      <div className="relative z-10 h-0.5 bg-gray-900">
        <div className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      <main className="relative z-10 flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-7xl mx-auto w-full">

        {/* Left column */}
        <div className="lg:w-72 flex-shrink-0 flex flex-col gap-4">

          {/* AI Avatar */}
          <div className="bg-gray-900/60 border border-white/[0.08] rounded-2xl p-5 flex flex-col items-center gap-4">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold self-start">AI Interviewer</div>
            <div className="relative w-28 h-28">
              <AIAvatar speaking={avatarSpeaking} thinking={thinking} />
            </div>
            <div className="text-center mt-6">
              <div className="font-semibold text-sm">Zec AI</div>
              <div className="text-xs mt-0.5 h-4">
                {avatarSpeaking
                  ? <span className="text-gray-500">Speaking…</span>
                  : thinking
                    ? <span className="text-gray-500">Thinking…</span>
                    : timerActive
                      ? <span className={`font-mono font-bold ${questionTimer <= 20 ? 'text-rose-400 animate-pulse' : questionTimer <= 60 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>⏱ {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}</span>
                      : <span className="text-gray-500">Listening</span>
                }
              </div>
            </div>
            {avatarSpeaking && (
              <button onClick={stopSpeaking} className="text-xs px-3 py-1 rounded-lg bg-gray-800 border border-white/10 hover:bg-gray-700 text-gray-400 transition">
                Stop
              </button>
            )}
          </div>

          {/* Camera */}
          <div className="bg-gray-900/60 border border-white/[0.08] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Your Camera</span>
              <button
                onClick={cameraOn ? stopCamera : startCamera}
                className={`text-xs px-2.5 py-1 rounded-lg border transition ${cameraOn ? 'border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}
              >
                {cameraOn ? 'Off' : 'On'}
              </button>
            </div>
            <div className="relative aspect-video bg-gray-950 flex items-center justify-center">
              <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover transition-opacity duration-300 ${cameraOn ? 'opacity-100' : 'opacity-0'}`} />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V7.5A2.25 2.25 0 014.5 5.25H12a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25z" />
                  </svg>
                  <span className="text-xs">Camera off</span>
                </div>
              )}
              {cameraOn && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-xs text-gray-300">LIVE</span>
                </div>
              )}
            </div>
            {cameraError && <div className="px-4 py-2 text-xs text-amber-400">{cameraError}</div>}
          </div>

          {/* Scores */}
          {scores.length > 0 && (
            <div className="bg-gray-900/60 border border-white/[0.08] rounded-2xl p-4 space-y-3">
              <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Scores</div>
              <div className="flex flex-wrap gap-2">
                {scores.map((s, i) => (
                  <span key={i} className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-gray-800/80 ${scoreColor(s)}`}>Q{i + 1}: {s}/10</span>
                ))}
              </div>
              {avgScore !== null && (
                <div className="text-xs text-gray-500">Average: <span className={`font-bold font-mono ${scoreColor(avgScore)}`}>{avgScore.toFixed(1)}/10</span></div>
              )}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Progress dots */}
          <div className="flex items-center gap-2">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < questionNumber - 1 ? 'bg-gradient-to-r from-purple-500 to-blue-500' : i === questionNumber - 1 ? 'bg-gray-600 animate-pulse' : 'bg-gray-800'}`} />
            ))}
          </div>

          {/* Question */}
          <div className="bg-gray-900/60 border border-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isFollowup ? (
                  <>
                    <span className="text-xs text-purple-300 font-semibold uppercase tracking-widest">Follow-up</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">probe deeper</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-widest">Question {questionNumber}</span>
                )}
                {timerActive && (
                  <span className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full border transition-colors ${questionTimer <= 20
                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/30 animate-pulse'
                    : questionTimer <= 60
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                    }`}>
                    ⏱ {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')}
                  </span>
                )}
              </div>
              {currentQuestion && (
                <button
                  onClick={() => speakText(currentQuestion)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-white/10 bg-gray-800/50 hover:bg-gray-700 text-gray-400 transition flex items-center gap-1.5"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.344-5.891a1.5 1.5 0 000-2.538L6.3 2.841z" /></svg>
                  Replay
                </button>
              )}
            </div>
            {currentQuestion ? (
              <p className="text-xl leading-relaxed font-medium text-white">{currentQuestion}</p>
            ) : (
              <div className="space-y-2.5">
                <div className="h-5 bg-gray-800/80 rounded animate-pulse w-3/4" />
                <div className="h-5 bg-gray-800/80 rounded animate-pulse w-full" />
                <div className="h-5 bg-gray-800/80 rounded animate-pulse w-1/2" />
              </div>
            )}
          </div>

          {/* Feedback */}
          {showFeedback && lastFeedback && (
            <div className={`border rounded-2xl p-5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${lastFeedback.score >= 8 ? 'bg-emerald-500/5 border-emerald-500/20' : lastFeedback.score >= 5 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-300">AI Feedback</span>
                <span className={`text-xl font-bold font-mono ${scoreColor(lastFeedback.score)}`}>{lastFeedback.score}/10</span>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">{lastFeedback.feedback}</p>
            </div>
          )}

          {/* Answer form */}
          <form onSubmit={handleSubmit} className="bg-gray-900/60 border border-white/[0.08] rounded-2xl p-5 space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">Your Answer</label>
              <div className="flex items-center gap-2 text-xs">
                {recording && <span className="flex items-center gap-1.5 text-rose-400 font-medium animate-pulse"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />Recording&hellip;</span>}
                {transcribing && <span className="flex items-center gap-1.5 text-blue-400"><div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />Transcribing&hellip;</span>}
              </div>
            </div>
            <textarea
              ref={textareaRef}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={submitting || showFeedback}
              placeholder={recording ? 'Listening\u2026 speak your answer now' : transcribing ? 'Converting speech to text\u2026' : 'Type your answer or click the mic to speak\u2026'}
              rows={7}
              className="w-full flex-1 bg-gray-800/50 border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 transition disabled:opacity-50 text-sm leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (answer.trim() && !submitting && !showFeedback) handleSubmit(e);
                }
              }}
            />
            {error && <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">{error}</div>}
            {timerActive && !showFeedback && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-semibold ${questionTimer <= 20 ? 'text-rose-400' : questionTimer <= 60 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                    {Math.floor(questionTimer / 60)}:{(questionTimer % 60).toString().padStart(2, '0')} remaining
                  </span>
                  {questionTimer <= 30 && (
                    <span className="text-xs text-rose-400 animate-pulse">Auto-submitting soon…</span>
                  )}
                </div>
                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${questionTimer <= 20 ? 'bg-rose-500' : questionTimer <= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                    style={{ width: `${(questionTimer / 120) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <MicButton recording={recording} transcribing={transcribing} disabled={submitting || showFeedback} onStart={startRecording} onStop={stopRecording} />
              <div className="flex-1" />
              <span className="text-xs text-gray-700 hidden sm:block">Ctrl+Enter to submit</span>
              <button
                type="submit"
                disabled={!answer.trim() || submitting || showFeedback}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
              >
                {submitting ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Evaluating&hellip;</>) : showFeedback ? (<><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Loading next&hellip;</>) : 'Submit Answer \u2192'}
              </button>
            </div>
          </form>

          {history.filter((h) => h.type === 'answer').length > 0 && !showFeedback && (
            <div className="bg-gray-900/60 border border-white/[0.08] rounded-2xl p-4 space-y-2 max-h-32 overflow-y-auto">
              <div className="text-xs uppercase tracking-widest text-gray-600 font-semibold">Previous Feedback</div>
              {[...history].reverse().filter((h) => h.type === 'answer').slice(0, 2).map((h, i) => (
                <div key={i} className="text-xs text-gray-500 leading-relaxed border-l-2 border-purple-500/30 pl-3">{h.feedback}</div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
