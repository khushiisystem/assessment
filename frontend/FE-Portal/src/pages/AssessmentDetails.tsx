import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "@/hooks/use-toast";
import {
  useGetCategoriesQuery,
  useLazyGetAssessmentByIdQuery,
  useLazyGetAssessmentCandidatesByStatusQuery,
  useLazyGetAssessmentCandidatesWithScoreQuery,
  useUnassignAssessmentMutation,
  useUpdateAssessmentMutation,
} from "@/store";
import { useAssessmentQuestions } from "@/hooks/useAssessmentQuestions";
import { AssessmentCandidatesModal } from "@/components/assessments/AssessmentCandidatesModal";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import {
  Assessment,
  AssessmentAssignment,
  AssessmentStats,
  Candidate,
  ModalType,
  Question,
  StatusApiCandidate,
} from "@/components/assessments/AssessmentDetailsTypes";
import { AssessmentHeader } from "@/components/assessments/AssessmentHeader";
import { AssessmentOverviewCard } from "@/components/assessments/AssessmentOverviewCard";
import { AssessmentQuestionBankPanel } from "@/components/assessments/AssessmentQuestionBankPanel";
import { AssessmentQuestionsPanel } from "@/components/assessments/AssessmentQuestionsPanel";
import { AssessmentStatsCards } from "@/components/assessments/AssessmentStatsCards";
import {
  formatDate,
  formatDuration,
  formatSimpleDate,
  getAssignmentStatusColor,
  getAssignmentStatusDisplay,
  getDifficultyColor,
  getMarksDisplay,
  getQuestionTypeDisplay,
  getStatusColor,
  getStatusDisplay,
} from "@/components/assessments/assessmentDetailsUtils";

