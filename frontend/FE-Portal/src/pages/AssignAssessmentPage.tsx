import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Search, CheckCircle, Square, CheckSquare, X, ClipboardCheck, Loader2, Calendar, FileText, ArrowLeft } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { INPUT_SM_CLASS, BTN_PRIMARY, BTN_OUTLINE } from "@/lib/uiStyles";
import {
  useLazyGetCandidateDetailsQuery,
  useLazyGetAssessmentsQuery,
  useLazyGetAiAssessmentsQuery,
  useQuickAssignAssessmentMutation,
  useAssignAiAssessmentMutation,
} from "@/store";

type SelectedAssessment =
  | (Assessment & { type: 'regular' })
  | (AiAssessment & { type: 'ai' });

interface Assessment {
  id: number;
  title: string;
  description: string;
  categories: number[];
  question_ids: number[];
  is_active: boolean;
  duration: number;
  start_date: string;
  end_date: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  instructions: string;
  status: string;
  total_candidates: number;
  completed_count: number;
  in_progress_count: number;
  not_started_count: number;
  question_count: number;
  category_names: string[];
}

interface AiAssessment {
  id: number;
  created_by_username: string;
  title: string;
  description: string;
  role_type: string;
  experience_level: string;
  start_date: string;
  end_date: string;
  instructions: string;
  num_questions: number;
  num_hardcoded_questions: number;
  gemini_api_key: string;
  enable_voice_recording: boolean;
  enable_camera: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  status: string;
  role_type_display: string;
  experience_level_display: string;
  total_candidates: number;
  completed_count: number;
  in_progress_count: number;
  not_started_count: number;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  profile: string;
  date_joined: string;
  resume_s3_url: string;
  learning_assignments: Array<{
    technology_id: number;
    technology_name: string;
  }>;
  assessment_assignments: any[];
  candidate?: {
    first_name: string;
    last_name: string;
    email: string;
    profile: string;
    resume_s3_url: string;
  };
  assessments?: Array<{ assessment: { id: number } }>;
  ai_assessments?: Array<{ ai_assessment: { id: number } }>;
}

