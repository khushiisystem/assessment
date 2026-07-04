import React from "react";
import { Eye, Loader2, UserMinus, Users, X } from "lucide-react";
import { Candidate, ModalType } from "./AssessmentDetailsTypes";

interface AssessmentCandidatesModalProps {
  isOpen: boolean;
  modalType: ModalType;
  modalTitle: string;
  loadingCandidates: boolean;
  candidates: Candidate[];
  selectedUnassignIds: Set<number>;
  unassignLoading: boolean;
  candidatePage: number;
  candidatePageSize: number;
  candidateTotalCount: number;
  assessmentId: number;
  onClose: () => void;
  onOpenUnassignDialog: () => void;
  onToggleSelectAll: () => void;
  onToggleSelection: (candidateAssessmentId: number) => void;
  onNavigateLearner: (candidateId: number) => void;
  onNavigateResult: (candidateAssessmentId: number) => void;
  onSetSingleUnassign: (candidateAssessmentId: number) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  formatSimpleDate: (dateString: string) => string;
  getAssignmentStatusColor: (status: string) => string;
  getAssignmentStatusDisplay: (status: string) => string;
}

export const AssessmentCandidatesModal: React.FC<AssessmentCandidatesModalProps> = ({
  isOpen,
  modalType,
  modalTitle,
  loadingCandidates,
  candidates,
  selectedUnassignIds,
  unassignLoading,
  candidatePage,
  candidatePageSize,
  candidateTotalCount,
  assessmentId,
  onClose,
  onOpenUnassignDialog,
  onToggleSelectAll,
  onToggleSelection,
  onNavigateLearner,
  onNavigateResult,
  onSetSingleUnassign,
  onPageChange,
  onPageSizeChange,
  formatSimpleDate,
  getAssignmentStatusColor,
  getAssignmentStatusDisplay,
}) => {
  if (!isOpen) return null;

  // Helper: calculate percentage score from assignment fields
  const calculateScore = (obtainedMarks: number | null | undefined, totalMarks: number | null | undefined): string => {
    if (
      obtainedMarks === null ||
      obtainedMarks === undefined ||
      totalMarks === null ||
      totalMarks === undefined ||
      totalMarks === 0
    ) {
      return "-";
    }
    const percentage = (obtainedMarks / totalMarks) * 100;
    return `${percentage.toFixed(1)}%`;
  };

  // Helper: color badge for score
  const getScoreColor = (obtainedMarks: number | null | undefined, totalMarks: number | null | undefined): string => {
    if (
      obtainedMarks === null ||
      obtainedMarks === undefined ||
      totalMarks === null ||
      totalMarks === undefined ||
      totalMarks === 0
    ) {
      return "bg-slate-100 text-slate-500";
    }
    const percentage = (obtainedMarks / totalMarks) * 100;
    if (percentage >= 75) return "bg-green-100 text-green-700";
    if (percentage >= 50) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-[900px] w-full max-h-[85vh] overflow-hidden mt-4 ml-[15%] flex flex-col">
        <div
          className={`px-4 py-3 border-b flex-shrink-0 ${
            modalType === "all"
              ? "bg-blue-50 border-blue-200"
              : modalType === "completed"
                ? "bg-green-50 border-green-200"
                : modalType === "inProgress"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">{modalTitle}</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {modalType === "all"
                  ? "All candidates assigned to this assessment"
                  : modalType === "completed"
                    ? "Candidates who completed this assessment"
                    : modalType === "inProgress"
                      ? "Candidates with in-progress assessments"
                      : "Candidates with expired assessments"}
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded transition-colors text-slate-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {selectedUnassignIds.size > 0 && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-medium text-red-700">
              {selectedUnassignIds.size} candidate(s) selected
            </span>
            <button
              onClick={onOpenUnassignDialog}
              disabled={unassignLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {unassignLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserMinus className="w-3 h-3" />}
              Unassign Selected
            </button>
          </div>
        )}

        <div className="overflow-auto flex-grow">
          {loadingCandidates ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 mr-2" />
              <p className="text-sm text-slate-600">Loading candidates...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No candidates found</p>
              <p className="text-xs text-slate-500 mt-1">
                {modalType === "all"
                  ? "No candidates have been assigned to this assessment yet"
                  : modalType === "completed"
                    ? "No candidates have completed this assessment yet"
                    : modalType === "inProgress"
                      ? "No candidates have in-progress assessments"
                      : "No candidates have expired assessments"}
              </p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={candidates.length > 0 && selectedUnassignIds.size === candidates.length}
                        onChange={onToggleSelectAll}
                        className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                      />
                    </th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Candidate</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Email</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Profile</th>
                    {modalType === "completed" && (
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Score
                    </th>
                  )}
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Assigned</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {candidates.map((candidate) => {
                    const assessmentAssignment = candidate.assessment_assignments.find(
                      (assignment) => assignment.assessment_id === assessmentId
                    );
                    console.log("assessmentAssignment:", assessmentAssignment);
                    const candidateAssessmentId = assessmentAssignment?.candidate_assessment_id;

                    return (
                      <tr
                        key={candidate.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          Boolean(candidateAssessmentId) && selectedUnassignIds.has(candidateAssessmentId)
                            ? "bg-red-50"
                            : ""
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          {Boolean(candidateAssessmentId) && (
                            <input
                              type="checkbox"
                              checked={selectedUnassignIds.has(candidateAssessmentId)}
                              onChange={() => onToggleSelection(candidateAssessmentId)}
                              className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div>
                              <div
                                className="font-medium text-slate-800 text-xs hover:text-blue-600 hover:underline cursor-pointer"
                                onClick={() => onNavigateLearner(candidate.id)}
                              >
                                {candidate.first_name} {candidate.last_name}
                              </div>
                              {candidate.phone && (
                                <div className="text-xs text-slate-500 mt-0.5">{candidate.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-xs text-slate-800 truncate max-w-[180px]">{candidate.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-xs text-slate-700 truncate max-w-[200px]">
                            {candidate.profile || "-"}
                          </div>
                        </td>

                        {/* ── Score column ── */}
                  {modalType === "completed" ? (
                      <td className="py-2.5 px-3">
                        {assessmentAssignment?.status === "completed" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {assessmentAssignment.percentage.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                    ) : null}

                        <td className="py-2.5 px-3">
                          {assessmentAssignment ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAssignmentStatusColor(assessmentAssignment.status)}`}
                            >
                              {getAssignmentStatusDisplay(assessmentAssignment.status)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="text-xs text-slate-700 whitespace-nowrap">
                            {assessmentAssignment ? formatSimpleDate(assessmentAssignment.assigned_at) : "-"}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            {Boolean(candidateAssessmentId) && (
                              <button
                                title="View Result"
                                onClick={() => onNavigateResult(candidateAssessmentId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 text-xs border border-blue-200"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {Boolean(candidateAssessmentId) && (
                              <button
                                title="Unassign"
                                onClick={() => onSetSingleUnassign(candidateAssessmentId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-red-600 hover:bg-red-50 rounded transition-all duration-200 text-xs border border-red-200"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loadingCandidates && candidates.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0">
            <p className="text-xs text-slate-600">
              Showing {candidates.length} of {candidateTotalCount} candidate(s)
            </p>
            <div className="flex items-center gap-2">
              <select
                value={candidatePageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="px-2 py-1 border border-slate-300 rounded text-xs bg-white"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                onClick={() => onPageChange(Math.max(candidatePage - 1, 1))}
                disabled={candidatePage === 1}
                className="px-3 py-1 border border-slate-300 rounded text-xs text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-slate-600 min-w-[56px] text-center">Page {candidatePage}</span>
              <button
                onClick={() => onPageChange(candidatePage + 1)}
                disabled={candidatePage * candidatePageSize >= candidateTotalCount}
                className="px-3 py-1 border border-slate-300 rounded text-xs text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
