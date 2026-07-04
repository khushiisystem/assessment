import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, History, BarChart2, Mail, User, Calendar, TrendingUp, Star, Target, Play, Trash2, Layers } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import {
  useLazyGetCandidateAnalyticsQuery,
  useLazyGetSessionsQuery,
  useLazyGetMockQuestionsQuery,
  useDeleteMockCandidateMutation,
} from "@/store";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";

export interface Candidate {
  id?: number;
  name: string;
  email: string;
  created_at?: number;
  updated_at?: number;
}

export interface CandidateAnalytics {
  candidate: Candidate;
  history: Array<{ stack: string; created_at: number; score: number }>;
  skills: Record<string, number>;
}
export interface Question {
  id?: number;
  text: string;
  ideal_answer: string;
  stack: string;
  difficulty: "Junior" | "Mid-Level" | "Senior";
}

export interface CandidateResponse {
  question_id: number;
  rating: number;
  notes: string;
}

export interface MockSession {
  id?: number;
  candidate_id?: number;
  questions: number[];
  responses: Record<string, CandidateResponse>;
  created_at?: number;
}

const CandidateProfile: React.FC = () => {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [analytics, setAnalytics] = useState<CandidateAnalytics | null>(null);
  const [rawSessions, setRawSessions] = useState<MockSession[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const pageParam = searchParams.get('page');
  const backUrl = pageParam ? `/admin/mock-interview?page=${pageParam}` : "/admin/mock-interview";

  // RTK Query hooks
  const [getCandidateAnalytics] = useLazyGetCandidateAnalyticsQuery();
  const [getSessions] = useLazyGetSessionsQuery();
  const [getMockQuestions] = useLazyGetMockQuestionsQuery();
  const [deleteCandidateMutation] = useDeleteMockCandidateMutation();

  useEffect(() => {
    if (candidateId) {
      loadData();
    }
  }, [candidateId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [analyticsData, sessionsResult, questionsResult] = await Promise.all([
        getCandidateAnalytics(Number(candidateId)).unwrap(),
        getSessions().unwrap(),
        getMockQuestions().unwrap(),
      ]);

      const analyticsResolved = analyticsData?.results ?? analyticsData;
      const sessions = sessionsResult?.results ?? sessionsResult;
      const questions = questionsResult?.results ?? questionsResult;

      setAnalytics(analyticsResolved);
      setAllQuestions(questions);
      const candidateSessions = sessions.filter((s: MockSession) => s.candidate_id === Number(candidateId));
      setRawSessions(candidateSessions);

    } catch (error) {
      toast.error("Failed to load candidate data");
      navigate(backUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!candidateId) return;
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!candidateId) return;
    setIsDeleteActionLoading(true);
    try {
      await deleteCandidateMutation(Number(candidateId)).unwrap();
      toast.success("Candidate deleted successfully");
      setIsDeleteDialogOpen(false);
      navigate(backUrl);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete candidate");
    } finally {
      setIsDeleteActionLoading(false);
    }
  };
  const techPerformance = useMemo(() => {
    if (!rawSessions.length || !allQuestions.length) return [];

    const stats: Record<string, { totalScore: number; count: number; latestTimestamp: number; latestScore: number }> = {};
    rawSessions.forEach((session) => {
      const sessionDate = session.created_at || 0;

      session.questions.forEach((qId) => {
        const question = allQuestions.find((q) => q.id === qId);
        const response = session.responses ? session.responses[String(qId)] : null;

        if (question && response && response.rating > 0) {
          const stack = question.stack; // Gets "React" or "Python" specifically

          if (!stats[stack]) {
            stats[stack] = {
              totalScore: 0,
              count: 0,
              latestTimestamp: 0,
              latestScore: 0
            };
          }

          stats[stack].totalScore += response.rating;
          stats[stack].count += 1;

          if (sessionDate >= stats[stack].latestTimestamp) {
             stats[stack].latestTimestamp = sessionDate;
             stats[stack].latestScore = response.rating;
          }
        }
      });
    });

    return Object.entries(stats).map(([stack, data]) => ({
      stack,
      avg: (data.totalScore / data.count).toFixed(1),
      count: data.count,
      lastScore: data.latestScore
    })).sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

  }, [rawSessions, allQuestions]);

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-6xl mx-auto p-4">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-slate-600">Loading candidate data...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!analytics) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-6xl mx-auto p-4">
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-medium mb-2">Candidate not found</p>
              <Button
                onClick={() => navigate(backUrl)}
                className="mt-2 text-xs"
                size="sm"
              >
                <ArrowLeft className="w-3 h-3 mr-1" /> Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const { candidate, history, skills } = analytics;
  const hasHistory = history && history.length > 0;
  const hasSkills = skills && Object.keys(skills).length > 0;

  // Calculate statistics
  const totalInterviews = history.length;
  const avgScore = hasHistory
    ? (history.reduce((acc, h) => acc + h.score, 0) / totalInterviews).toFixed(1)
    : "0.0";
  const skillsAssessed = Object.keys(skills).length;
  const latestInterview = hasHistory ? history[0] : null;

  return (
    <AdminLayout>
      <div>
        <div className="max-w-9xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Candidate Profile
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Performance analytics and interview history for {candidate.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                title="New Interview"
                onClick={() => navigate("/admin/mock-interview/start")}
                className="flex items-center gap-1 px-2 py-0.5 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-all duration-200 text-xs"
              >
                <Play className="w-3 h-3 mr-1" />
              </button>
              <button
                title="Delete Candidate"
                onClick={handleDelete}
                className="flex items-center gap-1 px-2 py-0.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-all duration-200 text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
              </button>
              <button
                title="Back"
                onClick={() => navigate(backUrl)}
                className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Candidate Info Card */}
          <Card className="border border-gray-200 shadow-sm mb-6">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-medium text-slate-800">Candidate Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">{candidate.name}</h3>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="w-3 h-3" /> {candidate.email}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                      <Calendar className="w-3 h-3" />
                      Joined {candidate.created_at ? new Date(candidate.created_at * 1000).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700">
                    <Target className="w-3 h-3 mr-1 inline" /> {totalInterviews} Interviews
                  </Badge>
                  <Badge className="text-xs px-2 py-0.5 bg-green-100 text-green-700">
                    <Star className="w-3 h-3 mr-1 inline" /> {avgScore}/5 Avg
                  </Badge>
                  <Badge className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700">
                    <TrendingUp className="w-3 h-3 mr-1 inline" /> {skillsAssessed} Skills
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Total Interviews</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-blue-600">{totalInterviews}</div>
                {latestInterview && (
                  <div className="text-xs text-slate-500 mt-1">
                    Latest: {latestInterview.stack}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Average Score</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-green-600">{avgScore}/5.0</div>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-3 h-3 ${
                        star <= parseFloat(avgScore)
                        ? "text-yellow-400 fill-yellow-400"
                        : "text-gray-300"
                        }`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Skills Assessed</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold text-purple-600">{skillsAssessed}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {skillsAssessed > 0 ? Object.keys(skills).slice(0, 2).join(", ") : "No skills"}
                  {skillsAssessed > 2 && "..."}
                </div>
              </CardContent>
            </Card>
          </div>


          {techPerformance.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Layers className="w-1 h-4" /> Techwise Performance
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {techPerformance.map((item) => (
                  <Card key={item.stack} className="border border-gray-200 shadow-sm hover:border-blue-300 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-slate-800 text-sm truncate" title={item.stack}>
                          {item.stack}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
                          {item.count} Qs
                        </Badge>
                      </div>

                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xl font-bold text-slate-700">{item.avg}</div>
                          <div className="text-[10px] text-slate-500">Average</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${item.lastScore >= 3 ? 'text-green-600' : 'text-red-500'}`}>
                            {item.lastScore.toFixed(1)}
                          </div>
                          <div className="text-[10px] text-slate-400">Latest</div>
                        </div>
                      </div>

                      <Progress
                        value={(parseFloat(item.avg) / 5) * 100}
                        className="h-1 mt-3"
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interview History */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <History className="w-4 h-4" /> Interview History
                  </CardTitle>
                  {hasHistory && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {totalInterviews} sessions
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {hasHistory ? (
                  <div className="space-y-3">
                    {history.map((h, index) => (
                      <div
                        key={index}
                        className="p-3 border border-gray-200 rounded hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-sm font-medium text-slate-900">{h.stack}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(h.created_at * 1000).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge
                            className={`text-xs px-2 py-0.5 ${
                              h.score >= 4
                              ? "bg-green-100 text-green-700"
                              : h.score >= 3
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                              }`}
                          >
                            {h.score.toFixed(1)}/5.0
                          </Badge>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= h.score
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-gray-300"
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <div className="flex flex-col items-center">
                      <History className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm font-medium mb-1">No interview history</p>
                      <p className="text-xs text-slate-400">
                        Start an interview session to see history here.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills Proficiency */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-slate-800 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" /> Skill Proficiency
                  </CardTitle>
                  {hasSkills && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      {skillsAssessed} skills
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {hasSkills ? (
                  <div className="space-y-3">
                    {Object.entries(skills).map(([stack, score]) => {
                      const percentage = (score / 5) * 100;
                      return (
                        <div key={stack} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-slate-700">{stack}</span>
                            <span className="text-xs font-bold text-indigo-600">{score.toFixed(1)}/5.0</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={percentage} className="h-1.5 flex-1" />
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3 h-3 ${
                                    star <= score
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                    }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <div className="flex flex-col items-center">
                      <BarChart2 className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-sm font-medium mb-1">No skill data</p>
                      <p className="text-xs text-slate-400">
                        Complete interviews to build skill proficiency data.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Performance Trends */}
          {hasHistory && history.length > 1 && (
            <Card className="border border-gray-200 shadow-sm mt-6">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-medium text-slate-800">Performance Trends</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-slate-50 border border-gray-200 rounded">
                    <div className="text-xs font-medium text-slate-500 mb-1">Highest Score</div>
                    <div className="text-lg font-bold text-green-600">
                      {Math.max(...history.map(h => h.score)).toFixed(1)}/5.0
                    </div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 border border-gray-200 rounded">
                    <div className="text-xs font-medium text-slate-500 mb-1">Lowest Score</div>
                    <div className="text-lg font-bold text-red-600">
                      {Math.min(...history.map(h => h.score)).toFixed(1)}/5.0
                    </div>
                  </div>
                  <div className="text-center p-3 bg-slate-50 border border-gray-200 rounded">
                    <div className="text-xs font-medium text-slate-500 mb-1">Improvement</div>
                    <div className="text-lg font-bold text-blue-600">
                      {((history[0].score - history[history.length - 1].score) > 0 ? '+' : '')}
                      {(history[0].score - history[history.length - 1].score).toFixed(1)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={isDeleteDialogOpen}
        title="Are you sure?"
        description="This will remove all their interview history."
        confirmText="Yes, delete candidate!"
        isLoading={isDeleteActionLoading}
        loadingText="Deleting..."
        onOpenChange={(open) => {
          if (!open && !isDeleteActionLoading) {
            setIsDeleteDialogOpen(false);
          }
        }}
        onConfirm={handleDeleteConfirm}
      />
    </AdminLayout>
  );
};

export default CandidateProfile;

