import { useEffect, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';


const GRADE_COLORS = {
  'A+': 'text-emerald-300',
  'A': 'text-emerald-400',
  'B+': 'text-teal-400',
  'B': 'text-blue-400',
  'C+': 'text-amber-400',
  'C': 'text-amber-500',
  'D': 'text-orange-500',
  'F': 'text-rose-500',
};

const RECOMMENDATION_STYLES = {
  'Strong Hire': { color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  'Hire': { color: 'text-teal-300', bg: 'bg-teal-500/15 border-teal-500/30' },
  'Consider': { color: 'text-amber-300', bg: 'bg-amber-500/15 border-amber-500/30' },
  'No Hire': { color: 'text-rose-300', bg: 'bg-rose-500/15 border-rose-500/30' },
};

const scoreColor = (s) =>
  s >= 8 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-rose-400';

const scoreBarColor = (s) =>
  s >= 8 ? 'from-emerald-500 to-teal-500' : s >= 5 ? 'from-amber-500 to-orange-500' : 'from-rose-500 to-pink-500';

export default function InterviewResults() {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const locState = location.state || {};

  const [report, setReport] = useState(locState?.report ?? null);
  const [role, setRole] = useState(locState?.role ?? '');
  const [difficulty, setDifficulty] = useState(locState?.difficulty ?? '');
  const [candidateName, setCandidateName] = useState(locState?.candidateName ?? '');
  const [loading, setLoading] = useState(!locState?.report);

  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      navigate('/login', { replace: true });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigate]);

  useEffect(() => {
    if (!locState?.report && sessionId) {
      api.getSession(sessionId).then((s) => {
        setReport(s.final_report);
        setRole(s.role);
        setDifficulty(s.difficulty);
        setCandidateName(s.candidate_name);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Generating your report…</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-xl">No report found for this session.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 transition"
          >
            Start a new interview
          </button>
        </div>
      </div>
    );
  }

  const recStyle = RECOMMENDATION_STYLES[report.recommendation] ?? RECOMMENDATION_STYLES['Consider'];
  const gradeColor = GRADE_COLORS[report.grade] ?? 'text-white';

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center font-bold">Z</div>
          <span className="font-semibold">Interview Results</span>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10 text-sm transition"
        >
          New Interview
        </button>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-10 space-y-6">
        {/* Hero Score Card */}
        <div className="bg-gray-900/80 border border-white/10 rounded-2xl p-8">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Score Circle */}
            <div className="flex-shrink-0 relative">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#1f2937" strokeWidth="10" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke="url(#scoreGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(report.overall_score / 10) * 314} 314`}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{report.overall_score.toFixed(1)}</span>
                <span className="text-gray-500 text-xs">/ 10</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h1 className="text-2xl font-bold">{candidateName || 'Candidate'}</h1>
                <p className="text-gray-400">{role} • <span className="capitalize">{difficulty}</span></p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <div className="px-4 py-2 rounded-xl bg-gray-800/60 border border-white/10">
                  <span className="text-xs text-gray-500 block">Grade</span>
                  <span className={`text-2xl font-bold ${gradeColor}`}>{report.grade}</span>
                </div>
                <div className={`px-4 py-2 rounded-xl border ${recStyle.bg}`}>
                  <span className="text-xs text-gray-500 block">Recommendation</span>
                  <span className={`text-base font-bold ${recStyle.color}`}>{report.recommendation}</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed max-w-lg">{report.summary}</p>
            </div>
          </div>
          {report.recommendation_reason && (
            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-sm text-gray-400 italic">{report.recommendation_reason}</p>
            </div>
          )}
        </div>

        {/* Strengths / Improvements */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-gray-900/70 border border-emerald-500/15 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider">✓ Strengths</h2>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-900/70 border border-amber-500/15 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">↑ Areas to Improve</h2>
            <ul className="space-y-2">
              {report.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-500 mt-0.5 flex-shrink-0">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Q&A Breakdown */}
        {report.qa_pairs && report.qa_pairs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-300">Question-by-Question Breakdown</h2>
            {report.qa_pairs.map((qa) => (
              <details
                key={qa.number}
                className="bg-gray-900/70 border border-white/10 rounded-2xl group"
              >
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-mono text-gray-400">
                      {qa.number}
                    </span>
                    {qa.is_followup && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">
                        follow-up
                      </span>
                    )}
                    <span className="text-sm text-gray-300 line-clamp-1 max-w-xs md:max-w-lg">
                      {qa.question}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`text-sm font-mono font-bold ${scoreColor(qa.score)}`}>
                      {qa.score}/10
                    </div>
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${scoreBarColor(qa.score)}`}
                        style={{ width: `${(qa.score / 10) * 100}%` }}
                      />
                    </div>
                    <svg className="w-4 h-4 text-gray-600 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </summary>
                <div className="px-6 pb-5 space-y-3 border-t border-white/5 pt-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Question</p>
                    <p className="text-sm text-gray-200">{qa.question}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">Your Answer</p>
                    <p className="text-sm text-gray-400 leading-relaxed">{qa.answer}</p>
                  </div>
                  {qa.feedback && (
                    <div className={`rounded-xl p-4 border ${
                      qa.score >= 8
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : qa.score >= 5
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-rose-500/5 border-rose-500/20'
                    }`}>
                      <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">AI Feedback</p>
                      <p className="text-sm text-gray-300 leading-relaxed">{qa.feedback}</p>
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 pb-8">
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 font-semibold transition-all transform hover:scale-[1.02]"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => window.print()}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 border border-white/10 font-semibold transition"
          >
            Print / Save PDF
          </button>
        </div>
      </main>
    </div>
  );
}