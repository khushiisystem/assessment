import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Calendar, Play, Loader2, Brain, ClipboardList, Video } from "lucide-react";
import UserLayout from "@/components/UserLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { useLazyGetAssessmentsQuery, useLazyGetCandidateMockInterviewsQuery } from "@/store";
import { formatDateTime, formatDateValue } from "@/utils/commonFunctions";
import { SurfaceCard } from "@/components/common/SurfaceCard";

interface TimeRemaining {
  days: number;
  hours: number;
}

interface UpcomingAssessment {
  candidate_assessment_id?: number;
  candidate_ai_assessment_id?: number;
  assessment_id: number;
  title: string;
  description: string;
  duration_minutes: number | null;
  start_date: string;
  end_date: string;
  status: string;
  assigned_date: string;
  start_time: string | null;
  total_questions: number;
  is_active: boolean;
  time_remaining: TimeRemaining;
  assessment_type: "ai" | "regular";
}

interface MockSession {
  id: number;
  stack: string;
  status: string;
  total_questions: number;
  attempted_questions: number;
  created_at: number; 
  scheduled_at?: string;
}

interface ApiResponse {
  count: number;
  regular_count: number;
  ai_count: number;
  upcoming_assessments: UpcomingAssessment[];
  ai_upcoming_assessments: UpcomingAssessment[];
}

type Tab = "assessments" | "ai_interviews" | "mock_interviews";

