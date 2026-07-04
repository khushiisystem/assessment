import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getInterviewIntro } from '../../APIs/services/ai_interview.service';

export default function InterviewIntro() {
  const params = useParams();
  const sessionId = params.sessionId || params.session_id;
  const navigate = useNavigate();
  const location = useLocation();
  const [intro, setIntro] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const speechRef = useRef(null);
  const introTimeoutRef = useRef(null);

  const { role } = location.state || {};

  useEffect(() => {
    if (!sessionId) return;

    const fetchIntro = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await getInterviewIntro(sessionId);
        const text = res?.introduction ?? '';
        setIntro(text);

        if (!text) {
          setError('Introduction text is unavailable.');
          return;
        }

        introTimeoutRef.current = window.setTimeout(() => speakText(text), 500);
      } catch (err) {
        setError(err?.message || 'Failed to load introduction. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchIntro();

    return () => {
      if (introTimeoutRef.current) {
        clearTimeout(introTimeoutRef.current);
        introTimeoutRef.current = null;
      }
      window.speechSynthesis?.cancel();
    };
  }, [sessionId]);

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechRef.current = utterance;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((v) =>
      v.lang.startsWith('en') &&
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Female'))
    ) || voices.find((v) => v.lang === 'en-US') || voices.find((v) => v.lang.startsWith('en'));
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const goToRoom = () => {
    window.speechSynthesis.cancel();
    navigate(`/candidate/AiInterviewRoom/${sessionId}`, {
      state: location.state,
    });
  };

  const handleStart = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setShowWarning(true);
  };
  const handleSkip = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setShowWarning(true);
  };

  // Full-screen loader while fetching intro
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center gap-5">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-purple-500/20" />
          <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-blue-500 animate-spin" />
          <div className="absolute inset-3 rounded-full bg-gradient-to-tr from-purple-500/20 to-blue-500/20 animate-pulse" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-white font-semibold text-lg tracking-wide">Preparing your interview</p>
          <p className="text-gray-500 text-sm animate-pulse">Zec is getting ready...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">

      {/* Fullscreen Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">

            {/* Header banner */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-b border-amber-500/20 px-8 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-2xl flex-shrink-0">
                ⚠️
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Before You Begin</h2>
                <p className="text-sm text-amber-400/80 mt-0.5">Please read these guidelines carefully</p>
              </div>
            </div>

            {/* Rules */}
            <div className="px-8 py-6 space-y-4">
              {[
                {
                  icon: '🖥️',
                  title: 'Fullscreen Mode is Required',
                  desc: 'This interview will run in fullscreen for the entire session. Your browser will enter fullscreen automatically when you begin.',
                },
                {
                  icon: '🔒',
                  title: 'Do Not Exit Fullscreen',
                  desc: 'Pressing Esc or using browser controls to exit fullscreen will trigger a security warning that is recorded in your report.',
                  warn: true,
                },
                {
                  icon: '🚫',
                  title: 'Stay on This Tab',
                  desc: 'Do not close this tab, open new tabs, or navigate away during the interview. Any such activity may be flagged.',
                  warn: true,
                },
                {
                  icon: '📞',
                  title: 'Use End Call to Finish',
                  desc: 'When you are done, click the End Call button. Your answers and scores will be saved and a report will be generated.',
                },
              ].map(({ icon, title, desc, warn }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-gray-800 border border-white/8 flex items-center justify-center text-base flex-shrink-0 mt-0.5">
                    {icon}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${warn ? 'text-rose-400' : 'text-white'}`}>{title}</p>
                    <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="px-8 pb-7 flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-3 rounded-2xl border border-white/10 bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 transition"
              >
                Go Back
              </button>
              <button
                onClick={goToRoom}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition"
              >
                I Understand, Start →
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl bg-gray-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10">
        <div className="flex flex-col items-center text-center space-y-10">

          {/* Avatar/Bot Icon with Circumference Glow */}
          <div className="relative">
            {isSpeaking && (
              <div className="absolute inset-[-12px] rounded-full bg-gradient-to-tr from-purple-500/40 to-blue-500/40 blur-md animate-pulse scale-110" />
            )}
            <div className={`relative w-32 h-32 rounded-full bg-gradient-to-tr from-purple-500 to-blue-600 flex items-center justify-center text-5xl shadow-xl shadow-purple-500/20 transition-all duration-500 ${
              isSpeaking ? 'ring-4 ring-purple-400 ring-offset-8 ring-offset-gray-900 scale-105' : 'ring-0'
            }`}>
              🤖
            </div>
            <div className={`absolute bottom-1 right-2 w-7 h-7 border-4 border-gray-900 rounded-full transition-colors duration-300 ${
              isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'
            }`} />
          </div>

          <div className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">
              {isSpeaking ? 'Zec is introducing itself...' : 'Ready to Begin?'}
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-purple-500 to-blue-500 mx-auto rounded-full" />
          </div>

          <div className="min-h-[60px] flex items-center justify-center">
            {error ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                {error}
              </div>
            ) : isSpeaking ? (
              <div className="flex gap-1.5 items-center justify-center">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-6 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Introduction complete. You're all set!</p>
            )}
          </div>

          <div className="pt-4 w-full max-w-xs space-y-3">
            <button
              onClick={handleStart}
              disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl ${
                loading
                  ? 'bg-gray-800 text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-white text-gray-950 hover:bg-gray-200 shadow-white/10'
              }`}
            >
              Start Interview
            </button>
            {isSpeaking && (
              <button
                onClick={handleSkip}
                className="w-full py-2.5 rounded-2xl font-semibold text-sm text-gray-400 border border-white/10 hover:border-white/20 hover:text-gray-200 transition-all"
              >
                Skip Intro →
              </button>
            )}
            <p className="mt-1 text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Powered by Zec Interview Engine
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 text-gray-500 text-sm flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {role ? `Position: ${role}` : 'Resume-based assessment'}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bounce {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.8); }
        }
      `}} />
    </div>
  );
}