const AssignAssessmentPage = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // RTK Query hooks
  const [getCandidateDetails] = useLazyGetCandidateDetailsQuery();
  const [getAssessments] = useLazyGetAssessmentsQuery();
  const [getAiAssessments] = useLazyGetAiAssessmentsQuery();
  const [quickAssignMut] = useQuickAssignAssessmentMutation();
  const [assignAiMut] = useAssignAiAssessmentMutation();

  const [user, setUser] = useState<User | null>(null);
  const [availableAssessments, setAvailableAssessments] = useState<Assessment[]>([]);
  const [aiAssessments, setAiAssessments] = useState<AiAssessment[]>([]);
  const [selectedAssessments, setSelectedAssessments] = useState<SelectedAssessment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'regular' | 'ai'>(() => {
    return (location.state as { defaultTab?: 'regular' | 'ai' } | undefined)?.defaultTab || 'regular';
  });
  const [resumeText, setResumeText] = useState('');

  const [isResumeLoading, setIsResumeLoading] = useState(false);
  const [showResumeError, setShowResumeError] = useState(false);
  const [assignedRegularIds, setAssignedRegularIds] = useState<number[]>([]);
  const [assignedAiIds, setAssignedAiIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch user data
  const fetchUser = useCallback(async () => {
    try {
      const userData = await getCandidateDetails(Number(userId)).unwrap();

      setUser(userData);

      // Extract assigned assessment IDs
      const regularIds = userData.assessments?.map((item: any) => item.assessment.id) || [];
      const aiIds = userData.ai_assessments?.map((item: any) => item.ai_assessment.id) || [];

      setAssignedRegularIds(regularIds);
      setAssignedAiIds(aiIds);
    } catch (error) {
      toast({
        title: "Failed",
        description: "Failed to load candidate details",
        variant: "destructive",
      });
    }
  }, [userId, toast, getCandidateDetails]);

  // Fetch assessments with pagination
const fetchAssessments = useCallback(
  async (pageNumber = 1, search = '') => {
    try {
      setLoadingMore(pageNumber !== 1);
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";

      if (activeTab === 'ai') {
        const url = `/my-admin/ai-assessments/?page=${pageNumber}&page_size=50${searchParam}`;
        const responseData: any = await getAiAssessments(url, true).unwrap();

        const extractAiList = (src: any): AiAssessment[] => {
          if (!src) return [];
          if (Array.isArray(src)) return src;
          if (Array.isArray(src.results)) return src.results;
          if (Array.isArray(src.ai_assessments)) return src.ai_assessments;
          if (Array.isArray(src.results?.data)) return src.results.data;
          return [];
        };

        const deriveStatus = (assessment: any) => {
          const rawStatus = typeof assessment.status === 'string' ? assessment.status.toLowerCase() : undefined;
          if (rawStatus) return rawStatus;
          try {
            const now = new Date();
            const start = new Date(assessment.start_date);
            const end = new Date(assessment.end_date);
            if (now < start) return 'upcoming';
            if (now > end) return 'completed';
            return 'active';
          } catch {
            return 'active';
          }
        };

        const ai = extractAiList(responseData).filter((a: any) => {
          const status = deriveStatus(a);
          return a.is_active !== false && status === 'active';
        });

        if (pageNumber === 1) {
          setAiAssessments(ai);
        } else {
          setAiAssessments(prev => {
            const ids = new Set(prev.map(a => a.id));
            return [...prev, ...ai.filter(a => !ids.has(a.id))];
          });
        }

        setHasMore(Boolean(responseData.next));
        setPage(pageNumber);
        return;
      }

      let url = `/my-admin/assessments/?page=${pageNumber}&page_size=50${searchParam}`;
      const responseData = await getAssessments(url, true).unwrap();

      const regular =
        responseData.results?.filter(
          (a: Assessment) => a.is_active && a.status === 'active'
        ) || [];

      if (pageNumber === 1) {
        setAvailableAssessments(regular);
      } else {
        setAvailableAssessments(prev => [...prev, ...regular]);
      }

      setHasMore(Boolean(responseData.next));
      setPage(pageNumber);
    } catch {
      toast({
        title: "Failed",
        description: "Failed to load assessments",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  },
  [toast, getAssessments, getAiAssessments, activeTab]
);


  // Initial data load
  useEffect(() => {
    let isMounted = true;

    const initData = async () => {
      if (!userId || !isMounted) return;
      
      setIsLoading(true);
      try {
        await fetchUser();

      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initData();

    return () => {
      isMounted = false;
    };
  }, [userId, fetchUser, fetchAssessments]);

  // Handle search and tab changes
  useEffect(() => {
    let isMounted = true;

    const fetchWithSearch = async () => {
      if (!isMounted) return;
      
      // Reset to page 1 when search term or tab changes
      await fetchAssessments(1, debouncedSearch);
    };

    fetchWithSearch();

    return () => {
      isMounted = false;
    };
  }, [debouncedSearch, activeTab, fetchAssessments]);

  // Toggle assessment selection
  const toggleAssessmentSelection = useCallback((assessment: Assessment | AiAssessment, type: 'regular' | 'ai') => {
    const alreadyAssigned = type === 'regular' 
      ? assignedRegularIds.includes(assessment.id)
      : assignedAiIds.includes(assessment.id);

    if (alreadyAssigned) {
      toast({
        title: "Already Assigned",
        description: "This assessment is already assigned to the candidate.",
        variant: "default",
        duration: 3000,
      });
      return;
    }

    setSelectedAssessments((prev: SelectedAssessment[]) => {
      const exists = prev.some((a) => a.id === assessment.id && a.type === type);
      if (exists) {
        return prev.filter((a) => !(a.id === assessment.id && a.type === type));
      } else {
        return [...prev, { ...assessment, type } as SelectedAssessment];
      }
    });
  }, [assignedRegularIds, assignedAiIds, toast]);

  // Check if assessment is already assigned
  const isAlreadyAssigned = useCallback((id: number, type: 'regular' | 'ai') => {
    return type === 'regular'
      ? assignedRegularIds.includes(id)
      : assignedAiIds.includes(id);
  }, [assignedRegularIds, assignedAiIds]);

  // Check if assessment is selected
  const isAssessmentSelected = useCallback((assessmentId: number, type: 'regular' | 'ai') => {
    return selectedAssessments.some((a) => a.id === assessmentId && a.type === type);
  }, [selectedAssessments]);

  // Validate form before assignment
  const validateAssignment = useCallback(() => {
    if (selectedAssessments.length === 0) {
      toast({
        title: "Failed",
        description: "Please select at least one assessment",
        variant: "destructive",
        duration: 3000
      });
      return false;
    }

    // Check if AI assessments are selected and resume text is provided
    const hasAiAssessments = selectedAssessments.some(a => a.type === 'ai');
    if (hasAiAssessments && !resumeText.trim()) {
      setShowResumeError(true);
      toast({
        title: "Resume Text Required",
        description: "Please provide resume text for AI assessments",
        variant: "destructive",
        duration: 3000
      });
      return false;
    }

    return true;
  }, [selectedAssessments, resumeText, toast]);

  // Handle assessment assignment
  const handleAssignAssessments = useCallback(async () => {
    if (!validateAssignment() || !userId) return;

    try {
      setIsAssigning(true);

      // Separate regular and AI assessments
      const regularAssessments = selectedAssessments.filter(a => a.type === 'regular');
      const aiAssessments = selectedAssessments.filter(a => a.type === 'ai');

      // Array to store all assignment promises
      const assignmentPromises = [];

      // Handle regular assessments
      for (const assessment of regularAssessments) {
        assignmentPromises.push(
          quickAssignMut({
            userId: Number(userId),
            data: {
              assessment_id: assessment.id,
              assessment_type: assessment.type
            }
          }).unwrap()
        );
      }
      // Handle AI assessments
      for (const assessment of aiAssessments) {
        assignmentPromises.push(
          assignAiMut({
            id: assessment.id,
            data: {
              candidate_ids: [userId],
              resume_text: resumeText
            }
          }).unwrap()
        );
      }

      // Execute all assignments
      const results = await Promise.allSettled(assignmentPromises);

      // Process results
      let successCount = 0;
      let failedAssessments: Array<{ title: string; type: 'regular' | 'ai'; error: any; }> = [];

      results.forEach((result, index) => {
        const assessment = selectedAssessments[index];

        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failedAssessments.push({
            title: assessment.title,
            type: assessment.type,
            error: (result as PromiseRejectedResult).reason?.data || (result as PromiseRejectedResult).reason?.response?.data || (result as PromiseRejectedResult).reason?.message
          });
        }
      });

      if (failedAssessments.length === 0) {
        toast({
          title: "Success",
          description: `${successCount} assessment(s) assigned successfully!`,
          duration: 5000,
          variant: "success"
        });
        navigate(-1);
      } else if (successCount > 0) {
        toast({
          title: "Partial Success",
          description: `${successCount} assessment(s) assigned, ${failedAssessments.length} failed.`,
          duration: 5000,
          variant: "default"
        });
      } else {
        toast({
          title: "Failed",
          description: "Failed to assign all assessments",
          variant: "destructive",
          duration: 5000
        });
      }

      // Refresh user data to update assigned assessments
      await fetchUser();

    } catch (error: any) {
      console.error("Assignment error:", error);

      let errorMessage = "Failed to assign assessments";
      if (error.data?.detail) {
        errorMessage = error.data.detail;
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }

      toast({
        title: "Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsAssigning(false);
    }
  }, [validateAssignment, userId, selectedAssessments, resumeText, navigate, toast, fetchUser]);

  // Filter assessments based on active tab and search term
  const filteredAssessments = useMemo(() => {
    const assessments = activeTab === 'regular' ? availableAssessments : aiAssessments;

    return assessments.filter(a => {
      if (!a) return false;
      
      const searchLower = debouncedSearch.toLowerCase();
      const matchesTitle = a.title.toLowerCase().includes(searchLower);
      
      if (activeTab === 'ai') {
        const aiAssessment = a as AiAssessment;
        const matchesRole = aiAssessment.role_type_display?.toLowerCase().includes(searchLower) || 
                           aiAssessment.role_type?.toLowerCase().includes(searchLower);
        return matchesTitle || matchesRole;
      } else {
        const regularAssessment = a as Assessment;
        const matchesCategory = regularAssessment.category_names?.some(cat => 
          cat.toLowerCase().includes(searchLower)
        );
        return matchesTitle || matchesCategory;
      }
    });
  }, [activeTab, availableAssessments, aiAssessments, debouncedSearch]);

  // Scrollable Assessment List Component
  const ScrollableAssessmentList = ({ assessments }: { assessments: Array<Assessment | AiAssessment> }) => {
    const listRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

      if (
        scrollTop + clientHeight >= scrollHeight - 20 &&
        hasMore &&
        !loadingMore
      ) {
        fetchAssessments(page + 1, debouncedSearch);
      }
    }, [hasMore, loadingMore, page, debouncedSearch, fetchAssessments]);

    if (assessments.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 border border-slate-200 rounded-xl">
          <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">
            No assessments found
          </p>
        </div>
      );
    }

    return (
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto border border-slate-200 rounded-xl h-[calc(100vh-250px)]"
        onScroll={handleScroll}
      >
        <div className="space-y-2 p-2">
          {assessments.map((assessment) => {
            const alreadyAssigned = isAlreadyAssigned(assessment.id, activeTab);
            const isSelected = isAssessmentSelected(assessment.id, activeTab);

            return (
              <div
                key={`${activeTab}_${assessment.id}`}
                className={`border rounded-xl p-2 text-xs transition-colors ${
                  isSelected
                    ? "border-brand-violet/40 bg-brand-violet/5"
                    : alreadyAssigned
                    ? "border-green-200 bg-green-50 opacity-80"
                    : "hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                } ${alreadyAssigned ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={() => !alreadyAssigned && toggleAssessmentSelection(assessment, activeTab)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {alreadyAssigned ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : isSelected ? (
                      <CheckSquare className="w-3 h-3 text-brand-violet" />
                    ) : (
                      <Square className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1 flex-wrap">
                      <h4 className={`font-medium truncate text-xs ${alreadyAssigned ? 'text-slate-500' : 'text-slate-800'}`}>
                        {assessment.title}
                      </h4>
                      <div className="flex gap-0.5">
                        {alreadyAssigned && (
                          <span className="px-1 py-0.5 text-[9px] bg-green-100 text-green-800 rounded">
                            Already Assigned
                          </span>
                        )}
                        {activeTab === 'ai' && (
                          <span className="px-1 py-0.5 text-[9px] bg-purple-100 text-purple-800 rounded whitespace-nowrap">
                            AI Interview
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {activeTab === 'ai'
                        ? `${(assessment as AiAssessment).role_type_display || (assessment as AiAssessment).role_type} • ${(assessment as AiAssessment).experience_level_display || (assessment as AiAssessment).experience_level} • ${(assessment as AiAssessment).num_questions} questions`
                        : `${(assessment as Assessment).question_count} questions • ${(assessment as Assessment).duration} mins • ${(assessment as Assessment).category_names?.join(', ') || 'No categories'}`
                      }
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading more indicator */}
          {loadingMore && (
            <div className="flex justify-center py-2 text-xs text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
              Loading more assessments...
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-brand-violet" />
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-sm text-slate-600">Candidate not found</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          <PageHeader
            title="Assign Assessments"
            description={
              <>
                Select assessments to assign to{" "}
                <span className="font-medium">
                  {user?.candidate?.first_name} {user?.candidate?.last_name}
                </span>
              </>
            }
            className="mb-4"
            actions={
              <div className="flex items-center gap-1">
              <button
                title="Back to Candidates"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 px-2 py-0.5 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all duration-200 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              </div>
            }
          />

          <div className="mb-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('regular')}
                  className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-all duration-300 ${
                    activeTab === "regular"
                      ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Regular Assessments
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-all duration-300 ml-0.5 ${
                    activeTab === "ai"
                      ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  AI Assessments
                </button>
              </div>
              <div className="w-1/2">
                <div className="relative">
                  <Search className="w-5 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder={`Search ${activeTab === 'regular' ? 'regular' : 'AI'} assessments...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${INPUT_SM_CLASS} pl-7 pr-6`}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column - Assessments */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-3">
                  <div className="mb-3">
                    <h3 className="text-xs font-medium text-slate-800">
                      {activeTab === 'regular' ? 'Regular' : 'AI'} Assessments
                      <span className="ml-1 text-[10px] text-slate-500">
                        ({filteredAssessments.length} available)
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Click to select assessments. Already assigned assessments are marked in green.
                    </p>
                  </div>
                  <ScrollableAssessmentList assessments={filteredAssessments} />
                </div>
              </div>
            </div>

            {/* Right Column - Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              {/* Resume Text Section (for AI assessments) */}
              {activeTab === 'ai' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Resume Text for AI Assessments
                      <span className="text-red-500">*</span>
                    </h3>
                    {user?.candidate?.resume_s3_url && (
                      <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                        Resume Available
                      </span>
                    )}
                  </div>

                  {isResumeLoading ? (
                    <div className="flex items-center justify-center gap-1 text-xs text-slate-500 p-6">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Extracting resume text...
                    </div>
                  ) : (
                    <>
                      <textarea
                        value={resumeText}
                        onChange={(e) => {
                          setResumeText(e.target.value);
                          if (showResumeError) setShowResumeError(false);
                        }}
                        placeholder="Paste or type resume text here. This is required for AI assessments to generate relevant questions."
                        className={`w-full px-2 py-1.5 border rounded-xl text-xs min-h-[60px] resize-y ${
                          showResumeError ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-brand-violet/40'
                        } focus:outline-none focus:ring-2 focus:border-transparent`}
                        rows={4}
                        required
                      />
                      {showResumeError && !resumeText.trim() && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          Resume text is required for AI assessments
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        The AI will use this text to generate interview questions tailored to the candidate's experience.
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Candidate Information */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Candidate Information</h2>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      Name: <span className="text-black font-medium">{user?.candidate?.first_name} {user?.candidate?.last_name}</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      Email: <span className="text-black font-medium">{user?.candidate?.email}</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      Profile: <span className="text-black font-medium">{user?.candidate?.profile}</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
  Currently Assigned:{' '}
  <span className="text-black font-medium">
    {activeTab === 'ai'
      ? user?.ai_assessments?.length || 0
      : user?.assessments?.length || 0}
  </span>
</label>

                  </div>
                </div>
              </div>

              {/* Selected Assessments Summary */}
              {selectedAssessments.length > 0 && (
                <div className="bg-brand-violet/5 rounded-2xl shadow-sm border border-brand-violet/20 p-3">
                  <h3 className="text-xs font-medium text-slate-800 mb-2">
                    Selected Assessments ({selectedAssessments.length})
                  </h3>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {selectedAssessments.map((assessment) => (
                      <div key={`${assessment.type}_${assessment.id}`} className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 text-xs">
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-medium truncate">{assessment.title}</span>
                            {assessment.type === 'ai' && (
                              <span className="px-1 py-0.5 text-[9px] bg-purple-100 text-purple-800 rounded">AI</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {assessment.type === 'ai'
                              ? `${(assessment as AiAssessment).num_questions} questions • ${(assessment as AiAssessment).experience_level_display}`
                              : `${(assessment as Assessment).question_count} questions • ${(assessment as Assessment).duration} mins`
                            }
                          </span>
                        </div>
                        <button
                          onClick={() => toggleAssessmentSelection(assessment, assessment.type)}
                          className="text-xs text-red-600 hover:text-red-800 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={isAssigning}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    <ClipboardCheck className="w-4 h-4 text-slate-600" />
                    <span className="text-xs text-slate-700">
                      {selectedAssessments.length} assessment(s) selected
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={handleAssignAssessments}
                      disabled={selectedAssessments.length === 0 || isAssigning}
                      className={`${BTN_PRIMARY} w-full px-3 py-1.5 text-xs`}
                    >
                      {isAssigning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Assigning...
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="w-3 h-3" />
                          Assign {selectedAssessments.length} Assessment(s)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setSelectedAssessments([])}
                      disabled={selectedAssessments.length === 0 || isAssigning}
                      className={`${BTN_OUTLINE} w-full px-3 py-1.5 text-xs`}
                    >
                      Clear All Selections
                    </button>

                    <button
                      onClick={() => navigate(-1)}
                      disabled={isAssigning}
                      className={`${BTN_OUTLINE} w-full px-3 py-1.5 text-xs`}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AssignAssessmentPage;