const UpcomingAssessments: React.FC = () => {
  const navigate = useNavigate();
  const [regularRows, setRegularRows] = useState<UpcomingAssessment[]>([]);
  const [aiRows, setAiRows] = useState<UpcomingAssessment[]>([]);
  const [mockRows, setMockRows] = useState<MockSession[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("assessments");
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [mockError, setMockError] = useState<string | null>(null);
  const [getAssessments] = useLazyGetAssessmentsQuery();
  const [getMockInterviews] = useLazyGetCandidateMockInterviewsQuery();

  useEffect(() => {
    fetchUpcomingData();
  }, []);

  const fetchUpcomingData = async () => {
    try {
      setIsLoading(true);
      setAssessmentError(null);
      setMockError(null);

      const [assessmentRes, mockRes] = await Promise.allSettled([
        getAssessments("candidate/assessments/upcoming/", true).unwrap(),
        getMockInterviews("api/mock-interview/my-mock-sessions/", true).unwrap(),
      ]);

      if (assessmentRes.status === "fulfilled") {
        const data = assessmentRes.value as ApiResponse;
        setRegularRows(data.upcoming_assessments || []);
        setAiRows(data.ai_upcoming_assessments || []);
      } else {
        setAssessmentError("Failed to load assessments data.");
      }

      if (mockRes.status === "fulfilled") {
        const raw = mockRes.value as unknown;
        let mockData: MockSession[] = [];

        if (Array.isArray(raw)) {
          mockData = raw;
        } else if (raw && typeof raw === "object") {
          const obj = raw as Record<string, unknown>;
          if (Array.isArray(obj.results)) {
            mockData = obj.results as MockSession[];
          } else if (Array.isArray(obj.data)) {
            mockData = obj.data as MockSession[];
          }
        }

        console.log("Mock sessions parsed:", mockData);
        setMockRows(mockData);
      } else {
        console.error("Mock API fetch failed:", (mockRes as PromiseRejectedResult).reason);
        setMockError("Failed to load mock interviews.");
      }
    } catch {
      setAssessmentError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: string) =>
    formatDateValue(date, { month: "short", day: "numeric", year: "numeric" }, date);

  const formatDateTimeValue = (date: string | number) =>
    typeof date === "number"
      ? formatDateValue(
          date,
          { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" },
          "N/A",
          "en-US",
          true
        )
      : formatDateTime(date, date);

  const handleStart = (assessment: UpcomingAssessment) => {
    const now = new Date();
    if (now < new Date(assessment.start_date)) {
      alert(`Assessment starts at ${formatDateTimeValue(assessment.start_date)}`);
      return;
    }

    if (assessment.assessment_type === "ai") {
      navigate(`/candidate/ai-assessment/${assessment.assessment_id}/running`);
    } else {
      navigate(`/candidate/my-assessment/${assessment.candidate_assessment_id}/running`);
    }
  };

  const handleStartMock = (mockId: number) => {
    navigate(`/candidate/mock-session/${mockId}/running`);
  };

  const rows = activeTab === "assessments" ? regularRows : aiRows;
  const currentError =
    activeTab === "mock_interviews" ? mockError : assessmentError;

  return (
    <UserLayout>
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <PageHeader
            title="Upcoming Assessments"
            description="View and manage your upcoming assessments and mock interviews"
            className="mb-3"
          />
          <div className="flex gap-1 mb-3 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("assessments")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "assessments"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Assessments
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "assessments"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                {regularRows.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("ai_interviews")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "ai_interviews"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              <Brain className="w-3.5 h-3.5" />
              AI Interviews
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "ai_interviews"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                {aiRows.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("mock_interviews")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === "mock_interviews"
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
            >
              <Video className="w-3.5 h-3.5" />
              Mock Interviews
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${activeTab === "mock_interviews"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-600"
                  }`}
              >
                {mockRows.length}
              </span>
            </button>
          </div>

          <SurfaceCard overflowHidden>
            {activeTab !== "mock_interviews" ? (
              <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1.2fr,0.8fr] text-[11px] font-semibold text-[#09376d] border-b px-3 py-2 bg-[#09376d0d]">
                <span>Assessment</span>
                <span className="text-center">Questions</span>
                <span className="text-center">Status</span>
                <span className="text-center">Schedule</span>
                <span className="text-right">Action</span>
              </div>
            ) : (
              <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1.2fr,0.8fr] text-[11px] font-semibold text-teal-800 border-b px-3 py-2 bg-teal-50">
                <span>Tech Stack</span>
                <span className="text-center">Questions</span>
                <span className="text-center">Status</span>
                <span className="text-center">Schedule Date - Time</span>
                <span className="text-right">Action</span>
              </div>
            )}

            {/* Loading */}
            {isLoading && (
              <div className="px-3 py-8 text-center">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading data...
                </span>
              </div>
            )}

            {/* Error — per tab */}
            {currentError && !isLoading && (
              <div className="px-3 py-8 text-center text-[11px] text-red-500">
                {currentError}
              </div>
            )}

            {/* Rows for Assessments & AI Interviews */}
            {!isLoading && !currentError && activeTab !== "mock_interviews" && (
              <div className="divide-y">
                {rows.map((assessment) => {
                  const uniqueKey =
                    assessment.candidate_assessment_id ||
                    assessment.candidate_ai_assessment_id;

                  return (
                    <div
                      key={`${assessment.assessment_type}-${uniqueKey}`}
                      className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1.4fr,0.9fr] items-center gap-2 px-3 py-2 text-[11px] hover:bg-slate-100/50 transition-all"
                    >
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 truncate">
                            {assessment.title}
                          </span>
                        </div>
                        <p
                          className="text-[10px] text-slate-500 truncate max-w-[200px]"
                          title={assessment.description}
                        >
                          {assessment.description || "—"}
                        </p>
                      </div>

                      <div className="md:text-center text-slate-700">
                        {assessment.total_questions} Q
                      </div>

                      <div className="md:text-center text-slate-700 capitalize">
                        {assessment.status || "Upcoming"}
                      </div>

                      <div className="flex flex-col items-center gap-0.5 text-slate-600">
                        <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Starts: {formatDateTimeValue(assessment.start_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Ends: {formatDate(assessment.end_date)}
                        </span>
                      </div>

                      <div className="flex md:justify-end">
                        <button
                          onClick={() => handleStart(assessment)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-white transition ${activeTab === "ai_interviews"
                              ? "bg-purple-600 hover:bg-purple-700"
                              : "bg-blue-600 hover:bg-blue-700"
                            }`}
                        >
                          <Play className="w-3 h-3" />
                          Start
                        </button>
                      </div>
                    </div>
                  );
                })}

                {rows.length === 0 && (
                  <div className="px-3 py-6 text-center text-[11px] text-slate-500">
                    {activeTab === "assessments"
                      ? "No upcoming assessments"
                      : "No upcoming AI interviews"}
                  </div>
                )}
              </div>
            )}

            {/* Rows for Mock Interviews */}
            {!isLoading && !currentError && activeTab === "mock_interviews" && (
              <div className="divide-y">
                {mockRows.map((mock) => (
                  <div
                    key={`mock-${mock.id}`}
                    className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1.2fr,0.8fr] items-center gap-2 px-3 py-2 text-[11px] hover:bg-teal-50/50 transition-all"
                  >
                    <div className="font-semibold text-slate-800">
                      {mock.stack}
                    </div>

                    <div className="md:text-center text-slate-700">
                      {mock.attempted_questions} / {mock.total_questions} Q
                    </div>

                    <div className="md:text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${mock.status === "in_progress" || mock.status === "active"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {mock.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-0.5 text-slate-600">
                      <span className="flex items-center justify-center gap-1 w-full">
                        <Calendar className="w-3 h-3" />
                        {formatDateTimeValue(mock.scheduled_at || "")}
                      </span>
                    </div>

                    <div className="flex md:justify-end">
                      <button
                        // onClick={() => handleStartMock(mock.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] text-white bg-teal-600 hover:bg-teal-700 transition"
                      >
                        <Play className="w-3 h-3" />
                        {mock.status === "in_progress" || mock.status === "active"
                          ? "Resume"
                          : "Start"}
                      </button>
                    </div>
                  </div>
                ))}

                {mockRows.length === 0 && (
                  <div className="px-3 py-6 text-center text-[11px] text-slate-500">
                    No upcoming or in-progress mock interviews
                  </div>
                )}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </UserLayout>
  );
};

export default UpcomingAssessments;
