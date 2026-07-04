import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  TrendingUp,
  Award,
  Target,
  Plus,
  Mail,
  Download,
  Eye,
  Send,
  Loader,
  ClipboardList,
  ExternalLink,
  Cpu, // Added for AI assessments
  Trash2,
  X,
  Activity,
  Calendar,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { toast } from "@/hooks/use-toast";
import {
  useLazyGetCandidateDetailsQuery,
  useDeleteAssignmentMutation,
  useUnassignAssignmentMutation,
  useLazyGetCandidateResumeQuery,
  useSendReminderEmailMutation,
} from "@/store";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateValue } from "@/utils/commonFunctions";

const UserDetailView = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status?: number } | null>(null);
  const [activeTab, setActiveTab] = useState("regular");
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false);
  const [assignmentToUnassign, setAssignmentToUnassign] = useState<any>(null);
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [showCourses, setShowCourses] = useState(true);
  const navigate = useNavigate();
  const { id } = useParams();
  const [getCandidateDetails] = useLazyGetCandidateDetailsQuery();
  const [deleteAssignment] = useDeleteAssignmentMutation();
  const [unassignAssignment] = useUnassignAssignmentMutation();
  const [getCandidateResume] = useLazyGetCandidateResumeQuery();
  const [sendReminder] = useSendReminderEmailMutation();

  const fetchUserData = async () => {
    if (!id) {
      setLoading(false);
      setLoadError({ status: 404 });
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getCandidateDetails(Number(id)).unwrap();
      if (!data) {
        setUser(null);
        setLoadError({ status: 404 });
        return;
      }
      setUser(data);
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      setUser(null);
      setLoadError({ status: error?.status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchUserData();
    };
    fetchData();
  }, [id]);



  // Open unassign dialog
  const handleUnassignClick = (assignment: any) => {
    setAssignmentToUnassign(assignment);
    setUnassignDialogOpen(true);
  };

  // Handle unassign course (called after confirmation)
  const handleUnassignConfirm = async () => {
    if (!assignmentToUnassign) return;

    const assignmentId = assignmentToUnassign.assignment_id || assignmentToUnassign.id;
    const technologyName = assignmentToUnassign.technology_name || "course";

    if (!assignmentId) {
      toast({
        title: "Error",
        description: "Assignment ID not found",
        variant: "destructive",
        duration: 3000,
      });
      setUnassignDialogOpen(false);
      setAssignmentToUnassign(null);
      return;
    }

    setIsUnassigning(true);

    try {
      // Try DELETE endpoint first
      try {
        await deleteAssignment(assignmentId).unwrap();
      } catch (deleteError: any) {
        // If DELETE doesn't work, try POST with unassign action
        if (deleteError.status === 404 || deleteError.status === 405) {
          await unassignAssignment(assignmentId).unwrap();
        } else {
          throw deleteError;
        }
      }

      toast({
        title: "Success",
        description: `"${technologyName}" has been unassigned successfully.`,
        variant: "success",
        duration: 3000,
      });

      // Close dialog and reset state
      setUnassignDialogOpen(false);
      setAssignmentToUnassign(null);

      // Refresh user data to reflect the change
      fetchUserData();
    } catch (error: any) {
      console.error("Error unassigning course:", error);
      let errorMessage = "Failed to unassign course. Please try again.";

      if (error.data) {
        if (typeof error.data === 'string') {
          errorMessage = error.data;
        } else if (error.data.detail) {
          errorMessage = error.data.detail;
        } else if (error.data.message) {
          errorMessage = error.data.message;
        }
      }

      toast({
        title: "Unassign Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsUnassigning(false);
    }
  };

  const handleSendReminderMail = async (assignment) => {
    try {
      const assignmentId = assignment.assignment_id || assignment.id;
      const url = `/api/candidates/${candidate.id}/assignments/${assignmentId}/send-reminder-email/`;
      const data = await sendReminder({ url, data: {} }).unwrap();

      toast({
        title: "Success",
        description: data.message || "Reminder email sent successfully",
        variant: "success",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error sending reminder email:", error);
      let errorMessage = "Failed to send reminder email. Please try again.";

      if (error.data?.error) {
        errorMessage = error.data.error;
      } else if (error.data?.message) {
        errorMessage = error.data.message;
      }

      toast({
        title: "Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    }
  };


  const handleViewNotes = (assignment) => {
    if (assignment.user_notes) {
      try {
        if (assignment.user_notes.startsWith('http')) {
          window.open(assignment.user_notes, '_blank');
        } else {
          const notes = JSON.parse(assignment.user_notes);
          if (Array.isArray(notes) && notes.length > 0) {
            window.open(notes[0].url, '_blank');
          }
        }
      } catch (error) {
        console.error("Error parsing user notes:", error);
        window.open(assignment.user_notes, '_blank');
      }
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return "bg-green-500";
    if (progress >= 60) return "bg-blue-500";
    if (progress >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getProgressTextColor = (progress: number) => {
    if (progress >= 80) return "text-green-600";
    if (progress >= 60) return "text-brand-violet";
    if (progress >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'in progress':
      case 'in-progress':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'assigned':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const handleSendSelectionMail = () => { };

  const handleDownloadResume = async () => {
    if (!user?.candidate?.id) return;
    try {
      const data = await getCandidateResume(user.candidate.id).unwrap();
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast({ title: "Error", description: "Could not generate resume download link.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to download resume. Please try again later.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <div className="max-w-3xl mx-auto text-center bg-white border border-slate-200 rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-1">
              Loading...
            </h2>
            <p className="text-slate-600 text-sm">Fetching user details</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!user) {
    const isNotFound = loadError?.status === 404;
    return (
      <AdminLayout>
        <div className="flex min-h-[60vh] w-full items-center justify-center">
          <div className="mx-auto w-full max-w-md text-center bg-white border border-slate-200/70 rounded-2xl shadow-sm p-8">
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${
                isNotFound ? "bg-slate-100 text-slate-400" : "bg-amber-50 text-amber-600"
              }`}
            >
              {isNotFound ? <Eye className="h-6 w-6" /> : <Activity className="h-6 w-6" />}
            </div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 mb-1">
              {isNotFound ? "Learner not found" : "Couldn’t load this learner"}
            </h2>
            <p className="text-slate-500 text-sm mb-5">
              {isNotFound
                ? `No learner exists for ID ${id}. They may have been removed, or the link is out of date.`
                : "Something went wrong while fetching the details. Please check your connection and try again."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {!isNotFound && (
                <button
                  onClick={() => fetchUserData()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
                >
                  Retry
                </button>
              )}
              <Link
                to="/admin/candidates"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Candidates
              </Link>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const candidate = user.candidate || {};
  const assessments = user.assessments || [];
  const aiAssessments = user.ai_assessments || [];

  const getUserInitials = (firstName, lastName) => {
    const first = firstName ? firstName.charAt(0).toUpperCase() : "";
    const last = lastName ? lastName.charAt(0).toUpperCase() : "";
    return first + last || candidate.email
      ? candidate.email.charAt(0).toUpperCase()
      : "U";
  };

  const getFullName = () => {
    const firstName = candidate.first_name || "";
    const lastName = candidate.last_name || "";
    return (
      `${firstName} ${lastName}`.trim() || candidate.username || "Unknown User"
    );
  };

  const formatDate = (dateString) =>
    formatDateValue(dateString, { month: "short", day: "numeric", year: "numeric" }, "N/A");

  const formatAssignmentDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const isOverdue = (dateString: string) => {
    if (!dateString) return false;
    const due = new Date(dateString);
    const today = new Date();
    return due < today;
  };

  const getSafeTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return 0;
    const time = new Date(dateStr).getTime();
    return isNaN(time) ? 0 : time;
  };

  const recentActivities = [
    ...(candidate.learning_assignments || []).map((c: any) => ({
      id: c.assignment_id || c.id,
      type: 'Course',
      name: c.technology_name,
      sortDate: c.last_active || c.completed_date || c.assigned_at,
      assignedDate: c.assigned_at,
      dueDate: c.due_at,
      lastActiveDate: c.last_active,
      status: Math.round(c.progress) === 100 ? 'Completed' : Math.round(c.progress) > 0 ? 'In Progress' : 'Assigned',
      progress: Math.round(c.progress),
      doneText: `${c.completed}/${c.total}`,
      icon: <TechnologyIcon profile={c.technology_name} size={20} />,
      isCourse: true
    })),

    ...assessments.map((a: any) => ({
      id: a.id,
      type: 'Assessment',
      name: a.assessment?.title || 'Assessment',
      sortDate: a.completed_date || a.assigned_date,
      assignedDate: a.assigned_date,
      dueDate: a.due_date,
      lastActiveDate: a.completed_date || a.assigned_date,
      status: a.status,
      progress: a.status === 'completed' ? (a.percentage || 0) : 0,
      doneText: a.status === 'completed' ? `${a.score || 0}/${a.total_marks || 0}` : '-',
      icon: <ClipboardList className="w-5 h-5 text-purple-600" />,
      isCourse: false
    })),

    ...aiAssessments.map((a: any) => ({
      id: a.id,
      ai_assessment_id: a.ai_assessment?.id ?? a.ai_assessment_id ?? a.ai_assessment,
      type: 'AI Assessment',
      name: a.ai_assessment?.title || 'AI Task',
      sortDate: a.completed_date || a.assigned_date,
      assignedDate: a.assigned_date,
      dueDate: a.due_date,
      lastActiveDate: a.completed_date || a.assigned_date,
      status: a.status,
      progress: a.status === 'completed' ? (a.overall_score || 0) : 0,
      doneText: a.status === 'completed' ? `${a.overall_score || 0}%` : '-',
      icon: <Cpu className="w-5 h-5 text-emerald-600" />,
      isCourse: false
    }))
  ]

    .sort((a, b) => getSafeTime(b.sortDate) - getSafeTime(a.sortDate))
    .slice(0, 4);



  const totalAssessments = assessments.length + aiAssessments.length;
  const completedAssessments = assessments.filter(
    (a) => a.status === "completed"
  ).length + aiAssessments.filter(
    (a) => a.status === "completed"
  ).length;

  const assignedAssessments = assessments.filter(
    (a) => a.status === "assigned"
  ).length + aiAssessments.filter(
    (a) => a.status === "assigned"
  ).length;

  const inProgressAssessments = assessments.filter(
    (a) => a.status === "in-progress"
  ).length + aiAssessments.filter(
    (a) => a.status === "in-progress"
  ).length;

  // Filter assessments based on active tab
  const getFilteredAssessments = () => {
    switch (activeTab) {
      case "regular":
        return assessments.map(ass => ({ ...ass, type: 'regular' }));
      case "ai":
        return aiAssessments.map(ass => ({ ...ass, type: 'ai' }));
      case "completed":
        const completedRegular = assessments.filter((a) => a.status === "completed").map(ass => ({ ...ass, type: 'regular' }));
        const completedAI = aiAssessments.filter((a) => a.status === "completed").map(ass => ({ ...ass, type: 'ai' }));
        return [...completedRegular, ...completedAI];
      case "assigned":
        const assignedRegular = assessments.filter((a) => a.status === "assigned").map(ass => ({ ...ass, type: 'regular' }));
        const assignedAI = aiAssessments.filter((a) => a.status === "assigned").map(ass => ({ ...ass, type: 'ai' }));
        return [...assignedRegular, ...assignedAI];
      case "in-progress":
        const inProgressRegular = assessments.filter((a) => a.status === "in-progress").map(ass => ({ ...ass, type: 'regular' }));
        const inProgressAI = aiAssessments.filter((a) => a.status === "in-progress").map(ass => ({ ...ass, type: 'ai' }));
        return [...inProgressRegular, ...inProgressAI];
      default:
        return assessments.map(ass => ({ ...ass, type: 'regular' }));
    }
  };

  const filteredAssessments = getFilteredAssessments();
  // Helper function to get assessment name based on type
  const getAssessmentName = (assessment) => {
    if (assessment.type === 'ai') {
      return assessment.ai_assessment?.title || "Untitled AI Assessment";
    }
    return assessment.assessment?.title || "Untitled Assessment";
  };

  // Helper function to get assessment date based on type
  const getAssessmentDate = (assessment) => {
    if (assessment.type === 'ai') {
      return assessment.assigned_date;
    }
    return assessment.assigned_date;
  };

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-5">
          {/* User Header Section */}
          <div className="p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)] overflow-hidden">
            {/* Avatar and Name Row for Mobile */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Avatar */}
              <div className="w-12 h-12 sm:w-[72px] sm:h-[72px] rounded-full overflow-hidden bg-gradient-to-br from-brand-purple to-brand-violet flex items-center justify-center text-white font-bold text-lg sm:text-2xl shadow-sm flex-shrink-0">
                {candidate?.avatar ? (
                  <img
                    src={candidate.avatar}
                    alt={`${candidate.first_name || ""} ${candidate.last_name || ""}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  getUserInitials(candidate.first_name, candidate.last_name)
                )}
              </div>

              {/* Name + Profile for Mobile */}
              <div className="sm:hidden flex flex-col gap-0.5 flex-1 min-w-0">
                <h1 className="text-sm font-bold text-slate-900 leading-tight truncate">
                  {getFullName()}
                </h1>

                {/* Profile - Mobile */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[8px] uppercase tracking-wide text-slate-400 font-medium">
                    Profile:
                  </span>
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {candidate.profile || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Name + Profile + Info Section */}
            <div className="flex flex-col gap-1 flex-1 w-full sm:w-auto min-w-0">
              {/* Name - Desktop */}
              <h1 className="hidden sm:block text-base font-bold text-slate-900 leading-tight truncate">
                {getFullName()}
              </h1>

              {/* Profile - Desktop */}
              <div className="hidden sm:flex items-baseline gap-1.5">
                <span className="text-[9px] uppercase tracking-wide text-slate-400 font-medium">
                  Profile:
                </span>
                <span className="text-xs font-semibold text-slate-700 truncate">
                  {candidate.profile || "N/A"}
                </span>
              </div>

              {/* Info Fields - Responsive Grid */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 mt-1 sm:mt-1">
                {[
                  ["Username", candidate.username],
                  ["Email", candidate.email],
                  ["Phone", candidate.phone],
                  ["Joined", formatDate(candidate.date_joined)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline gap-1.5 min-w-0"
                  >
                    <span className="text-[8px] sm:text-[9px] uppercase tracking-wide text-slate-400 font-medium whitespace-nowrap">
                      {label}:
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate block max-w-[120px] sm:max-w-none">
                      {value || "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons - Responsive positioning */}
            <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto mt-2 sm:mt-0">
              <button
                title="Back to Candidate"
                onClick={() => {
                  // Get the stored tab preference and navigate back to technologies
                  const activeTab = localStorage.getItem('technologiesActiveTab') || 'courses';
                  navigate(-1);
                }}
                className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                title="Send Selection Mail"
                className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                onClick={handleSendSelectionMail}
              >
                <Send className="w-3.5 h-3.5 text-slate-600" />
              </button>

              <button
                title="Download Resume"
                onClick={handleDownloadResume}
                disabled={!candidate.resume_s3_url}
                className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
              </button>
            </div>
          </div>
          <br />

          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-slate-800">
                Learning Summary
              </h2>
              <button
                title="Assign Study Material"
                className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => navigate(`/admin/assign-study-materials/${candidate.id}`)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">


              {/* Cards */}
              <div className="mb-4">
                {/* Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    {
                      label: "Completed Assessments",
                      value: completedAssessments,
                      icon: TrendingUp,
                      color: "text-brand-violet",
                    },
                    {
                      label: "Assigned Assessments",
                      value: assignedAssessments,
                      icon: ClipboardList,
                      color: "text-brand-violet",
                    },
                    {
                      label: "Total Assessments",
                      value: totalAssessments,
                      icon: BookOpen,
                      color: "text-green-600",
                    },
                    {
                      label: "Learning Assignments",
                      value: candidate.learning_assignments?.length || 0,
                      icon: Award,
                      color: "text-yellow-600",
                    },
                  ].map((stat, index) => (
                    <Card
                      key={index}
                      className="bg-gradient-card shadow-soft hover:shadow-medium 
        transition-all duration-300 hover:scale-[1.03] cursor-default"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">

                          {/* Text */}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {stat.label}
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {stat.value}
                            </p>
                          </div>

                          {/* Icon */}
                          <div className="p-2 rounded-lg bg-secondary flex items-center justify-center">
                            <stat.icon className={`h-5 w-5 ${stat.color}`} />
                          </div>

                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/*  RECENT ACTIVITY  */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-slate-700" />
              <h2 className="text-lg font-bold text-slate-800">
                Recent Activity
              </h2>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                    <tr>
                      <th className="px-4 py-3 min-w-[180px]">Activity</th>
                      <th className="px-4 py-3 min-w-[120px]">Progress</th>
                      <th className="px-4 py-3 min-w-[100px]">Status</th>
                      <th className="px-4 py-3 min-w-[80px]">Done</th>
                      <th className="px-4 py-3 min-w-[100px]">Assigned</th>
                      <th className="px-4 py-3 min-w-[100px]">Due</th>
                      <th className="px-4 py-3 min-w-[100px]">Last Active</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentActivities.length > 0 ? (
                      recentActivities.map((activity, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                {activity.icon}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800">{activity.name}</div>
                                <div className="text-[10px] text-slate-500 uppercase tracking-wide">{activity.type}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{activity.progress}%</span>
                              {activity.isCourse && (
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${getProgressColor(activity.progress)}`}
                                    style={{ width: `${activity.progress}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getStatusColor(activity.status)}`}>
                              {activity.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {activity.doneText}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {activity.assignedDate ? formatDate(activity.assignedDate) : '-'}
                          </td>
                          <td className={`px-4 py-3 ${isOverdue(activity.dueDate) && activity.status !== 'Completed' ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                            {activity.dueDate ? formatDate(activity.dueDate) : '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {activity.lastActiveDate ? formatDate(activity.lastActiveDate) : <span className="text-slate-400">Not Started</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {activity.type === 'Course' ? (
                                <button
                                  onClick={() => navigate(`/admin/assign-study-materials/${candidate.id}`)}
                                  className="p-1.5 text-brand-violet hover:bg-violet-50 rounded border border-slate-200"
                                  title="View Course Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              ) : activity.type === 'Assessment' ? (
                                <button
                                  onClick={() => navigate(`/admin/results/assessment/${activity.id}`)}
                                  className="p-1.5 text-brand-violet hover:bg-violet-50 rounded border border-slate-200"
                                  title="View Result"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button

                                  onClick={() => {
                                    navigate(`/admin/result/ai-assessment/${activity.ai_assessment_id}/report/${activity.id}`)
                                  }}
                                  className="p-1.5 text-brand-violet hover:bg-violet-50 rounded border border-slate-200"
                                  title="View AI Result"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          No recent activity found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          {/*  */}

          {/* Learning Assignments Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-800">
                  Courses
                </h2>
              </div>
              <button
                title="Assign Study Material"
                className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => navigate(`/admin/assign-study-materials/${candidate.id}`)}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {candidate.learning_assignments &&
              candidate.learning_assignments.length > 0 ? (
              <div>
                {/* Collapsed State - Summary Card */}
                {!showCourses && (
                  <div
                    onClick={() => setShowCourses(true)}
                    className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg shadow-sm border border-blue-200 p-4 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          <BookOpen className="w-8 h-8 text-brand-violet" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800 text-sm mb-1">
                            {candidate.learning_assignments.length} Course{candidate.learning_assignments.length > 1 ? 's' : ''} Assigned
                          </h3>
                          <div className="flex flex-wrap gap-3 text-xs text-slate-600">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span>
                                {candidate.learning_assignments.filter(a => Math.round(a.progress) === 100).length} Completed
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                              <span>
                                {candidate.learning_assignments.filter(a => Math.round(a.progress) > 0 && Math.round(a.progress) < 100).length} In Progress
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                              <span>
                                {candidate.learning_assignments.filter(a => Math.round(a.progress) === 0).length} Not Started
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-800">
                              {Math.round(
                                candidate.learning_assignments.reduce((sum, a) => sum + a.progress, 0) /
                                candidate.learning_assignments.length
                              )}%
                            </p>
                            <p className="text-xs text-slate-500">Avg Progress</p>
                          </div>
                          <svg
                            className="w-5 h-5 text-brand-violet group-hover:translate-y-1 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Course Icons Row */}
                    <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-blue-100">
                      {candidate.learning_assignments.map((assignment, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 bg-white rounded-full px-3 py-1.5 shadow-sm"
                          title={assignment.technology_name}
                        >
                          <TechnologyIcon profile={assignment.technology_name} size={18} />
                          <span className="text-xs font-medium text-slate-700">
                            {assignment.technology_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded State - Course Cards */}
                {showCourses && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={() => setShowCourses(false)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors group"
                        title="Collapse courses"
                      >
                        <svg
                          className="w-5 h-5 text-slate-600 group-hover:scale-110 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      </button>
                      <p className="text-xs text-slate-500 font-medium">
                        {candidate.learning_assignments.length} Course{candidate.learning_assignments.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
                     {[...candidate.learning_assignments].sort((a, b) => {
                          const statusOrder = (item: any) => {
                            const p = Math.round(item.progress);
                            if (p > 0 && p < 100) return 0;  // In Progress
                            if (p === 0) return 1;            // Not Started
                            if (p >= 100) return 2;           // Completed
                            return 3;
                          };
                          if (statusOrder(a) !== statusOrder(b)) return statusOrder(a) - statusOrder(b);
                          return b.progress - a.progress;    // highest % first within In Progress
                        }).map((assignment, index) => {
                        const assignedAt = formatAssignmentDate(
                          assignment.assigned_at
                        );
                        const dueAt = formatAssignmentDate(assignment.due_at);
                        const notes =
                          assignment.notes || "Assigned complete technology";
                        const completed = assignment.completed;
                        const total = assignment.total;
                        const progress = Math.round(assignment.progress);
                        const lastActive = assignment.last_active
                          ? formatAssignmentDate(assignment.last_active)
                          : "Not Started";

                        return (
                          <div
                            key={index}
                            className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-200"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 flex-1">
                                <div
                                  className={`w-10 h-10 rounded  flex items-center justify-center`}
                                >
                                  <TechnologyIcon profile={assignment.technology_name} size={28} />
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-semibold text-slate-800 text-sm">
                                    {assignment.technology_name || "Assignment"}
                                  </h3>
                                  <p className="text-xs text-slate-500">
                                    {completed}/{total} completed
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p
                                    className={`text-lg font-bold ${getProgressTextColor(
                                      progress
                                    )}`}
                                  >
                                    {progress}%
                                  </p>
                                </div>
                                {progress !== 100 && (
                                  <button
                                    onClick={() => handleSendReminderMail(assignment)}
                                    className="p-1.5 rounded-full bg-blue-100 text-brand-violet hover:bg-blue-200"
                                    title="Send Reminder Mail"
                                  >
                                    <Mail className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleUnassignClick(assignment)}
                                  title="Unassign Course"
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <div className="mb-3">
                              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${getProgressColor(
                                    progress
                                  )} transition-all duration-500`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>

                            <div className="text-xs text-slate-600 space-y-1 mb-3">
                              <p>
                                <span className="font-semibold text-slate-700">
                                  Assigned:
                                </span>{" "}
                                {assignedAt}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">
                                  Due:
                                </span>{" "}
                                {dueAt}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">
                                  Last Active:
                                </span>{" "}
                                {lastActive}
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="font-semibold text-slate-700">Notes:</span>
                                {assignment.user_notes ? (
                                  <button
                                    title="View notes made by learner"
                                    onClick={() => handleViewNotes(assignment)}
                                    className="ml-2 flex items-center gap-1 text-xs text-brand-violet hover:text-blue-800"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View Notes
                                  </button>
                                ) : (
                                  "NA"
                                )}

                              </p>

                            </div>

                            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                              <div className="flex items-center gap-1">
                                <Target className="w-3 h-3 text-brand-violet" />
                                <div>
                                  <p className="text-xs text-slate-500">Status</p>
                                  <p className="text-xs font-semibold text-slate-800">
                                    {progress === 0
                                      ? "Not Started"
                                      : progress === 100
                                        ? "Completed"
                                        : "In Progress"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Award className="w-3 h-3 text-green-600" />
                                <div>
                                  <p className="text-xs text-slate-500">Type</p>
                                  <p className="text-xs font-semibold text-slate-800">
                                    Learning
                                  </p>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded shadow-sm border border-slate-200 p-6 text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-700 mb-1">
                  No Learning Assignments
                </h3>
                <p className="text-slate-500 text-xs">
                  This candidate has no learning assignments yet.
                </p>
              </div>
            )}
          </div>

          {/* Assessments Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/70 overflow-hidden mb-4 mt-4">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800">
                  Assessments
                </h2>

                <button
                  title="Assign Assessment"
                  className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => navigate(`/admin/assign-assessment/${candidate.id}`, { state: { defaultTab: activeTab } })}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>


              {/* Assessment Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setActiveTab("regular")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "regular"
                    ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  Regular Assessments
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === "regular" ? "bg-white/20" : "bg-slate-300"
                      }`}
                  >
                    {assessments.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("ai")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "ai"
                    ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  <Cpu className="w-3 h-3 inline mr-1" />
                  AI Assessments
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === "ai" ? "bg-white/20" : "bg-slate-300"
                      }`}
                  >
                    {aiAssessments.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("completed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "completed"
                    ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  Completed
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === "completed" ? "bg-white/20" : "bg-slate-300"
                      }`}
                  >
                    {completedAssessments}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("assigned")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "assigned"
                    ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  Assigned
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === "assigned" ? "bg-white/20" : "bg-slate-300"
                      }`}
                  >
                    {assignedAssessments}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("in-progress")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeTab === "in-progress"
                    ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  In Progress
                  <span
                    className={`ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === "in-progress"
                      ? "bg-white/20"
                      : "bg-slate-300"
                      }`}
                  >
                    {inProgressAssessments}
                  </span>
                </button>
              </div>

              {/* Assessment Table */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
             <table className="w-full border-collapse text-xs table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs w-[22%]">
                      Assessment Name
                    </th>
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs whitespace-nowrap w-[12%]">
                      Status
                    </th>
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs whitespace-nowrap w-[14%]">
                      Score
                    </th>
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs whitespace-nowrap w-[12%]">
                      Percentage
                    </th>
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs whitespace-nowrap w-[14%]">
                      Assigned Date
                    </th>
                    <th className="p-2.5 text-left font-semibold text-slate-700 text-xs whitespace-nowrap w-[14%]">
                      Completed Date
                    </th>
                    <th className="p-2.5 text-right font-semibold text-slate-700 text-xs whitespace-nowrap w-[8%]">
                      Actions
                    </th>
                  </tr>
                </thead>
                  <tbody>
                    {filteredAssessments.length > 0 ? (
                      filteredAssessments.map((assessment) => (
                        <tr
                          key={`${assessment.type}-${assessment.id}`}
                          className="border-b border-slate-100 hover:bg-slate-50"
                        >
                          {/* Assessment Name */}
                          <td className="p-3 sm:p-2.5 text-xs text-slate-800 font-medium min-w-[150px]">
                            <div className="truncate max-w-[200px]">
                              {getAssessmentName(assessment)}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-3 sm:p-2.5 text-xs min-w-[100px]">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${assessment.status === "completed"
                                  ? "bg-green-100 text-green-700"
                                  : assessment.status === "assigned"
                                    ? "bg-blue-100 text-blue-700"
                                    : assessment.status === "in-progress"
                                      ? "bg-yellow-100 text-yellow-700"
                                      : "bg-gray-100 text-gray-700"
                                }`}
                            >
                              {assessment.status}
                            </span>
                          </td>

                          {/* Score */}
                          <td className="p-3 sm:p-2.5 text-xs text-slate-800 min-w-[100px]">
                            {assessment.type === 'ai' ? (
                              <span className="whitespace-nowrap">
                                {assessment.overall_score !== undefined
                                  ? `${assessment.overall_score}/10`
                                  : "N/A"}
                              </span>
                            ) : (
                              <span className="whitespace-nowrap">
                                {assessment.score !== undefined &&
                                  assessment.total_marks !== undefined
                                  ? `${assessment.score.toFixed(2)} / ${assessment.total_marks.toFixed(2)}`
                                  : "N/A"}
                              </span>
                            )}
                          </td>

                          {/* Percentage */}
                          <td className="p-3 sm:p-2.5 text-xs text-slate-800 min-w-[80px]">
                            <span className="whitespace-nowrap">
                              {assessment.type === 'ai' ? (
                                assessment.overall_score !== undefined
                                  ? `${((assessment.overall_score / 10) * 100).toFixed(2)}%`
                                  : "N/A"
                              ) : (
                                assessment.percentage !== undefined
                                  ? `${assessment.percentage.toFixed(2)}%`
                                  : "N/A"
                              )}
                            </span>
                          </td>

                          {/* Date */}
                          <td className="p-3 sm:p-2.5 text-xs text-slate-800 min-w-[100px]">
                            <span className="whitespace-nowrap">
                              {formatDate(getAssessmentDate(assessment))}
                          </span>
                          </td>
                              {/* Completed Date */}
                            <td className="p-3 sm:p-2.5 text-xs text-slate-800 min-w-[100px]">
                              <span className="whitespace-nowrap">
                                {assessment.status === "completed"
                                  ? formatDate(assessment.end_time)
                                  : <span className="text-slate-400">—</span>
                                }
                              </span>
            </td>

                          {/* Actions - Always visible with horizontal scroll */}
                          <td className="p-3 sm:p-2.5 text-right min-w-[80px]">
                            {assessment.type === 'regular' ? (
                              <button
                                title="View Result"
                                onClick={() =>
                                  navigate(
                                    `/admin/results/assessment/${assessment.id}`
                                  )
                                }
                                className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>
                            ) : (
                              <button
                                title="View AI Assessment"
                                onClick={() =>
                                  navigate(
                                    `/admin/ai-assessment/${assessment.ai_assessment.id}`
                                  )
                                }
                                className="inline-flex items-center justify-center w-8 h-8 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-6 text-center"
                        >
                          <p className="text-slate-500 text-xs">
                            {activeTab === "ai"
                              ? "No AI assessments assigned"
                              : activeTab === "regular"
                                ? "No regular assessments found"
                                : `No ${activeTab} assessments found`}
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
      {/* Unassign Course Confirmation Dialog */}
      <AlertDialog open={unassignDialogOpen} onOpenChange={setUnassignDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unassign Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unassign "{assignmentToUnassign?.technology_name || "this course"}" from this candidate? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnassignConfirm}
              disabled={isUnassigning}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUnassigning ? "Unassigning..." : "Unassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default UserDetailView;
