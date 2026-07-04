import React, { useState, useEffect } from 'react';
import * as Select from '@radix-ui/react-select';
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { PlusCircle, Cpu, Check, Search, X, ArrowLeft, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useParams } from "react-router-dom";
import { UserMinus } from "lucide-react";
import {
  useLazyGetAssessmentByIdQuery,
  useLazyGetCandidatesQuery,
  useAssignAssessmentMutation,
  useUnassignAssessmentMutation,
} from "@/store";

const AssessmentAssignment = () => {
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [assessmentInfo, setAssessmentInfo] = useState(null);
  const [assigning, setAssigning] = useState(false);
  const { id } = useParams();
  const [alreadyAssignedCandidates, setAlreadyAssignedCandidates] = useState([]);
  const [selectedUnassignIds, setSelectedUnassignIds] = useState(new Set());
  const [showUnassignDialog, setShowUnassignDialog] = useState(false);

  // RTK Query hooks
  const [getAssessmentById] = useLazyGetAssessmentByIdQuery();
  const [getCandidates] = useLazyGetCandidatesQuery();
  const [assignAssessmentMut] = useAssignAssessmentMutation();
  const [unassignAssessmentMut] = useUnassignAssessmentMutation();

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      if (id) {
        try {
          const data = await getAssessmentById(Number(id)).unwrap();
          
          // Calculate difficulty based on questions
          let difficulty = "Intermediate"; // default
          if (data.questions && data.questions.length > 0) {
            const difficulties = data.questions.map(q => q.difficulty);
            const difficultyCounts = {
              easy: difficulties.filter(d => d === 'easy').length,
              medium: difficulties.filter(d => d === 'medium').length,
              hard: difficulties.filter(d => d === 'hard').length
            };
            
            if (difficultyCounts.hard > difficultyCounts.easy && difficultyCounts.hard > difficultyCounts.medium) {
              difficulty = "Advanced";
            } else if (difficultyCounts.easy > difficultyCounts.hard && difficultyCounts.easy > difficultyCounts.medium) {
              difficulty = "Beginner";
            }
          }
          
          setAssessmentInfo({
            title: data.assessment.title,
            end_date: new Date(data.assessment.end_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            description: data.assessment.description || "Python development test covering core concepts",
            duration: `${data.assessment.duration} minutes`,
            questions: data.assessment.question_ids?.length || 0,
            startDate: new Date(data.assessment.start_date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }),
            difficulty: difficulty,
            instructions: data.assessment.instructions,
            categories: data.assessment.categories?.length || 0,
            shuffle_questions: data.assessment.shuffle_questions,
            shuffle_options: data.assessment.shuffle_options,
            is_active: data.assessment.is_active
          });
        } catch (error) {
          console.error("Failed to fetch assessment details:", error);
          // Fallback to default or show error
          toast({
            title: "Failed",
            description: "Failed to load assessment details. Using default information.",
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    };

    fetchAssessmentDetails();
  }, [id]);

  // Fetch candidates from API
  const fetchCandidates = async (page = 1, search = '') => {
    try {
      setLoading(true);
      let url = `/my-admin/candidates/?page=${page}&page_size=${ITEMS_PER_PAGE}`;

      if (search) {
        url += `&search=${encodeURIComponent(search)}`;
      }

      const data = await getCandidates(url).unwrap();

      setCandidates(data.results.candidates || []);
      setTotalCount(data.count || 0);
      setTotalPages(Math.ceil(data.count / ITEMS_PER_PAGE) || 1);

    } catch (error) {
      console.error("Failed to fetch candidates:", error);
      toast({
        title: "Failed",
        description: "Failed to load candidates. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch candidates on component mount and when search/page changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCandidates(currentPage, searchQuery);
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [currentPage, searchQuery]);

  // Fetch already assigned candidates
  const fetchAssignedCandidates = async () => {
  try {
    let page = 1;
    let allCandidates = [];
    let hasNext = true;

    while (hasNext) {
      const data = await getCandidates(`/my-admin/candidates/?page=${page}&page_size=100`).unwrap();

      allCandidates = [
        ...allCandidates,
        ...(data.results?.candidates || [])
      ];

      if (data.next) {
        page += 1;
      } else {
        hasNext = false;
      }
    }

    const assigned = allCandidates.filter(candidate =>
      candidate.assessment_assignments?.some(
        a => a.assessment_id === Number(id)
      )
    );

    setAlreadyAssignedCandidates(assigned);

  } catch (error) {
    console.error("Failed to fetch assigned candidates", error);
  }
};

useEffect(() => {
  if (id) {
    fetchAssignedCandidates();
  }
}, [id]);

  // Toggle candidate selection
  const toggleCandidateSelection = (candidateId) => {
    if (selectedCandidates.includes(candidateId)) {
      setSelectedCandidates(selectedCandidates.filter(id => id !== candidateId));
    } else {
      setSelectedCandidates([...selectedCandidates, candidateId]);
    }
  };

  // Select all filtered candidates
  const selectAllCandidates = () => {
    const allCandidateIds = candidates.map(candidate => candidate.id);
    setSelectedCandidates(allCandidateIds);
  };

  // Deselect all candidates
  const deselectAllCandidates = () => {
    setSelectedCandidates([]);
  };

  // Handle assign to selected candidates
  const handleAssign = async () => {
    if (selectedCandidates.length === 0) {
      toast({
        title: "Failed",
        description: "Please select at least one candidate",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!id) {
      toast({
        title: "Failed",
        description: "No assessment selected. Please select an assessment first.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setAssigning(true);

    try {
      // Assign to each selected candidate
      const assignmentPromises = selectedCandidates.map(async (candidateId) => {
        const candidate = candidates.find(c => c.id === candidateId);
        const userName = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : 'Candidate';

        try {
          await assignAssessmentMut({
            id: Number(id),
            data: { candidate_ids: [candidateId] }
          }).unwrap();

          return {
            success: true,
            userName,
            candidateId
          };
        } catch (error) {
          // Check if it's an "already assigned" error
          const isAlreadyAssigned = error.status === 400 &&
            (error.data?.message?.includes("already assigned") || error.response?.data?.message?.includes("already assigned"));

          return {
            success: false,
            userName,
            candidateId,
            isAlreadyAssigned
          };
        }
      });

      const results = await Promise.all(assignmentPromises);

      // Count successes and failures
      const successfulAssignments = results.filter(r => r.success);
      const failedAssignments = results.filter(r => !r.success);
      const alreadyAssigned = failedAssignments.filter(r => r.isAlreadyAssigned);
      const otherErrors = failedAssignments.filter(r => !r.isAlreadyAssigned);

      // Show appropriate toast messages
      if (successfulAssignments.length > 0) {
        const userNames = successfulAssignments.map(r => r.userName).join(', ');
        toast({
          title: "Success!",
          description: `Assessment assigned to ${successfulAssignments.length} candidate(s): ${userNames}`,
          variant: "success",
          duration: 3000,
        });
      }

      if (alreadyAssigned.length > 0) {
        const userNames = alreadyAssigned.map(r => r.userName).join(', ');
        toast({
          title: "Already Assigned",
          description: `Assessment was already assigned to ${alreadyAssigned.length} candidate(s): ${userNames}`,
          variant: "destructive",
          duration: 3000,
        });
      }

      if (otherErrors.length > 0) {
        toast({
          title: "Partial Failure",
          description: `Failed to assign to ${otherErrors.length} candidate(s). Please try again.`,
          variant: "destructive",
          duration: 3000,
        });
      }

      // Refresh candidate list to show updated assignments
      if (successfulAssignments.length > 0) {
        fetchCandidates(currentPage, searchQuery);
        fetchAssignedCandidates(); // refresh sidebar
      }

      // Clear selection if any successful assignments
      if (successfulAssignments.length > 0) {
        setSelectedCandidates([]);
      }

    } catch (error) {
      console.error("Assignment failed:", error);
      toast({
        title: "Failed",
        description: "Failed to assign assessment. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async(caId) => {
  try {
     await unassignAssessmentMut({
      id: Number(id),
      data: { candidate_assessment_ids: [caId] }
    }).unwrap();
    
    toast({
      title: "Success",
      description: "Candidate unassigned successfully",
      variant: "success",
      duration: 3000,
    });

    // sidebar refresh
    fetchAssignedCandidates();

  } catch (error) {
    console.error("Unassign failed:", error);

    toast({
      title: "Failed",
      description: "Failed to unassign candidate",
      variant: "destructive",
      duration: 3000,
    });
  }
};

  

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          <PageHeader
            title="Assign Assessment"
            description={`Assign ${assessmentInfo?.title || `Assessment #${id}`} to candidates`}
            className="mb-6"
            actions={
              <div className="flex items-center gap-2">
              <button 
                className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded hover:bg-slate-100 transition-all duration-200 text-xs font-medium text-slate-700"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Candidate Selection */}
            <div className="bg-white rounded shadow-sm border border-slate-200 p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                  <Cpu className="w-4 h-4 text-blue-600" />
                  Select Candidates to Assign
                </h2>
                <div className="text-xs text-slate-500">
                  Total: {totalCount} candidates
                </div>
              </div>

              {/* Search Input with Select All/Deselect All Buttons */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page on search
                    }}
                    className="w-full pl-7 pr-3 py-1 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                  />
                </div>
                <button
                  onClick={selectedCandidates.length === candidates.length ? deselectAllCandidates : selectAllCandidates}
                  className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 transition-all duration-200 text-xs font-medium text-slate-700 whitespace-nowrap"
                  disabled={loading}
                >
                  {selectedCandidates.length === candidates.length ? (
                    <>
                      <X className="w-3 h-3" />
                      Deselect All
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      Select All
                    </>
                  )}
                </button>
              </div>

              {/* Candidates List */}
              <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-xs text-slate-600">Loading candidates...</p>
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="text-center py-8">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-600">No candidates found</p>
                    <p className="text-xs text-slate-500 mt-1">Try adjusting your search</p>
                  </div>
                ) : (
                  candidates.map(candidate => {
                    const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
                    const isAssigned =
                      candidate.assessment_assignments &&
                      candidate.assessment_assignments.some(
                        (assignment) => assignment.assessment_id === Number(id)
                      );
                    
                    return (
                      <div 
                        key={candidate.id} 
                        className={`flex items-center gap-2 p-2 rounded border ${isAssigned ? 'bg-green-50 border-green-200' : 'border-slate-200 hover:bg-slate-50'} transition-colors`}
                      >
                        <input 
                          type="checkbox"
                          checked={selectedCandidates.includes(candidate.id)}
                          onChange={() => toggleCandidateSelection(candidate.id)}
                          disabled={isAssigned}
                          className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {fullName || candidate.username}
                            </span>
                            {isAssigned && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                                Assigned
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 truncate">{candidate.email}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {candidate.profile || 'No profile specified'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination */}
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs text-slate-500">
                  Showing {Math.min(candidates.length, ITEMS_PER_PAGE)} of {totalCount} candidates
                  {selectedCandidates.length > 0 && ` (${selectedCandidates.length} selected)`}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || loading}
                    className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-700"
                  >
                    Previous
                  </button>
                  <span className="flex items-center px-2 py-1 text-xs text-slate-700">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || totalPages === 0 || loading}
                    className="flex items-center gap-1 px-2 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-slate-700"
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* Assign Button */}
              <button
                onClick={handleAssign}
                disabled={selectedCandidates.length === 0 || assigning || loading}
                className={`w-full px-3 py-1.5 rounded text-xs font-medium flex items-center justify-center transition-all duration-200 ${
                  selectedCandidates.length > 0 && !assigning && !loading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                }`}
              >
                {assigning ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-3 h-3 mr-1" />
                    Assign to Selected Candidates ({selectedCandidates.length})
                  </>
                )}
              </button>
            </div>

            {/* Right Column - Assessment Information */}
            <div className="space-y-4 lg:col-span-1">
              {/* Assessment Card */}
              {assessmentInfo && (
                <div className="bg-green-50 rounded shadow-sm border border-green-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 text-green-700 font-medium">
                      <Info className="w-3 h-3" />
                      <span className="text-xs">{assessmentInfo.title}</span>
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                        {assessmentInfo.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      ID: {id}
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">Description:</span>
                      <span className="text-slate-800 text-right max-w-[60%]">
                        {assessmentInfo.description || "No description provided"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">Duration:</span>
                      <span className="text-slate-800">{assessmentInfo.duration}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">Questions:</span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                        {assessmentInfo.questions}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">Start Date:</span>
                      <span className="text-slate-800">{assessmentInfo.startDate}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">End Date:</span>
                      <span className="text-slate-800">{assessmentInfo.end_date}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-green-100">
                      <span className="text-slate-600">Difficulty:</span>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        {assessmentInfo.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Already Assigned Card */}
              <div className="bg-amber-50 rounded shadow-sm border border-amber-200 p-4">
                <div className="flex items-center gap-1 text-amber-700 font-medium mb-3">
                  <AlertTriangle className="w-3 h-3" />
                  <h2 className="text-sm font-semibold">Already Assigned To</h2>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {alreadyAssignedCandidates.length === 0 ? (
                    <div className="text-xs text-slate-500 italic bg-slate-50 rounded p-2 text-center">
                      Not assigned to any candidates yet
                    </div>
                  ) : (

                       <div className="space-y-1">
                         {alreadyAssignedCandidates.map(candidate => {
                           const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
                           const assignment = candidate.assessment_assignments?.find(
                           a => a.assessment_id === Number(id)
                         );

                        const caId = assignment?.candidate_assessment_id;

                            return (
                             <div
                                key={candidate.id}
                                className="flex items-center justify-between p-1.5 bg-white rounded border border-slate-200 group"
                             >
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3 text-green-600" />

                               <div className="flex-1">
                                <div className="text-xs font-medium text-slate-800">
                                   {fullName || candidate.username}
                             </div>

                           <div className="text-xs text-slate-500 truncate">
                             {candidate.email}
                          </div>
                     </div>
                 </div>

        <button
          title="Unassign"
           onClick={() => handleUnassign(caId)}
            
          className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-all duration-200 text-xs border border-red-200"
        >
          <UserMinus className="w-3.5 h-3.5" />
          <span className="hidden group-hover:inline">Unassign</span>
        </button>
      </div>
    );
  })}
</div>
 )}

  </div>

</div>
                      
           {/* Assignment Instructions Card */}
              <div className="bg-blue-50 rounded shadow-sm border border-blue-200 p-4">
                <div className="flex items-center gap-1 text-blue-700 font-medium mb-3">
                  <Info className="w-3 h-3" />
                  <h2 className="text-sm font-semibold">Assignment Instructions</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <h3 className="text-xs font-medium text-slate-800 mb-1">Important Notes</h3>
                    <ul className="text-xs text-slate-600 space-y-0.5">
                      <li>• Selected candidates will receive email notifications</li>
                      <li>• Assessment will appear in their dashboard</li>
                      <li>• They can attempt between start and end dates</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium text-slate-800 mb-1">Before Assigning</h3>
                    <ul className="text-xs text-slate-600 space-y-0.5">
                      <li>• Ensure assessment has enough questions</li>
                      <li>• Check start and end dates are correct</li>
                      <li>• Verify duration is appropriate</li>
                    </ul>
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

export default AssessmentAssignment;
