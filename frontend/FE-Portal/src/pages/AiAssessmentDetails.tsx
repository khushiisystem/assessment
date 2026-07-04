import React, { useState, useEffect } from 'react';
import { Users, Settings, Info, UserPlus, UserMinus, User, ArrowLeft, CheckCircle, Search, Activity, BarChart, Brain, Monitor, Loader2, Edit, Sparkles, Filter, Eye } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useLazyGetAiAssessmentByIdQuery, useUnassignAiAssessmentMutation } from '@/store';
import { formatDateValue } from "@/utils/commonFunctions";
import { AI_EXPERIENCE_TO_LABEL_MAP, AI_ROLE_TO_LABEL_MAP } from "@/constants/roleMappings";
import { PageHeader } from "@/components/common/PageHeader";
import { DynamicTable, TableColumn, useTableState } from "@/components/DynamicTable";
import { StatCard } from "@/components/dashboard/StatCard";
import { Dropdown } from "@/components/common/Dropdown";
import { listPageTableStyles } from "@/utils/listPageTableStyles";

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
    role_type_display?: string;
    experience_level_display?: string;
}

interface AssignedCandidate {
    id: number;
    candidate_username: string;
    assigned_by_username: string;
    ai_assessment: AiAssessment;
    assigned_date: string;
    resume_text: string;
    start_time: string | null;
    end_time: string | null;
    status: 'assigned' | 'in_progress' | 'completed';
    generated_questions: any[];
    ai_feedback: string;
    question_wise_verification: any[];
    technical_score: number;
    communication_score: number;
    problem_solving_score: number;
    overall_score: number;
    technical_feedback: string;
    communication_feedback: string;
    problem_solving_feedback: string;
    strengths_feedback: string;
    improvement_feedback: string;
    overall_feedback: string;
    introduction_video_url: string | null;
    introduction_video: string | null;
    assessment_video_url: string | null;
    interview_video: string | null;
    interview_video_url: string | null;
    screenshots: any[];
    periodic_screenshots: any[];
    gesture_analysis: any;
    communication_metrics: any;
    cheating_alerts: any[];
    candidate: number;
    assigned_by: number;
}

interface ApiResponse {
    status: string;
    assessment: AiAssessment;
    assigned_candidates: AssignedCandidate[];
}

