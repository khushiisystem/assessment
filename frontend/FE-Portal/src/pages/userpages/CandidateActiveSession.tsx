import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Star,
  Save,
  Send,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Mail,
  Copy,
  Check,
  Play,
  Clock,
  Layers,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLazyGetMockQuestionsQuery, useLazyGetSessionByIdQuery, useUpdateSessionMutation } from "@/store";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import UserLayout from "@/components/UserLayout";

export interface MockSession {
  id?: number;
  candidate_name: string;
  candidate_email?: string;
  candidate_id?: number;
  stack: string;
  status: "active" | "completed";
  version_label: string;
  questions: number[];
  responses: Record<string, CandidateResponse>;
  overall_feedback?: string;
  created_at?: number;
  updated_at?: number;
}

export interface Question {
  id?: number;
  text: string;
  ideal_answer: string;
  stack: string;
  difficulty: "Junior" | "Mid-Level" | "Senior";
  created_at?: number;
  updated_at?: number;
}

export interface CandidateResponse {
  question_id: number;
  rating: number;
  notes: string;
}

const ActiveSession: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pageParam = searchParams.get("page");
  const backUrl = pageParam ? `/candidate/mock-interview?page=${pageParam}` : "/candidate/mock-interviews";

  const [session, setSession] = useState<MockSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, CandidateResponse>>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [getMockQuestions] = useLazyGetMockQuestionsQuery();
  const [getSessionById] = useLazyGetSessionByIdQuery();
  const [updateSessionMutation] = useUpdateSessionMutation();

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const [sessionData, questionsData] = await Promise.all([
        getSessionById(Number(sessionId)).unwrap(),
        getMockQuestions().unwrap(),
      ]);
      const allQuestions: Question[] = questionsData?.results ?? questionsData;
      setSession(sessionData);
      setResponses(sessionData.responses || {});
      setOverallFeedback(sessionData.overall_feedback || "");

      // Filter questions that are part of this session
      const sessionQuestions = allQuestions.filter((q) =>
        sessionData.questions.includes(q.id!)
      );
      setQuestions(sessionQuestions);
    } catch (error) {
      toast.error("Failed to load session");
      navigate(backUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];
  const currentResponse = currentQuestion
    ? responses[String(currentQuestion.id)]
    : null;

  const handleRatingChange = (rating: number) => {
    if (!currentQuestion) return;
    setResponses((prev) => ({
      ...prev,
      [String(currentQuestion.id)]: {
        ...prev[String(currentQuestion.id)],
        question_id: currentQuestion.id!,
        rating,
        notes: prev[String(currentQuestion.id)]?.notes || "",
      },
    }));
  };

  const handleNotesChange = (notes: string) => {
    if (!currentQuestion) return;
    setResponses((prev) => ({
      ...prev,
      [String(currentQuestion.id)]: {
        ...prev[String(currentQuestion.id)],
        question_id: currentQuestion.id!,
        rating: prev[String(currentQuestion.id)]?.rating || 0,
        notes,
      },
    }));
  };

  const handleSave = async (finish = false, redirectAfterFinish = true) => {
    if (!session) return false;
    setIsSaving(true);
    try {
      await updateSessionMutation({
        id: session.id!,
        data: {
          status: finish ? "completed" : "active",
          overall_feedback: overallFeedback,
          responses,
        },
      }).unwrap();
      toast.success(finish ? "Interview completed!" : "Progress saved");
      if (finish && redirectAfterFinish) {
        navigate(backUrl);
      }
      return true;
    } catch (error) {
      toast.error("Failed to save");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndInterview = async () => {
    if (!session || isSaving || isEnding) return;
    // Only show the custom dialog, do not use window.confirm
    setShowEndDialog(true);
  };

  const handleConfirmEndInterview = async () => {
    if (!session || isSaving || isEnding) return;
    setIsEnding(true);
    const success = await handleSave(true, false);
    setIsEnding(false);
    setShowEndDialog(false);

    if (success) {
      setCurrentIndex(questions.length);
    }
  };

  const handleCopyReport = () => {
    let report = `Candidate: ${session?.candidate_name}\n`;
    report += `Stack: ${session?.stack}\n`;
    report += `Date: ${session?.created_at ? new Date(session.created_at * 1000).toLocaleDateString() : "N/A"}\n`;
    report += `\nOverall Feedback:\n${overallFeedback}\n\n`;
    report += "Question Results:\n";

    questions.forEach((q, index) => {
      const resp = responses[String(q.id)];
      report += `\nQ${index + 1}: ${q.text}\n`;
      report += `Rating: ${resp?.rating || 0}/5\n`;
      if (resp?.notes) {
        report += `Notes: ${resp.notes}\n`;
      }
    });

    navigator.clipboard.writeText(report);
    setCopied(true);
    toast.success("Report copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };
  const stackStats = useMemo(() => {
    if (!questions.length) return [];

    const stats: Record<string, { total: number; count: number }> = {};

    questions.forEach((q) => {
      const rating = responses[String(q.id)]?.rating || 0;

      if (!stats[q.stack]) {
        stats[q.stack] = { total: 0, count: 0 };
      }
      stats[q.stack].total += rating;
      stats[q.stack].count += 1;
    });

    return Object.entries(stats).map(([stack, data]) => ({
      stack,
      avg: (data.total / data.count).toFixed(1),
      count: data.count
    }));
  }, [questions, responses]);

  const answeredCount = Object.keys(responses).filter(
    (key) => responses[key]?.rating > 0
  ).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  if (isLoading) {
    return (
       <UserLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-6xl mx-auto p-4">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-slate-600">Loading session...</p>
            </div>
          </div>
        </div>
       </UserLayout>
    );
  }

  if (!session || questions.length === 0) {
    return (
      <UserLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-6xl mx-auto p-4">
            <div className="text-center py-12 text-slate-500">
              <p className="text-sm font-medium mb-2">Session not found</p>
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
      </UserLayout>
    );
  }

  // If session is completed, show summary view
  if (session.status === "completed") {
    const avgScore =
      answeredCount > 0
        ? Object.values(responses).reduce((acc, r) => acc + (r.rating || 0), 0) / answeredCount
        : 0;

    return (
       <UserLayout>
        <div>
          <div className="max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-xl font-semibold text-slate-800">
                  Interview Results
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Session completed for {session.candidate_name}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  title="Copy Report"
                  onClick={handleCopyReport}
                  className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  title="Back to Dashboard"
                  onClick={() => navigate(backUrl)}
                  className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                >
                  <ArrowLeft className="w-3 h-3" />
                </button>

              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-xs font-medium text-slate-500">Candidate</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{session.candidate_name}</div>
                  {session.candidate_email && (
                    <div className="text-xs text-slate-500 truncate">{session.candidate_email}</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-xs font-medium text-slate-500">Stack</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Badge variant="outline" className="text-xs">{session.stack}</Badge>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-xs font-medium text-slate-500">Questions</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold text-blue-600">{questions.length}</div>
                </CardContent>
              </Card>

              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-xs font-medium text-slate-500">Avg. Score</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-xl font-bold text-green-600">{avgScore.toFixed(1)}/5</div>
                </CardContent>
              </Card>
            </div>
            {stackStats.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Techwise Performance
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {stackStats.map((item) => (
                    <Card key={item.stack} className="border border-gray-200 shadow-sm">
                      <CardContent className="p-3">
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
                            <div className="text-lg font-bold text-slate-700">{item.avg}</div>
                            <div className="text-[10px] text-slate-500">Average</div>
                          </div>
                        </div>

                        <Progress
                          value={(parseFloat(item.avg) / 5) * 100}
                          className={`h-1 mt-3 ${parseFloat(item.avg) >= 3 ? "bg-slate-100" : "bg-red-50"}`}
                        />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {overallFeedback && (
              <Card className="border border-gray-200 shadow-sm mb-6">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-medium text-slate-800">Overall Feedback</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-gray-100">
                    {overallFeedback}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Question Results */}
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-medium text-slate-800">
                  Question Results ({questions.length} questions)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {questions.map((q, index) => {
                    const resp = responses[String(q.id)];
                    return (
                      <div key={q.id} className="border border-gray-200 rounded-lg p-3 hover:bg-slate-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              Q{index + 1}
                            </span>
                            <Badge className={`text-[10px] px-1.5 py-0 ${q.difficulty === "Junior" ? "bg-green-100 text-green-700" :
                                q.difficulty === "Mid-Level" ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                              }`}>
                              {q.difficulty}
                            </Badge>

                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-slate-500 border-slate-300">
                              {q.stack}
                            </Badge>
                          </div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= (resp?.rating || 0)
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                  }`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm font-medium text-slate-800 mb-2">{q.text}</p>
                        {resp?.notes && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-slate-700 mb-1">Notes:</p>
                            <p className="text-xs text-slate-600 bg-gray-50 p-2 rounded border border-gray-100">
                              {resp.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </UserLayout>
    );
  }

  // Active interview view
  return (
    <UserLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1600px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                {session.candidate_name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {session.stack}
                </Badge>
                <Badge className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700">
                  <Clock className="w-3 h-3 mr-1 inline" /> Active
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSave(false, false)}
                disabled={isSaving || isEnding}
                className="flex items-center gap-1 px-2 py-0.5 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-all duration-200 text-xs"
                title="Save Progress"
                type="button"
              >
                <Save className="w-3 h-3" />
                {isSaving ? "Saving..." : "Save"}
              </button>

              <button
                onClick={handleEndInterview}
                disabled={isSaving || isEnding}
                className="flex items-center gap-1 px-2 py-0.5 border border-red-500 text-red-600 rounded hover:bg-red-50 transition-all duration-200 text-xs"
                title="End Interview"
                type="button"
              >
                <Send className="w-3 h-3" />
                {isEnding ? "Ending..." : "End Interview"}
              </button>

              <button
                onClick={() => navigate(backUrl)}
                className="flex items-center gap-1 px-2 py-0.5 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-all duration-200 text-xs"
                title="Exit to Dashboard"
              >
                <ArrowLeft className="w-3 h-3" />Exit
              </button>

            </div>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded shadow-sm border border-gray-200 p-3 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-slate-700">
                Progress: {answeredCount} of {questions.length} answered
              </span>
              <span className="text-xs font-medium text-slate-700">
                {Math.round(progress)}%
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* Current Question */}
          {currentQuestion && (
            <Card className="border border-gray-200 shadow-sm mb-4">
              <CardHeader className="pb-2 pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-700">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs px-2 py-0.5 text-slate-500">
                      {currentQuestion.stack}
                    </Badge>
                    <Badge className={`text-xs px-2 py-0.5 ${currentQuestion.difficulty === "Junior" ? "bg-green-100 text-green-700" :
                      currentQuestion.difficulty === "Mid-Level" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                      {currentQuestion.difficulty}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                {/* Question Text */}
                <div>
                  <h2 className="text-sm font-medium text-slate-800 mb-3">
                    {currentQuestion.text}
                  </h2>
                  <div className="bg-blue-50 border border-blue-100 p-3 rounded">
                    <p className="text-xs font-medium text-blue-700 mb-1">Ideal Answer:</p>
                    <p className="text-xs text-blue-600">{currentQuestion.ideal_answer}</p>
                  </div>
                </div>

                {/* Rating */}
                <div>
                  <Label className="text-xs font-medium text-slate-700 mb-2 block">Rating</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleRatingChange(rating)}
                        className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${currentResponse?.rating === rating
                            ? "border-yellow-400 bg-yellow-50"
                            : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                      >
                        <Star
                          className={`w-4 h-4 ${rating <= (currentResponse?.rating || 0)
                              ? "text-yellow-400 fill-yellow-400"
                              : "text-gray-300"
                            }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <Label className="text-xs font-medium text-slate-700 mb-2 block">Notes</Label>
                  <Textarea
                    placeholder="Add notes about the candidate's response..."
                    value={currentResponse?.notes || ""}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* Navigation */}
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <button
                    onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3 h-3" /> Previous
                  </button>
                  {currentIndex < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentIndex((prev) => prev + 1)}
                      className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Next <ChevronRight className="w-3 h-3" />
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentIndex(questions.length)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Review & Finish <CheckCircle className="w-3 h-3 ml-1" />
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary / Finish View */}
          {currentIndex === questions.length && (
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm font-medium text-slate-800">Complete Interview</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div>
                  <Label className="text-xs font-medium text-slate-700 mb-2 block">Overall Feedback</Label>
                  <Textarea
                    placeholder="Provide overall feedback for the candidate..."
                    value={overallFeedback}
                    onChange={(e) => setOverallFeedback(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setCurrentIndex(questions.length - 1)}
                    className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
                  >
                    <ChevronLeft className="w-3 h-3" /> Back to Questions
                  </button>
                  <button
                    onClick={() => handleSave(true)}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex-1"
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {isSaving ? "Finishing..." : "Finish Interview"}
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {/* Centered and visually appealing ConfirmationDialog */}
      <div className={showEndDialog ? "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 transition-opacity" : "hidden"}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-auto p-6 animate-fade-in">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 bg-red-100 text-red-600 rounded-full p-2 mr-3">
              <Send className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">End Interview</h2>
          </div>
          <p className="text-slate-600 text-sm mb-6">Are you sure you want to end the interview? Your responses will be saved automatically and you will be redirected to the finish page.</p>
          <div className="flex gap-2 justify-end">
            <button
              className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium border border-gray-200"
              onClick={() => setShowEndDialog(false)}
              disabled={isEnding}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
              onClick={handleConfirmEndInterview}
              disabled={isEnding}
            >
              {isEnding ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                  Ending...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" /> End Interview
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default ActiveSession;
