import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  startInterview,
  getRoles,
  parseResume,
} from '../../APIs/services/ai_interview.service';

const DIFFICULTY_OPTIONS = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Conceptual, beginner-friendly questions',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    selected: 'border-emerald-400 bg-emerald-500/20',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Applied, problem-solving questions',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10 border-amber-500/30',
    selected: 'border-amber-400 bg-amber-500/20',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'System design, advanced internals',
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-500/10 border-rose-500/30',
    selected: 'border-rose-400 bg-rose-500/20',
  },
];

const QUESTION_COUNTS = [5, 10, 20];

const INITIAL_RESUME_DATA = {
  name: '',
  skills: [],
  experience_years: '',
  projects: [],
  summary: '',
  role: '',
};

function getStoredCandidateEmail() {
  const directEmail = sessionStorage.getItem('candidateEmail');
  if (directEmail) return directEmail;

  try {
    const storedUser = JSON.parse(sessionStorage.getItem('user') || '{}');
    return storedUser?.email || '';
  } catch {
    return '';
  }
}

export default function InterviewSetup() {
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);

  const [form, setForm] = useState({
    candidate_name: '',
    role: '',
    difficulty: 'medium',
    max_questions: 5,
  });

  const [customRole, setCustomRole] = useState('');
  const [useCustomRole, setUseCustomRole] = useState(false);

  const [useCustomCount, setUseCustomCount] = useState(false);
  const [customCount, setCustomCount] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Resume State
  const [resumeFile, setResumeFile] = useState(null);

  const [resumeData, setResumeData] = useState(
    INITIAL_RESUME_DATA
  );

  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeError, setResumeError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef(null);

  const hasResumeData =
    resumeData?.skills?.length > 0 ||
    resumeData?.projects?.length > 0 ||
    !!resumeData?.summary ||
    !!resumeData?.role;

  // =========================
  // Fetch Roles
  // =========================
  const fetchRoles = async () => {
    try {
      console.log('🚀 Fetching roles...');

      const res = await getRoles();

      console.log('✅ Roles Response:', res);

      if (res?.success) {
        setRoles(
          Array.isArray(res?.data)
            ? res.data
            : []
        );
      } else {
        console.warn(
          '⚠ Failed to fetch roles:',
          res
        );
      }
    } catch (error) {
      console.error(
        '💥 Roles API Error:',
        error
      );
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // =========================
  // Resume Upload
  // =========================
  const resetResumeState = () => {
    setResumeFile(null);
    setResumeData(INITIAL_RESUME_DATA);
    setResumeError('');
  };

const handleResumeFile = async (file) => {
  try {
    if (!file) return;

    // Reset old errors
    setResumeError('');

    // Validate PDF
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
      setResumeError(
        'Only PDF files are supported.'
      );
      return;
    }

    // Validate file size (5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    if (file.size > MAX_FILE_SIZE) {
      setResumeError(
        'Resume file size must be less than 5MB.'
      );
      return;
    }

    setResumeFile(file);
    setResumeParsing(true);
    setResumeData(INITIAL_RESUME_DATA);

    console.log('🚀 Parsing Resume...');

    // IMPORTANT:
    // parseResume already returns response.data
    const res = await parseResume(file);

    console.log(
      '✅ Resume Parse Response:',
      res
    );

    // Support both structures
    const resumePayload =
      res?.resume_data || res || {};

    const parsedData = {
      name:
        resumePayload?.name || '',

      skills: Array.isArray(
        resumePayload?.skills
      )
        ? resumePayload.skills
        : [],

      experience_years:
        resumePayload?.experience_years ||
        '',

      projects: Array.isArray(
        resumePayload?.projects
      )
        ? resumePayload.projects
        : [],

      summary:
        resumePayload?.summary || '',

      role:
        resumePayload?.role || '',
    };

    // Validate parsed content
    const hasValidData =
      parsedData.name ||
      parsedData.skills.length > 0 ||
      parsedData.projects.length > 0 ||
      parsedData.summary ||
      parsedData.role;

    if (!hasValidData) {
      throw new Error(
        'Resume parsing returned empty data.'
      );
    }

    setResumeData(parsedData);

    // Safe autofill
    setForm((prev) => ({
      ...prev,

      candidate_name:
        prev.candidate_name ||
        parsedData.name,

      role:
        !prev.role && !useCustomRole
          ? parsedData.role
          : prev.role,
    }));
  } catch (error) {
    console.error(
      '💥 Resume Parse Error:',
      error
    );

    resetResumeState();

    setResumeError(
      error?.response?.data?.message ||
        error?.message ||
        'Failed to parse resume.'
    );
  } finally {
    setResumeParsing(false);
  }
};

  // =========================
  // Start Interview
  // =========================
  const handleStart = async (e) => {
    e.preventDefault();

    const finalRole = useCustomRole
      ? customRole.trim()
      : form.role;

    if (!form.candidate_name.trim()) {
      setError('Please fill in your name.');
      return;
    }

    if (!finalRole && !hasResumeData) {
      setError(
        'Please select a role or upload a resume.'
      );
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log(
        '🚀 Starting Interview...'
      );

      const payload = {
        ...form,
        candidate_email: getStoredCandidateEmail(),
        role: finalRole,
        resume_data: hasResumeData
          ? resumeData
          : null,
      };

      const res = await startInterview(
        payload
      );

      console.log(
        '✅ Start Interview Response:',
        res
      );

        if (!res?.session_id) {
        throw new Error(
        res?.message ||
        'Failed to start interview.'
          );
}

      const responseData = res;

      navigate(
        `/candidate/AiInterviewIntro/${responseData.session_id}`,
        {
          state: {
            interviewData: responseData,

            role:
              finalRole ||
              resumeData?.role ||
              '',

            difficulty:
              form.difficulty,

            candidateName:
              form.candidate_name,

            interviewMode:
              responseData?.interview_mode,

            resumeData,
          },
        }
      );
    } catch (error) {
      console.error(
        '💥 Start Interview Error:',
        error
      );

      setError(
        error?.response?.data?.message ||
          error?.message ||
          'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-lg font-bold">
            Z
          </div>

          <span className="text-lg font-semibold tracking-tight">
            ZecInterview AI
          </span>
        </div>

        <div className="text-sm text-gray-400">
          Powered by Gemini + LangGraph
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium mb-4">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI-Powered Mock Interview
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Practice Interviews
            <br />

            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Like a Pro
            </span>
          </h1>

          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Get real-time AI feedback,
            adaptive follow-up questions,
            and comprehensive performance
            analysis.
          </p>
        </div>

        {/* Card */}
        <div className="w-full max-w-xl bg-gray-900/80 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">
          <form
            onSubmit={handleStart}
            className="space-y-6"
          >
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Name
              </label>

              <input
                type="text"
                placeholder="e.g. Alex Johnson"
                value={form.candidate_name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    candidate_name:
                      e.target.value,
                  }))
                }
                className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
              />
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Resume{' '}
                <span className="text-gray-500 font-normal">
                  (PDF — optional)
                </span>
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() =>
                  setDragOver(false)
                }
                onDrop={(e) => {
                  e.preventDefault();

                  setDragOver(false);

                  const file =
                    e.dataTransfer.files?.[0];

                  if (file)
                    handleResumeFile(file);
                }}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                className={`relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all ${
                  dragOver
                    ? 'border-purple-400 bg-purple-500/10'
                    : hasResumeData
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-white/10 bg-gray-800/30 hover:border-white/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file =
                      e.target.files?.[0];

                    if (file)
                      handleResumeFile(file);
                  }}
                />

                {resumeParsing ? (
                  <div className="flex items-center justify-center gap-2 text-purple-300 text-sm">
                    <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />

                    Parsing resume with AI…
                  </div>
                ) : hasResumeData ? (
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-400">
                      ✓
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-400 truncate">
                        {resumeFile?.name}
                      </p>

                      <p className="text-xs text-gray-400">
                        Resume parsed
                        successfully —{' '}
                        {resumeData?.skills
                          ?.length || 0}{' '}
                        skills detected
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetResumeState();
                      }}
                      className="ml-auto text-gray-500 hover:text-gray-300 text-xs flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    <span className="text-purple-400 font-medium">
                      Click to upload
                    </span>{' '}
                    or drag & drop a PDF
                    resume
                  </div>
                )}
              </div>

              {resumeError && (
                <p className="mt-1.5 text-xs text-rose-400">
                  {resumeError}
                </p>
              )}

              {/* Resume Summary */}
              {hasResumeData && (
                <div className="mt-3 rounded-xl bg-gray-800/50 border border-white/5 p-4 space-y-3 text-sm">
                  {resumeData?.summary && (
                    <p className="text-gray-300 leading-relaxed">
                      {resumeData.summary}
                    </p>
                  )}

                  {resumeData?.role && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-xs">
                        Suggested Role:
                      </span>

                      <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">
                        {resumeData.role}
                      </span>
                    </div>
                  )}

                  {!!resumeData?.experience_years && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">
                        Experience:
                      </span>

                      <span className="text-white">
                        {
                          resumeData.experience_years
                        }
                      </span>
                    </div>
                  )}

                  {(resumeData?.skills
                    ?.length || 0) > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1.5">
                        Skills Detected
                      </p>

                      <div className="flex flex-wrap gap-1.5">
                        {resumeData?.skills
                          ?.slice(0, 12)
                          ?.map((skill) => (
                            <span
                              key={skill}
                              className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs"
                            >
                              {skill}
                            </span>
                          ))}

                        {(resumeData?.skills
                          ?.length || 0) >
                          12 && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-400 text-xs">
                            +
                            {(resumeData
                              ?.skills
                              ?.length ||
                              0) - 12}{' '}
                            more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(resumeData?.projects
                    ?.length || 0) > 0 && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">
                        Projects (
                        {resumeData?.projects
                          ?.length || 0}
                        )
                      </p>

                      <ul className="space-y-0.5">
                        {resumeData?.projects
                          ?.slice(0, 3)
                          ?.map((project, i) => (
                            <li
                              key={i}
                              className="text-xs text-gray-400 truncate"
                            >
                              • {project}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mode Hint */}
            {hasResumeData && (
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${
                  form.role ||
                  (useCustomRole &&
                    customRole)
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                    : 'bg-purple-500/10 border-purple-500/20 text-purple-300'
                }`}
              >
                <span>
                  {form.role ||
                  (useCustomRole &&
                    customRole)
                    ? '🔀 Hybrid mode'
                    : '📄 Resume mode'}
                </span>

                <span className="text-gray-400 font-normal">
                  {form.role ||
                  (useCustomRole &&
                    customRole)
                    ? '— questions from both role requirements and your resume'
                    : '— questions based on your resume'}
                </span>
              </div>
            )}

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Role / Position
              </label>

              {!useCustomRole ? (
                <div className="space-y-2">
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        role:
                          e.target.value,
                      }))
                    }
                    className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition appearance-none"
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select a role...
                    </option>

                    {roles.map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      setUseCustomRole(true)
                    }
                    className="text-xs text-purple-400 hover:text-purple-300 transition"
                  >
                    + Type a custom role
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="e.g. Senior Go Engineer"
                    value={customRole}
                    onChange={(e) =>
                      setCustomRole(
                        e.target.value
                      )
                    }
                    className="w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition"
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setUseCustomRole(false)
                    }
                    className="text-xs text-gray-400 hover:text-gray-300 transition"
                  >
                    ← Choose from list
                  </button>
                </div>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Difficulty Level
              </label>

              <div className="grid grid-cols-3 gap-3">
                {DIFFICULTY_OPTIONS.map(
                  (opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setForm(
                          (prev) => ({
                            ...prev,
                            difficulty:
                              opt.value,
                          })
                        )
                      }
                      className={`relative flex flex-col items-center gap-1.5 p-4 rounded-xl border transition-all text-center ${
                        form.difficulty ===
                        opt.value
                          ? `${opt.selected} shadow-lg`
                          : `${opt.bg} hover:border-white/20`
                      }`}
                    >
                      <div
                        className={`text-sm font-semibold bg-gradient-to-r ${opt.color} bg-clip-text text-transparent`}
                      >
                        {opt.label}
                      </div>

                      <div className="text-[11px] text-gray-400 leading-tight">
                        {opt.description}
                      </div>

                      {form.difficulty ===
                        opt.value && (
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/60" />
                      )}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Questions */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Number of Questions
              </label>

              <div className="flex gap-2">
                {QUESTION_COUNTS.map(
                  (count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => {
                        setUseCustomCount(
                          false
                        );

                        setForm(
                          (prev) => ({
                            ...prev,
                            max_questions:
                              count,
                          })
                        );
                      }}
                      className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                        !useCustomCount &&
                        form.max_questions ===
                          count
                          ? 'border-purple-400 bg-purple-500/20 text-purple-300'
                          : 'border-white/10 bg-gray-800/40 text-gray-400 hover:border-white/20'
                      }`}
                    >
                      {count}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setUseCustomCount(true)
                  }
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition-all ${
                    useCustomCount
                      ? 'border-purple-400 bg-purple-500/20 text-purple-300'
                      : 'border-white/10 bg-gray-800/40 text-gray-400 hover:border-white/20'
                  }`}
                >
                  Custom
                </button>
              </div>

              {useCustomCount && (
                <input
                  type="number"
                  min={1}
                  max={50}
                  placeholder="Enter number (1–50)"
                  value={customCount}
                  onChange={(e) => {
                    const value =
                      e.target.value;

                    setCustomCount(value);

                    const parsed =
                      parseInt(
                        value,
                        10
                      );

                    if (
                      !isNaN(parsed) &&
                      parsed >= 1 &&
                      parsed <= 50
                    ) {
                      setForm(
                        (prev) => ({
                          ...prev,
                          max_questions:
                            parsed,
                        })
                      );
                    }
                  }}
                  className="mt-2 w-full bg-gray-800/60 border border-purple-500/40 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition text-sm"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                loading || resumeParsing
              }
              className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-base transition-all transform hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-purple-500/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting Interview…
                </span>
              ) : (
                'Start Interview →'
              )}
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {[
            'Adaptive follow-up questions',
            'Resume-based questions',
            'Hybrid interview mode',
            'Real-time AI feedback',
            'Difficulty-aware scoring',
            'No sign-up needed',
          ].map((feature) => (
            <div
              key={feature}
              className="text-xs text-gray-400 bg-gray-800/60 border border-white/5 rounded-full px-4 py-2"
            >
              ✓ {feature}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