export default function AiAssessmentDetails() {
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const navigate = useNavigate();
    const { id } = useParams();

    const [assessment, setAssessment] = useState<AiAssessment | null>(null);
    const [assignedCandidates, setAssignedCandidates] = useState<AssignedCandidate[]>([]);
    const [selectedUnassignIds, setSelectedUnassignIds] = useState<Set<number>>(new Set());
    const [showUnassignDialog, setShowUnassignDialog] = useState(false);
    const [unassignLoading, setUnassignLoading] = useState(false);
    const table = useTableState({ rowsPerPage: 10 });

    const [getAiAssessment] = useLazyGetAiAssessmentByIdQuery();
    const [unassignAiAssessment] = useUnassignAiAssessmentMutation();

    const [assessmentStats, setAssessmentStats] = useState({
        totalAssigned: 0,
        completed: 0,
        inProgress: 0,
        notStarted: 0,
        averageScore: 0,
        averageDuration: '00:00'
    });

    // Fetch assessment data
    useEffect(() => {
        if (id) {
            fetchAssessmentData();
        }
    }, [id]);

    const fetchAssessmentData = async () => {
        setIsLoading(true);
        try {
            const data = await getAiAssessment(Number(id)).unwrap();

            setAssessment(data.assessment);
            setAssignedCandidates(data.assigned_candidates);

            // Calculate statistics
            const total = data.assigned_candidates.length;
            const completed = data.assigned_candidates.filter(c => c.status === 'completed').length;
            const inProgress = data.assigned_candidates.filter(c => c.status === 'in_progress').length;
            const notStarted = data.assigned_candidates.filter(c => c.status === 'assigned').length;

            // Calculate average scores for completed assessments
            const completedCandidates = data.assigned_candidates.filter(c => c.status === 'completed');
            const avgScore = completedCandidates.length > 0
                ? completedCandidates.reduce((sum, c) => sum + c.overall_score, 0) / completedCandidates.length
                : 0;

            setAssessmentStats({
                totalAssigned: total,
                completed,
                inProgress,
                notStarted,
                averageScore: Math.round(avgScore * 10) / 10,
                averageDuration: '00:00' // You would need to calculate this from start/end times
            });

        } catch (error) {
            console.error('Error fetching assessment data:', error);
            toast({
                title: "Error",
                description: "Failed to load assessment details",
                variant: "destructive",
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditAssessment = () => {
        navigate(`/admin/ai-assessment/${id}/edit`);
    };

    const formatDate = (dateString: string) =>
        formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, dateString);

    const formatDateTime = (dateString: string) =>
        formatDateValue(
            dateString,
            { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
            dateString
        );

    // Get status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="text-xs px-2 py-0.5 bg-green-100 text-green-800">Completed</Badge>;
            case 'in_progress':
                return <Badge className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800">In Progress</Badge>;
            case 'assigned':
                return <Badge className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800">Not Started</Badge>;
            default:
                return <Badge className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800">Assigned</Badge>;
        }
    };

    // Get role type display
    const getRoleTypeDisplay = () => {
        if (assessment?.role_type_display) return assessment.role_type_display;
        return AI_ROLE_TO_LABEL_MAP[assessment?.role_type || ""] || assessment?.role_type || 'Unknown Role';
    };

    // Get experience level display
    const getExperienceLevelDisplay = () => {
        if (assessment?.experience_level_display) return assessment.experience_level_display;
        return AI_EXPERIENCE_TO_LABEL_MAP[assessment?.experience_level || ""] || assessment?.experience_level || 'Unknown Level';
    };

    // Calculate AI questions
    const getAiQuestionsCount = () => {
        if (!assessment) return 0;
        return assessment.num_questions - assessment.num_hardcoded_questions;
    };

    // Unassign handlers
    const toggleUnassignSelection = (caId: number) => {
        setSelectedUnassignIds(prev => {
            const next = new Set(prev);
            if (next.has(caId)) next.delete(caId);
            else next.add(caId);
            return next;
        });
    };

    const toggleSelectAllUnassign = () => {
        if (selectedUnassignIds.size === filteredCandidates.length) {
            setSelectedUnassignIds(new Set());
        } else {
            setSelectedUnassignIds(new Set(filteredCandidates.map(c => c.id)));
        }
    };

    const handleUnassignConfirm = async () => {
        if (!id || selectedUnassignIds.size === 0) return;
        try {
            setUnassignLoading(true);
            const data = await unassignAiAssessment({
                id: Number(id),
                data: { candidate_assessment_ids: Array.from(selectedUnassignIds) }
            }).unwrap();
            toast({
                title: "Success",
                description: `${data.unassigned_count} candidate(s) unassigned successfully`,
                duration: 3000,
            });
            setSelectedUnassignIds(new Set());
            setShowUnassignDialog(false);
            fetchAssessmentData();
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

    // Filter candidates based on search and status
    const filteredCandidates = assignedCandidates.filter(candidate => {
        const matchesSearch = candidate.candidate_username.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === 'all' || candidate.status === selectedStatus;
        return matchesSearch && matchesStatus;
    });

    useEffect(() => {
        table.updatePaginationFromResponse(filteredCandidates.length, null, null, 1);
    }, [filteredCandidates.length]);

    const paginatedCandidates = filteredCandidates.slice(
        (table.pagination.currentPage - 1) * 10,
        table.pagination.currentPage * 10
    );

    const candidateColumns: TableColumn<AssignedCandidate>[] = [
        {
            name: 'Candidate',
            selector: (row) => row.candidate_username,
            sortable: true,
            grow: 1.4,
            cell: (row) => (
                <div className="flex flex-col">
                    <span
                        className="cursor-pointer font-medium text-slate-800 transition-colors hover:text-brand-violet"
                        onClick={() => navigate(`/admin/learner/${row.candidate}`)}
                    >
                        {row.candidate_username}
                    </span>
                </div>
            ),
        },
        {
            name: 'Assigned Date',
            selector: (row) => row.assigned_date,
            sortable: true,
            minWidth: "150px",
            cell: (row) => <div className="whitespace-nowrap text-xs text-slate-600">{formatDateTime(row.assigned_date)}</div>,
        },
        {
            name: 'Status',
            selector: (row) => row.status,
            sortable: true,
            cell: (row) => getStatusBadge(row.status),
        },
        {
            name: 'Score',
            selector: (row) => row.overall_score,
            sortable: true,
            cell: (row) => (
                row.status === "completed" ? (
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium">
                            {row.overall_score.toFixed(1)}%
                        </span>
                        <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500"
                                style={{ width: `${row.overall_score}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400">-</span>
                )
            ),
        },
        {
            name: 'Actions',
            cell: (row) => (
                <div className="flex items-center justify-end gap-1.5">
                    <button
                        type="button"
                        title="View result"
                        onClick={() => navigate(`/admin/result/ai-assessment/${id}/report/${row.id}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet"
                    >
                        <Eye className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        title="Unassign candidate"
                        onClick={() => {
                            setSelectedUnassignIds(new Set([row.id]));
                            setShowUnassignDialog(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                    >
                        <UserMinus className="h-4 w-4" />
                    </button>
                </div>
            ),
            ignoreRowClick: true,
            right: true,
        },
    ];

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-brand-violet"></div>
                        <p className="text-sm text-slate-600">Loading assessment details...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (!assessment) {
        return (
            <AdminLayout>
                <div className="flex min-h-[60vh] items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-gray-800 mb-2">Assessment not found</h2>
                        <Button onClick={() => navigate('/admin/assessment-management')}>
                            Back to Assessments
                        </Button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="w-full">
                <div className="mx-auto max-w-[1600px]">
                    <PageHeader
                        className="mb-6"
                        icon={Sparkles}
                        title={`AI Assessment: ${assessment.title}`}
                        description="AI-conducted interview — configuration, candidates and proctoring"
                        actions={
                            <>
                                <button
                                    title="Back to Assessments"
                                    onClick={() => navigate(-1)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </button>

                                <button
                                    title="Edit Assessment"
                                    onClick={handleEditAssessment}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                                >
                                    <Edit className="h-4 w-4" />
                                    Edit
                                </button>

                                <button
                                    title="Assign candidates"
                                    onClick={() => navigate(`/admin/ai-assessment/${assessment.id}/assign`)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Assign Candidates
                                </button>
                            </>
                        }
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]">
                                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                                        <Info className="h-5 w-5" />
                                    </span>
                                    <h2 className="text-base font-bold tracking-tight text-slate-900">Assessment Details</h2>
                                </div>

                                <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
                                    {assessment.description && (
                                        <div className="sm:col-span-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</p>
                                            <p className="mt-1 max-h-24 overflow-y-auto text-sm leading-relaxed text-slate-700">
                                                {assessment.description}
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Title</p>
                                        <p className="mt-1 text-sm font-medium text-slate-700">{assessment.title}</p>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
                                        <span
                                            className={`mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                                assessment.is_active
                                                    ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                                    : "bg-slate-100 text-slate-500 ring-slate-200"
                                            }`}
                                        >
                                            <CheckCircle className="h-3 w-3" />
                                            {assessment.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Role Type</p>
                                        <span className="mt-1 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                                            {getRoleTypeDisplay()}
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Experience Level</p>
                                        <span className="mt-1 inline-flex items-center rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
                                            {getExperienceLevelDisplay()}
                                        </span>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Questions</p>
                                        <p className="mt-1 text-sm font-medium text-slate-700">{assessment.num_questions} total</p>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Start Date</p>
                                        <p className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(assessment.start_date)}</p>
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">End Date</p>
                                        <p className="mt-1 text-sm font-medium text-slate-700">{formatDateTime(assessment.end_date)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]">
                                {/* Header */}
                                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                                        <Users className="h-5 w-5" />
                                    </span>
                                    <div>
                                        <h2 className="text-base font-bold tracking-tight text-slate-900">Assigned Candidates</h2>
                                        <p className="text-xs text-slate-500">Track candidate progress</p>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="border-b border-slate-100 p-4">
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email…"
                                            value={searchQuery}
                                            onChange={(e) => {
                                                setSearchQuery(e.target.value);
                                                table.goToPage(1);
                                            }}
                                            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                                        />
                                    </div>
                                </div>

                                {/* Filters — compact and always visible */}
                                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
                                    <span className="hidden items-center gap-1.5 text-xs font-semibold text-slate-500 sm:flex">
                                        <Filter className="h-3.5 w-3.5" />
                                        Filters
                                    </span>
                                    <Dropdown
                                        value={selectedStatus}
                                        onChange={(v) => {
                                            setSelectedStatus(v);
                                            table.goToPage(1);
                                        }}
                                        options={[
                                            { value: "all", label: "All Status" },
                                            { value: "completed", label: "Completed" },
                                            { value: "in_progress", label: "In Progress" },
                                            { value: "assigned", label: "Not Started" },
                                        ]}
                                        icon={CheckCircle}
                                        className="w-[160px]"
                                        buttonClassName="h-8 !py-0 text-xs"
                                    />

                                    {(searchQuery.trim() || selectedStatus !== "all") && (
                                        <>
                                            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 sm:block" aria-hidden />
                                            {searchQuery.trim() && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-brand-violet ring-1 ring-inset ring-violet-100">
                                                    <span className="opacity-70">Search:</span>
                                                    "{searchQuery}"
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSearchQuery(""); table.goToPage(1); }}
                                                        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
                                                        aria-label="Remove search"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            )}
                                            {selectedStatus !== "all" && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-brand-violet ring-1 ring-inset ring-violet-100">
                                                    <span className="opacity-70">Status:</span>
                                                    {selectedStatus === "completed" ? "Completed" : selectedStatus === "in_progress" ? "In Progress" : "Not Started"}
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedStatus("all"); table.goToPage(1); }}
                                                        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10"
                                                        aria-label="Remove status filter"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchQuery("");
                                                    setSelectedStatus("all");
                                                    setSelectedUnassignIds(new Set());
                                                    table.goToPage(1);
                                                }}
                                                className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                                            >
                                                Clear all
                                            </button>
                                        </>
                                    )}
                                </div>

                                <DynamicTable
                                    className="rounded-none border-0 shadow-none"
                                    customTableStyles={listPageTableStyles}
                                    data={paginatedCandidates}
                                    columns={candidateColumns}
                                    pagination={table.pagination}
                                    rowsPerPage={10}
                                    selectable
                                    onSelectionChange={(selectedRows) => {
                                        setSelectedUnassignIds(new Set(selectedRows.map((row) => row.id)));
                                    }}
                                    onPageChange={(page) => table.goToPage(page)}
                                    itemLabel="candidates"
                                    noDataMessage="No candidates found"
                                    noDataSubMessage="Assign this assessment to candidates to see them here."
                                    isFilterApplied={!!(searchQuery.trim() || selectedStatus !== "all")}
                                    onClearFilters={() => {
                                        setSearchQuery("");
                                        setSelectedStatus("all");
                                        setSelectedUnassignIds(new Set());
                                        table.goToPage(1);
                                    }}
                                    bulkActionBar={
                                        selectedUnassignIds.size > 0 ? (
                                            <div className="flex items-center justify-between border-b border-slate-200 bg-rose-50 px-4 py-3">
                                                <span className="text-xs font-semibold text-rose-700">
                                                    {selectedUnassignIds.size} candidate(s) selected
                                                </span>
                                                <button
                                                    onClick={() => setShowUnassignDialog(true)}
                                                    disabled={unassignLoading}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                                                >
                                                    {unassignLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserMinus className="h-3 w-3" />}
                                                    Unassign Selected
                                                </button>
                                            </div>
                                        ) : undefined
                                    }
                                />
                            </div>
                        </div>
                        <div className="space-y-4 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]">
                            <div className="flex items-center gap-3">
                                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                                    <Sparkles className="h-5 w-5" />
                                </span>
                                <h2 className="text-base font-bold tracking-tight text-slate-900">AI Configuration &amp; Details</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <StatCard
                                    compact
                                    label="Total Assigned"
                                    value={assessmentStats.totalAssigned}
                                    icon={Users}
                                    gradient="from-brand-purple to-brand-violet"
                                />
                                <StatCard
                                    compact
                                    index={1}
                                    label="Completed"
                                    value={assessmentStats.completed}
                                    icon={CheckCircle}
                                    gradient="from-[#0e9f6e] to-[#23c366]"
                                />
                            </div>
                            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
                                <div className="flex items-center gap-1 text-blue-700 font-medium mb-2">
                                    <Activity className="w-3 h-3" />
                                    <span className="text-xs">AI Configuration</span>
                                </div>

                                <div className="space-y-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>AI Model</span>
                                        <span className="font-medium">Gemini API</span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>API Key</span>
                                        <span className="text-cyan-600">
                                            {assessment.gemini_api_key ? 'Custom' : 'System Default'}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>AI Questions</span>
                                        <span className="font-medium text-purple-700">
                                            {getAiQuestionsCount()}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>Hardcoded Questions</span>
                                        <span className="font-medium text-green-700">
                                            {assessment.num_hardcoded_questions}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Proctoring Status */}
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl">
                                <div className="flex items-center gap-1 text-amber-700 font-medium mb-2">
                                    <Monitor className="w-3 h-3" />
                                    <span className="text-xs">Proctoring Status</span>
                                </div>

                                <div className="space-y-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Camera Monitoring</span>
                                        <span className={assessment.enable_camera ? 'text-green-700' : 'text-gray-600'}>
                                            {assessment.enable_camera ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>Voice Recording</span>
                                        <span className={assessment.enable_voice_recording ? 'text-green-700' : 'text-gray-600'}>
                                            {assessment.enable_voice_recording ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>Screenshot Monitoring</span>
                                        <span className="text-green-700">Enabled</span>
                                    </div>
                                </div>
                            </div>

                            {/* Assessment Stats */}
                            <div className="bg-green-50 border border-green-200 p-3 rounded-xl">
                                <div className="flex items-center gap-1 text-green-700 font-medium mb-2">
                                    <Brain className="w-3 h-3" />
                                    <span className="text-xs">Assessment Stats</span>
                                </div>

                                <div className="space-y-2 text-xs text-slate-700">
                                    <div className="flex justify-between">
                                        <span>Completion</span>
                                        <span className="font-medium text-emerald-700">
                                            {assessmentStats.totalAssigned > 0
                                                ? `${((assessmentStats.completed / assessmentStats.totalAssigned) * 100).toFixed(0)}%`
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>In Progress</span>
                                        <span className="font-medium text-yellow-700">
                                            {assessmentStats.inProgress}
                                        </span>
                                    </div>

                                    <div className="flex justify-between">
                                        <span>Not Started</span>
                                        <span className="font-medium text-gray-700">
                                            {assessmentStats.notStarted}
                                        </span>
                                    </div>

                                    {assessmentStats.completed > 0 && (
                                        <div className="flex justify-between">
                                            <span>Average Score</span>
                                            <span className="font-medium text-blue-700">
                                                {assessmentStats.averageScore}%
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* How AI Assessment Works */}
                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                                <div className="flex items-center gap-1 text-slate-700 font-medium mb-2">
                                    <Info className="w-3 h-3" />
                                    <span className="text-xs">How AI Assessment Works</span>
                                </div>

                                <ol className="list-decimal pl-4 text-xs text-slate-700 space-y-1">
                                    <li>Admin assigns assessment to candidates</li>
                                    <li>AI generates personalized questions</li>
                                    <li>Real-time voice and video monitoring</li>
                                    <li>AI analyzes responses and scores candidates</li>
                                    <li>Detailed feedback is generated</li>
                                </ol>
                            </div>

                        </div>

                    </div>
                </div>
            </div>

            {/* Unassign Confirmation Dialog */}
            <AlertDialog open={showUnassignDialog} onOpenChange={setShowUnassignDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unassign AI Assessment</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the assessment from {selectedUnassignIds.size} candidate(s) and delete all their responses and feedback. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={unassignLoading}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleUnassignConfirm}
                            disabled={unassignLoading}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {unassignLoading ? (
                                <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Unassigning...</>
                            ) : (
                                "Unassign"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </AdminLayout>
    );
}