export const AssessmentDetails: React.FC = () => {
  const [getAssessmentById] = useLazyGetAssessmentByIdQuery();
  const [getAssessmentCandidatesByStatus] = useLazyGetAssessmentCandidatesByStatusQuery();
  const [getAssessmentCandidatesWithScore] = useLazyGetAssessmentCandidatesWithScoreQuery();
  useGetCategoriesQuery();
  const [updateAssessmentMut] = useUpdateAssessmentMutation();
  const [unassignAssessmentMut] = useUnassignAssessmentMutation();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assessmentData, setAssessmentData] = React.useState<Assessment | null>(null);
  const [questions, setQuestions] = React.useState<Question[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<Set<number>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = React.useState(false);

  const [stats, setStats] = React.useState<AssessmentStats>({
    totalAssigned: 0,
    completed: 0,
    inProgress: 0,
    expired: 0,
  });

  const [showModal, setShowModal] = React.useState(false);
  const [modalTitle, setModalTitle] = React.useState("");
  const [modalType, setModalType] = React.useState<ModalType>("all");
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [candidatePage, setCandidatePage] = React.useState(1);
  const [candidatePageSize, setCandidatePageSize] = React.useState(10);
  const [candidateTotalCount, setCandidateTotalCount] = React.useState(0);

  const [selectedUnassignIds, setSelectedUnassignIds] = React.useState<Set<number>>(new Set());
  const [showUnassignDialog, setShowUnassignDialog] = React.useState(false);
  const [unassignLoading, setUnassignLoading] = React.useState(false);

  const refreshAssessmentDetails = React.useCallback(async () => {
    if (!id) return;

    const data = await getAssessmentById(Number(id)).unwrap();
    setAssessmentData(data.assessment);
    setQuestions(data.questions);
    setStats({
      totalAssigned: data.assessment?.total_assigned || 0,
      completed: data.assessment?.completed || 0,
      inProgress: data.assessment?.in_progress || 0,
      expired: data.assessment?.expired || 0,
    });
  }, [getAssessmentById, id]);

  // Question Bank + Auto-fill logic (search, pagination, add, auto-fill, deduped
  // categories) is shared with the CreateAssessment configure flow.
  const questionBank = useAssessmentQuestions(
    id ? Number(id) : null,
    assessmentData?.categories || [],
    refreshAssessmentDetails
  );

  React.useEffect(() => {
    const fetchAssessmentData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        await refreshAssessmentDetails();
      } catch (error) {
        console.error("Error fetching assessment data:", error);
        toast({
          title: "Failed",
          description: "Failed to load assessment details",
          variant: "destructive",
          duration: 3000,
        });
      } finally {
        setLoading(false);
      }
    };

    void fetchAssessmentData();
  }, [id, refreshAssessmentDetails]);

  const fetchCandidates = async (
    type: ModalType,
    page: number = candidatePage,
    pageSize: number = candidatePageSize
  ) => {
    if (!id) return;

    try {
      setLoadingCandidates(true);
      const assessmentId = parseInt(id, 10);

      const statusMap: Record<ModalType, string | null> = {
                all: null,
                completed: "completed",
                inProgress: "in_progress",
                expired: "expired",
              };

      const response = await getAssessmentCandidatesWithScore({
        id: assessmentId,
        status: statusMap[type],
        page,
        page_size: pageSize,
      }).unwrap();

const rawCandidates = (response?.results || []) as StatusApiCandidate[];
      const normalizedCandidates: Candidate[] = rawCandidates.map((rawCandidate) => ({
        id: rawCandidate.id,
        username: rawCandidate.username,
        email: rawCandidate.email,
        first_name: rawCandidate.first_name,
        last_name: rawCandidate.last_name,
        phone: rawCandidate.phone,
        profile: rawCandidate.profile,
        role: "",
        date_joined: rawCandidate.date_joined,
        resume_s3_url: null,
        learning_assignments: [],
        assessment_assignments: [
          {
            candidate_assessment_id: rawCandidate.candidate_assessment_id,
            assessment_id: assessmentId,
            title: assessmentData?.title || "",
            assigned_at: rawCandidate.assigned_at,
            status: rawCandidate.status,
            score: rawCandidate.score,
            total_marks: rawCandidate.total_marks,     
            percentage: rawCandidate.percentage, 
            start_date: rawCandidate.start_time || assessmentData?.start_date || "",
            end_date: rawCandidate.end_time || assessmentData?.end_date || "",
          },
        ],
      }));

      setCandidates(normalizedCandidates);
      setCandidateTotalCount(response?.total_count || 0);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      toast({
        title: "Failed",
        description: "Failed to load candidates",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleOpenModal = (type: ModalType, count: number) => {
    if (count === 0) {
      toast({
        title: "No candidates available",
        description:
          type === "all"
            ? "No candidates assigned to this assessment."
            : type === "completed"
              ? "No candidates have completed this assessment."
              : type === "inProgress"
                ? "No candidates have in-progress assessments."
                : "No candidates have expired assessments.",
        variant: "default",
      });
      return;
    }

    setModalType(type);
    setCandidatePage(1);
    setModalTitle(
      type === "all"
        ? "All Assigned Candidates"
        : type === "completed"
          ? "Completed Assessments"
          : type === "inProgress"
            ? "In Progress Assessments"
            : "Expired Assessments"
    );
    setShowModal(true);
  };

  React.useEffect(() => {
    if (!showModal) return;
    void fetchCandidates(modalType, candidatePage, candidatePageSize);
  }, [candidatePage, candidatePageSize, modalType, showModal]);

  const handleCloseModal = () => {
    setShowModal(false);
    setCandidates([]);
    setSelectedUnassignIds(new Set());
    setCandidateTotalCount(0);
  };

  const toggleUnassignSelection = (candidateAssessmentId: number) => {
    setSelectedUnassignIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateAssessmentId)) next.delete(candidateAssessmentId);
      else next.add(candidateAssessmentId);
      return next;
    });
  };

  const toggleSelectAllUnassign = () => {
    if (selectedUnassignIds.size === candidates.length) {
      setSelectedUnassignIds(new Set());
      return;
    }

    const allIds = new Set<number>();
    candidates.forEach((candidate) => {
      const assignment = candidate.assessment_assignments.find(
        (item) => item.assessment_id === parseInt(id || "0", 10)
      );
      if (assignment) allIds.add(assignment.candidate_assessment_id);
    });
    setSelectedUnassignIds(allIds);
  };

  const handleUnassignConfirm = async () => {
    if (!id || selectedUnassignIds.size === 0) return;

    try {
      setUnassignLoading(true);
      const response = await unassignAssessmentMut({
        id: Number(id),
        data: { candidate_assessment_ids: Array.from(selectedUnassignIds) },
      }).unwrap();

      toast({
        title: "Success",
        description: `${response.unassigned_count} candidate(s) unassigned successfully`,
        duration: 3000,
      });

      setCandidates((prevCandidates) =>
        prevCandidates.filter(
          (candidate) =>
            !candidate.assessment_assignments.some((assignment) =>
              selectedUnassignIds.has(assignment.candidate_assessment_id)
            )
        )
      );

      setSelectedUnassignIds(new Set());
      setShowUnassignDialog(false);

      await refreshAssessmentDetails();
      await fetchCandidates(modalType, candidatePage, candidatePageSize);
    } catch (error) {
      console.error("Error unassigning:", error);
      toast({
        title: "Failed",
        description: "Failed to unassign candidates",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUnassignLoading(false);
    }
  };

  const handleQuestionSelection = (questionId: number) => {
    setSelectedQuestionIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) newSet.delete(questionId);
      else newSet.add(questionId);
      return newSet;
    });
  };

  const handleDeleteAll = () => {
    if (questions.length === 0) return;
    setSelectedQuestionIds(new Set(questions.map((question) => question.id)));
    setShowBulkDeleteDialog(true);
  };

  const handleUnselectAll = () => {
    setSelectedQuestionIds(new Set());
  };

  const handleBulkDeleteClick = () => {
    if (selectedQuestionIds.size === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (!assessmentData || selectedQuestionIds.size === 0 || !id) return;

    const countToDelete = selectedQuestionIds.size;

    try {
      const updatedQuestionIds = assessmentData.question_ids.filter(
        (questionId) => !selectedQuestionIds.has(questionId)
      );

      await updateAssessmentMut({
        id: Number(id),
        data: { ...assessmentData, question_ids: updatedQuestionIds },
      }).unwrap();

      await refreshAssessmentDetails();
      setSelectedQuestionIds(new Set());
      setShowBulkDeleteDialog(false);

      toast({
        title: "Success",
        description: `Removed ${countToDelete} question(s) from assessment`,
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error removing questions:", error);
      toast({
        title: "Failed",
        description: "Failed to remove questions from assessment",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleRemoveQuestion = async (questionId: number) => {
    if (!assessmentData || !id) return;

    try {
      const updatedQuestionIds = assessmentData.question_ids.filter((idItem) => idItem !== questionId);

      await updateAssessmentMut({
        id: Number(id),
        data: { ...assessmentData, question_ids: updatedQuestionIds },
      }).unwrap();

      await refreshAssessmentDetails();

      toast({
        title: "Success",
        description: "Question removed from assessment",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error removing question:", error);
      toast({
        title: "Failed",
        description: "Failed to remove question from assessment",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="w-full">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-violet mx-auto mb-2" />
              <p className="text-sm text-slate-600">Loading assessment details...</p>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!assessmentData) {
    return (
      <AdminLayout>
        <div className="w-full">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Assessment not found</p>
            <button
              onClick={() => navigate("/admin/assessments")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:text-brand-violet"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back to Assessments
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px]">
          <AssessmentHeader
            title={assessmentData.title}
            onBack={() => navigate("/admin/assessments")}
            onAssign={() => navigate(`/admin/assessment/${id}/assign`)}
          />

          <AssessmentStatsCards stats={stats} onOpenModal={handleOpenModal} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <AssessmentOverviewCard
                assessment={assessmentData}
                formatDate={formatDate}
                formatDuration={formatDuration}
                getStatusColor={getStatusColor}
                getStatusDisplay={getStatusDisplay}
              />

              <AssessmentQuestionsPanel
                questions={questions}
                selectedQuestionIds={selectedQuestionIds}
                onQuestionSelection={handleQuestionSelection}
                onUnselectAll={handleUnselectAll}
                onBulkDeleteClick={handleBulkDeleteClick}
                onDeleteAll={handleDeleteAll}
                onRemoveQuestion={handleRemoveQuestion}
                getQuestionTypeDisplay={getQuestionTypeDisplay}
                getDifficultyColor={getDifficultyColor}
                getMarksDisplay={getMarksDisplay}
              />
            </div>

            <div className="lg:col-span-1">
              <AssessmentQuestionBankPanel
                searchQuery={questionBank.searchQuery}
                onSearchQueryChange={questionBank.onSearchQueryChange}
                onSearchSubmit={questionBank.onSearchSubmit}
                onClearSearch={questionBank.onClearSearch}
                loadingQuestions={questionBank.loadingQuestions}
                loadingMoreQuestions={questionBank.loadingMoreQuestions}
                filteredQuestions={questionBank.filteredQuestions}
                totalQuestions={questionBank.totalQuestions}
                hasMoreQuestions={questionBank.hasMoreQuestions}
                assessmentQuestionIds={assessmentData.question_ids}
                onScroll={questionBank.onScroll}
                onAddQuestion={questionBank.onAddQuestion}
                getDifficultyColor={getDifficultyColor}
                getMarksDisplay={getMarksDisplay}
                autoFillRules={questionBank.autoFillRules}
                categories={questionBank.categories}
                isAutoFillValid={questionBank.isAutoFillValid}
                onAddAutoFillRule={questionBank.onAddAutoFillRule}
                onRemoveAutoFillRule={questionBank.onRemoveAutoFillRule}
                onUpdateAutoFillRule={questionBank.onUpdateAutoFillRule}
                onAutoFillQuestions={questionBank.onAutoFillQuestions}
              />
            </div>
          </div>
        </div>
      </div>

      <AssessmentCandidatesModal
        isOpen={showModal}
        modalType={modalType}
        modalTitle={modalTitle}
        loadingCandidates={loadingCandidates}
        candidates={candidates}
        selectedUnassignIds={selectedUnassignIds}
        unassignLoading={unassignLoading}
        candidatePage={candidatePage}
        candidatePageSize={candidatePageSize}
        candidateTotalCount={candidateTotalCount}
        assessmentId={Number(id || 0)}
        onClose={handleCloseModal}
        onOpenUnassignDialog={() => setShowUnassignDialog(true)}
        onToggleSelectAll={toggleSelectAllUnassign}
        onToggleSelection={toggleUnassignSelection}
        onNavigateLearner={(candidateId) => navigate(`/admin/learner/${candidateId}`)}
        onNavigateResult={(candidateAssessmentId) =>
          navigate(`/admin/results/assessment/${candidateAssessmentId}`)
        }
        onSetSingleUnassign={(candidateAssessmentId) => {
          setSelectedUnassignIds(new Set([candidateAssessmentId]));
          setShowUnassignDialog(true);
        }}
        onPageChange={setCandidatePage}
        onPageSizeChange={(pageSize) => {
          setCandidatePageSize(pageSize);
          setCandidatePage(1);
        }}
        formatSimpleDate={formatSimpleDate}
        getAssignmentStatusColor={getAssignmentStatusColor}
        getAssignmentStatusDisplay={getAssignmentStatusDisplay}
      />

      <ConfirmationDialog
        open={showUnassignDialog}
        onOpenChange={setShowUnassignDialog}
        title="Unassign Assessment"
        description={`This will remove the assessment from ${selectedUnassignIds.size} candidate(s) and delete all their responses, proctoring data, and feedback. This action cannot be undone.`}
        confirmText="Unassign"
        loadingText="Unassigning..."
        isLoading={unassignLoading}
        confirmTone="danger"
        onConfirm={handleUnassignConfirm}
      />

      <ConfirmationDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        title="Delete Questions"
        description={`Are you sure you want to remove ${selectedQuestionIds.size} question(s) from this assessment? This action cannot be undone.`}
        confirmText="Delete"
        confirmTone="danger"
        onConfirm={handleBulkDeleteConfirm}
      />
    </AdminLayout>
  );
};
