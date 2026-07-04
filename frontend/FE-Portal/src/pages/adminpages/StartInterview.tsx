import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, UserPlus, Layers, Play, Search, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import {
  useLazyGetCandidatesQuery,
  useGetTemplatesQuery,
  useGetMockQuestionsQuery,
  useCreateSessionMutation,
} from "@/store";

export interface RegisteredCandidate {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name?: string;
}

export interface Interviewer {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  name?: string;
}

export interface InterviewTemplate {
  id?: number;
  name: string;
  questions: Array<number | string>;
  created_at?: number;
  updated_at?: number;
}

export interface Question {
  id?: number;
  text: string;
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
  candidate_name: string;
  candidate_email?: string;
  candidate_id?: number;
  candidate_interviewer_name?: string;
  candidate_interviewer_email?: string;
  interviewer_id?: number;
  stack: string;
  status: "active" | "completed";
  version_label: string;
  questions: number[];
  responses: Record<string, CandidateResponse>;
  overall_feedback?: string;
  scheduled_at?:  string;
  created_at?: number;
  updated_at?: number;
}
const ALLOWED_DOMAINS = ["zecdata.com", "technomancerai.com", "bestpeers.com"];
const getDisplayName = (c: RegisteredCandidate): string =>
  `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.username;

const getInterviewerDisplayName = (i: Interviewer): string =>
  `${i.first_name || ""} ${i.last_name || ""}`.trim() || i.username;

const StartInterview: React.FC = () => {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<RegisteredCandidate[]>([]);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isFetchingCandidates, setIsFetchingCandidates] = useState(false);

  // Form State
  const [selectedCandidate, setSelectedCandidate] = useState<RegisteredCandidate | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Candidate search
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showCandidateList, setShowCandidateList] = useState(true);

  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [selectedInterviewer, setSelectedInterviewer] = useState<Interviewer | null>(null);

  const [interviewerSearch, setInterviewerSearch] = useState("");
  const [showInterviewerList, setShowInterviewerList] = useState(true);
  const [isFetchingInterviewers, setIsFetchingInterviewers] = useState(false);

  const [scheduledAt, setScheduledAt] = useState("");

  // RTK Query hooks
  const [getCandidates] = useLazyGetCandidatesQuery();
  const { data: templatesRawData, isLoading: templatesLoading } = useGetTemplatesQuery();
  const { data: questionsRawData, isLoading: questionsLoading } = useGetMockQuestionsQuery();
  const [createSessionMutation] = useCreateSessionMutation();

  // Debounced candidate search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCandidates(candidateSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [candidateSearch]);

  // Debounced interviewer search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInterviewers(interviewerSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [interviewerSearch]);

  const fetchInterviewers = async (search: string) => {
    setIsFetchingInterviewers(true);

    try {
      const params = new URLSearchParams({ search, page_size: "20" });
      const data = await getCandidates(`/my-admin/candidates/?${params.toString()}`).unwrap();
      const results = data?.results ?? data;
      const rawInterviewers = Array.isArray(results)
        ? results
        : (results?.candidates ?? []);

      // const filteredInterviewers = rawInterviewers.filter((i: Interviewer) => {
      //   const domain = i.email?.split("@")[1]?.toLowerCase();
      //   // Correct — all lowercase to match the .toLowerCase() above
      //   return ["zecdata.com", "technomancerai.com", "bestpeers.com"].includes(domain);
      // });

      setInterviewers(rawInterviewers);
    } catch (error) {
      console.error("Error fetching interviewers:", error);
      // Don't block the form, but log the error
    } finally {
      setIsFetchingInterviewers(false);
    }
  };

  const fetchCandidates = async (search: string) => {
    setIsFetchingCandidates(true);
    try {
      const params = new URLSearchParams({ search, page_size: "20" });
      const data = await getCandidates(`/my-admin/candidates/?${params.toString()}`).unwrap();
      const results = data?.results ?? data;
      const rawCandidates = Array.isArray(results)
        ? results
        : (results?.candidates ?? []);

      // const filteredCandidates = rawCandidates.filter((c: RegisteredCandidate) => {
      //   const domain = c.email?.split("@")[1]?.toLowerCase();
      //   return ["zecdata.com", "technomancerai.com", "bestpeers.com"].includes(domain);
      // });

      setCandidates(rawCandidates);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      // Don't block the form, but log error
    } finally {
      setIsFetchingCandidates(false);
    }
  };

  // Sync templates and questions from auto-fetch queries
  useEffect(() => {
    if (templatesRawData) {
      const templatesData = templatesRawData?.results ?? templatesRawData;
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    }
  }, [templatesRawData]);

  useEffect(() => {
    if (questionsRawData) {
      const questionsData = questionsRawData?.results ?? questionsRawData;
      setQuestions(Array.isArray(questionsData) ? questionsData : []);
    }
  }, [questionsRawData]);

  // Load initial candidate/interviewer lists
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await fetchCandidates("");
        await fetchInterviewers("");
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    loadInitialData();
  }, []);

  // Update isLoading from query states
  useEffect(() => {
    if (templatesLoading || questionsLoading) {
      setIsLoading(true);
    } else if (!templatesLoading && !questionsLoading && templatesRawData && questionsRawData) {
      setIsLoading(false);
    }
  }, [templatesLoading, questionsLoading, templatesRawData, questionsRawData]);

  const filteredTemplates = templates.filter((template) =>
    template.name.toLowerCase().includes("")
  );

  const handleStart = async () => {
    if (!selectedCandidate) {
      toast.error("Please select a candidate");
      return;
    }
    if (!selectedTemplateId) {
      toast.error("Please select a template");
      return;
    }
    if (!selectedInterviewer) {
      toast.error("Please select an interviewer");
      return;
    }

    if (selectedCandidate.id === selectedInterviewer.id) {
      toast.error("Candidate and interviewer cannot be the same person");
      return;
    }

    if (!scheduledAt) {
      toast.error("Please select schedule date & time");
      return;
    }

    const template = templates.find((t) => t.id === Number(selectedTemplateId));
    if (!template) {
      toast.error("Template not found");
      return;
    }

    const resolvedQuestions: number[] = template.questions.map((q) => {
    if (typeof q === "number") return q;
    if (typeof q === "string" && /^\d+$/.test(q)) return parseInt(q, 10);
    const found = questions.find((qq) => qq.text && qq.text.trim() === String(q).trim());
    return found?.id ?? NaN;
  })
  .filter((id) => !Number.isNaN(id));
    

    const missing = template.questions.filter((_, idx) => Number.isNaN(resolvedQuestions[idx]));
    if (missing.length > 0) {
      toast.error(`Failed to resolve ${missing.length} template question(s) to IDs.`);
      return;
    }

    setIsStarting(true);
    try {
      await createSessionMutation({
        candidate_name: getDisplayName(selectedCandidate),
        candidate_interviewer_name: getInterviewerDisplayName(selectedInterviewer),
        candidate_interviewer_email: selectedInterviewer.email,
        user_id: selectedCandidate.id,
        stack: template.name,
        version_label: "Standard",
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        questions: resolvedQuestions,
      }).unwrap();
      toast.success("Mock Interview Scheduled!");
      // navigate(`/admin/mock-interview/session/${session.id}`);
      navigate(`/admin/mock-interview`);
    } catch (error) {
      toast.error("Failed to schedule interview");
    } finally {
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-4xl mx-auto p-4">
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-slate-600">Loading data...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Start New Interview</h1>
              <p className="text-sm text-slate-600 mt-1">
                Create a new mock interview session for a registered candidate.
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/mock-interview")}
              className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs mb-2"
            >
              <ArrowLeft className="w-3 h-3" /> Back
            </button>
          </div>

          {/* Start Interview Form */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm font-medium text-slate-800">Interview Setup</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">

              <div className="grid grid-cols-2 gap-4">

              {/* Interviewer Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Select Interviewer</Label>

                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />

                  <Input
                    placeholder="Search interviewer..."
                    value={selectedInterviewer
                          ? getInterviewerDisplayName(selectedInterviewer)
                          : interviewerSearch
                      }
                      readOnly={!!selectedInterviewer}

                      onClick={() => {
                        if (selectedInterviewer) {
                          setSelectedInterviewer(null);
                          setInterviewerSearch("");
                          setShowInterviewerList(true);
                        }
                      }}

                    onChange={(e) => {
                      setInterviewerSearch(e.target.value)
                      setSelectedInterviewer(null)
                      setShowInterviewerList(true)
                    }}
                    className="pl-7 text-xs py-1.5"
                  />

                  {isFetchingInterviewers && (
                    <Loader2 className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin" />
                  )}
                </div>

                {showInterviewerList && (
                  <div className="border border-gray-200 rounded max-h-48 overflow-y-auto">
                    {interviewers.length === 0 && !isFetchingInterviewers ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        No interviewer found
                      </div>
                    ) : (
                      interviewers.map((i) => (
                        <div
                          key={i.id}
                          onClick={() => {
                            setSelectedInterviewer(i)
                            setShowInterviewerList(false)
                            setInterviewerSearch("")
                          }}
                          className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-gray-100 hover:bg-slate-50
                          ${selectedInterviewer?.id === i.id
                              ? "bg-blue-50 border-l-2 border-l-blue-500"
                              : ""
                            }`}
                        >
                          <div>
                          <div className="text-xs font-medium text-slate-800">
                            {getInterviewerDisplayName(i)}
                          </div>
                          <div className="text-[11px] text-slate-500">{i.email}</div>
                        </div>

                          {selectedInterviewer?.id === i.id && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                              Selected
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Candidate Selection */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Select Candidate</Label>
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search by name..."
                      value={
                        selectedCandidate
                          ? getDisplayName(selectedCandidate)
                          : candidateSearch
                      }
                      readOnly={!!selectedCandidate}

                      onClick={() => {
                        if (selectedCandidate) {
                          setSelectedCandidate(null);
                          setCandidateSearch("");
                          setShowCandidateList(true);
                        }
                      }}

                    onChange={(e) => {
                      setCandidateSearch(e.target.value);
                      setSelectedCandidate(null);
                      setShowCandidateList(true);
                    }}
                    className="pl-7 text-xs py-1.5"
                  />
                  {isFetchingCandidates && (
                    <Loader2 className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                </div>

                {/* Candidate List */}
                {showCandidateList && <div className="border border-gray-200 rounded max-h-48 overflow-y-auto">
                  {candidates.length === 0 && !isFetchingCandidates ? (
                    <div className="py-4 text-center text-xs text-slate-400">
                      No candidates found
                    </div>
                  ) : (
                    candidates.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => { setSelectedCandidate(c); setShowCandidateList(false); setCandidateSearch(""); }}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors ${
                          selectedCandidate?.id === c.id
                            ? "bg-green-50 border-l-2 border-l-green-500"
                            : ""
                        }`}
                      >
                        <div>
                          <div className="text-xs font-medium text-slate-800">
                            {getDisplayName(c)}
                          </div>
                          <div className="text-[11px] text-slate-500">{c.email}</div>
                        </div>
                        {selectedCandidate?.id === c.id && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                            Selected
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>}
              </div>
              </div>

              {/* Template Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">Select Interview Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="text-sm py-1.5">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <SelectItem value="no-templates" disabled>
                        No templates available
                      </SelectItem>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <div className="flex justify-between items-center">
                            <span className="text-sm">{t.name}</span>
                            <span className="text-xs text-slate-500 ml-2">{t.questions.length} questions</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    No templates found. Please create one first.
                  </p>
                )}
              </div>

              {/* Schedule Date & Time */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-slate-700">
                  Schedule Date & Time <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="text-sm py-1.5"
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>

              {/* Selected Template Info */}
              {selectedTemplateId && (
                <div className="bg-blue-50 border border-blue-100 p-3 rounded">
                  <div className="flex items-start gap-2">
                    <Layers className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">Template Selected</p>
                      <p className="text-xs text-blue-700">
                        {templates.find((t) => t.id === Number(selectedTemplateId))?.name}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selected Candidate Info */}
              {selectedCandidate && (
                <div className="bg-green-50 border border-green-100 p-3 rounded">
                  <div className="flex items-start gap-2">
                    <UserPlus className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Candidate Selected</p>
                      <p className="text-xs text-green-700">{getDisplayName(selectedCandidate)}</p>
                      <p className="text-xs text-green-600">{selectedCandidate.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedInterviewer && (
                <div className="bg-purple-50 border border-purple-100 p-3 rounded">
                  <div className="flex items-start gap-2">
                    <UserPlus className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-purple-800">
                        Interviewer Selected
                      </p>
                      <p className="text-xs text-purple-700">
                        {getInterviewerDisplayName(selectedInterviewer)}
                      </p>
                      <p className="text-xs text-purple-600">
                        {selectedInterviewer.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {scheduledAt && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded">
                  <div>
                    <p className="text-sm font-medium text-amber-800">Interview Scheduled</p>
                    <p className="text-xs text-amber-700">
                      {new Date(scheduledAt).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  onClick={() => navigate("/admin/mock-interview")}
                  className="flex items-center gap-1 px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={isStarting || !selectedCandidate || !selectedTemplateId}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
                >
                  <Play className="w-3 h-3 mr-1" />
                  {isStarting ? "Starting..." : "Schedule Interview"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default StartInterview;

