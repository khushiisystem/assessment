import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, BarChart, Download, Eye, Trash2, Search, Users, MessageSquare, Target, Award, Calendar, Clock, User, TrendingUp, CheckCircle } from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useLazyGetAiAssessmentResultsQuery, useDeleteAiAssessmentCandidateMutation } from '@/store';
import { formatDateValue } from "@/utils/commonFunctions";
import { AI_EXPERIENCE_TO_LABEL_MAP, AI_ROLE_TO_LABEL_MAP } from "@/constants/roleMappings";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";
import { DynamicTable, TableColumn, useTableState } from "@/components/DynamicTable";
import { RowActionIcon } from "@/components/common/RowActionIcon";
import { StatTile } from "@/components/common/StatTile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listPageTableStyles } from "@/utils/listPageTableStyles";

interface Assessment {
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

interface CandidateResult {
    id: number;
    candidate_username: string;
    assigned_by_username: string;
    ai_assessment: Assessment;
    assigned_date: string;
    resume_text: string;
    start_time: string | null;
    end_time: string | null;
    status: 'assigned' | 'in_progress' | 'completed';
    generated_questions: string[];
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

interface Summary {
    total_candidates: number;
    completed_count: number;
    pending_count: number;
    avg_technical: number;
    avg_communication: number;
    avg_problem_solving: number;
    avg_overall: number;
}

interface ApiResponse {
    status: string;
    assessment: Assessment;
    results: CandidateResult[];
    summary: Summary;
}

interface DeleteConfirmationState {
    open: boolean;
    title: string;
    description: string;
    confirmText: string;
    onConfirm: (() => Promise<void>) | null;
}

export default function AiAssessmentResults() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [results, setResults] = useState<CandidateResult[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
        open: false,
        title: "",
        description: "",
        confirmText: "Confirm",
        onConfirm: null,
    });

    const [getAiResults] = useLazyGetAiAssessmentResultsQuery();
    const [deleteCandidate] = useDeleteAiAssessmentCandidateMutation();
    const table = useTableState({ rowsPerPage: 1000 });
    // Fetch results data
    useEffect(() => {
        if (id) {
            fetchResults();
        }
    }, [id]);

    const fetchResults = async () => {
        setIsLoading(true);
        try {
            const data = await getAiResults(Number(id)).unwrap();

            // Single-candidate (interview-style) assessment: open that
            // candidate's report directly instead of the list. Multiple
            // candidates still show the list.
            const list = data.results || [];
            if (list.length === 1 && list[0].status === "completed") {
                navigate(`/admin/result/ai-assessment/${id}/report/${list[0].id}`, { replace: true });
                return;
            }

            setAssessment(data.assessment);
            setResults(list);
            setSummary(data.summary);

        } catch (error) {
            console.error('Error fetching assessment results:', error);
            toast({
                title: "Error",
                description: "Failed to load assessment results",
                variant: "destructive",
                duration: 3000,
            });
        } finally {
            setIsLoading(false);
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

    const formatDate = (dateString: string) =>
        formatDateValue(dateString, { year: "numeric", month: "short", day: "numeric" }, dateString);

    const formatDateTime = (dateString: string) =>
        formatDateValue(
            dateString,
            { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
            dateString
        );

    const openDeleteConfirmation = ({
        title,
        description,
        confirmText,
        onConfirm,
    }: Omit<DeleteConfirmationState, "open">) => {
        setDeleteConfirmation({
            open: true,
            title,
            description,
            confirmText,
            onConfirm,
        });
    };

    const closeDeleteConfirmation = () => {
        setIsDeleteActionLoading(false);
        setDeleteConfirmation((prev) => ({
            ...prev,
            open: false,
            onConfirm: null,
        }));
    };

    const handleDeleteConfirmation = async () => {
        if (!deleteConfirmation.onConfirm) return;
        setIsDeleteActionLoading(true);
        try {
            await deleteConfirmation.onConfirm();
            closeDeleteConfirmation();
        } finally {
            setIsDeleteActionLoading(false);
        }
    };

    // Handle delete result
    const handleDeleteResult = (resultId: number, candidateName: string) => {
        openDeleteConfirmation({
            title: "Are you sure?",
            description: `Delete results for ${candidateName}? This action cannot be undone.`,
            confirmText: "Yes, delete it!",
            onConfirm: async () => {
                try {
                    await deleteCandidate(resultId).unwrap();
                    toast({
                        title: "Success",
                        description: "Result deleted successfully",
                        variant: "success",
                        duration: 3000,
                    });

                    fetchResults();
                } catch (error) {
                    console.error('Error deleting result:', error);
                    toast({
                        title: "Error",
                        description: "Failed to delete result",
                        variant: "destructive",
                        duration: 3000,
                    });
                }
            },
        });
    };

    // Handle download results
    const handleDownloadResults = () => {
        toast({
            title: "Feature Coming Soon",
            description: "Download functionality will be available soon",
            variant: "default",
            duration: 3000,
        });
    };

    // Filter and sort results
    const filteredResults = results
        .filter(result => {
            const matchesSearch = result.candidate_username.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = selectedStatus === 'all' || result.status === selectedStatus;
            return matchesSearch && matchesStatus;
        })

    useEffect(() => {
        table.updatePaginationFromResponse(filteredResults.length, null, null, 1);
    }, [filteredResults.length]);

    const resultColumns: TableColumn<CandidateResult>[] = [
        {
            name: 'Candidate',
            selector: (row) => row.candidate_username,
            sortable: true,
            grow: 1.5,
            cell: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-brand-violet" />
                    </div>
                    <div>
                        <div
                            className="font-medium text-slate-800 hover:text-brand-violet hover:underline cursor-pointer"
                            onClick={() => navigate(`/admin/learner/${row.candidate}`)}
                        >
                            {row.candidate_username}
                        </div>
                        <div className="text-xs text-slate-500">
                            Candidate ID: {row.candidate}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            name: 'Status',
            selector: (row) => row.status,
            sortable: true,
            cell: (row) => {
                if (row.status === 'completed') return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
                if (row.status === 'in_progress') return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In Progress</Badge>;
                return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Not Started</Badge>;
            },
        },
        {
            name: 'Overall Score',
            selector: (row) => row.overall_score,
            sortable: true,
            cell: (row) => (
                <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-slate-800">{row.overall_score.toFixed(2)}</div>
                    <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-violet" style={{ width: `${(row.overall_score / 10) * 100}%` }} />
                    </div>
                </div>
            ),
        },
        {
            name: 'Technical',
            selector: (row) => row.technical_score,
            sortable: true,
            cell: (row) => <div className="font-medium text-slate-800">{row.technical_score.toFixed(1)}</div>,
        },
        {
            name: 'Communication',
            selector: (row) => row.communication_score,
            sortable: true,
            cell: (row) => <div className="font-medium text-slate-800">{row.communication_score.toFixed(1)}</div>,
        },
        {
            name: 'Problem Solving',
            selector: (row) => row.problem_solving_score,
            sortable: true,
            cell: (row) => <div className="font-medium text-slate-800">{row.problem_solving_score.toFixed(1)}</div>,
        },
        {
            name: 'Completed Date',
            selector: (row) => row.end_time || '',
            sortable: true,
            cell: (row) => (
                <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-3 h-3" />
                    {row.end_time ? formatDateTime(row.end_time) : '--'}
                </div>
            ),
        },
        {
            name: 'Actions',
            cell: (row) => (
                <div className="flex items-center justify-end gap-1">
                    <RowActionIcon
                        label={row.status === "completed" ? "View report" : "Report available once completed"}
                        disabled={row.status !== "completed"}
                        onClick={() => navigate(`/admin/result/ai-assessment/${id}/report/${row.id}`)}
                        className="hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet"
                    >
                        <Eye className="h-4 w-4" />
                    </RowActionIcon>
                    <RowActionIcon
                        label="Delete result"
                        onClick={() => handleDeleteResult(row.id, row.candidate_username)}
                        className="hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                    >
                        <Trash2 className="h-4 w-4" />
                    </RowActionIcon>
                </div>
            ),
            ignoreRowClick: true,
            right: true,
        },
    ];

    if (isLoading) {
        return (
            <AdminLayout>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-violet mx-auto mb-4"></div>
                        <p className="text-slate-600">Loading assessment results...</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    if (!assessment || !summary) {
        return (
            <AdminLayout>
                <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-slate-800 mb-2">No results found</h2>
                        <Button onClick={() => navigate(`/admin/ai-assessment/${id}`)}>
                            Back to Assessment
                        </Button>
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
                    <div className="flex items-center justify-between mb-6">
                        <PageHeader
                            title="AI Assessment Results"
                            description="View and analyze candidate performance"
                        />
                        <button title='Back to Results'
                        className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-xs"
                            onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                        </button>
                    </div>

                    <TooltipProvider delayDuration={150}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                        {/* Assessment overview */}
                        <Card>
                            <CardContent className="pt-6">
                                <h2
                                    className="text-xl font-bold text-slate-800 hover:text-brand-violet hover:underline cursor-pointer"
                                    onClick={() => navigate(`/admin/ai-assessment/${id}`)}
                                    title="View Assessment"
                                >
                                    {assessment.title}
                                </h2>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                    <Badge className="bg-violet-100 text-brand-violet hover:bg-violet-100">
                                        {getRoleTypeDisplay()}
                                    </Badge>
                                    <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
                                        {getExperienceLevelDisplay()}
                                    </Badge>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                        <FileText className="w-3 h-3" />
                                        {assessment.num_questions} questions
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(assessment.start_date)} – {formatDate(assessment.end_date)}
                                    </span>
                                </div>

                                {/* Completion progress */}
                                {(() => {
                                    const total = summary.total_candidates || 0;
                                    const done = summary.completed_count || 0;
                                    const pct = total ? Math.round((done / total) * 100) : 0;
                                    const pending = Math.max(total - done, 0);
                                    return (
                                        <div className="mt-5">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium text-slate-700">Candidates completed</span>
                                                <span className="font-semibold text-slate-800">{done} of {total} · {pct}%</span>
                                            </div>
                                            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="mt-1.5 text-xs text-slate-400">
                                                {pending === 0
                                                    ? "Everyone has finished the interview."
                                                    : `${pending} candidate${pending === 1 ? "" : "s"} still to finish.`}
                                            </p>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* Average Scores */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-semibold text-slate-700">
                                    Average Scores
                                </CardTitle>
                                <p className="text-xs text-slate-400">
                                    Mean across the {summary.completed_count} completed candidate{summary.completed_count === 1 ? "" : "s"} · each score is out of 10.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <StatTile
                                        className="bg-purple-50"
                                        valueClassName="text-purple-600"
                                        icon={<Target className="w-4 h-4 text-purple-600" />}
                                        value={summary.avg_technical.toFixed(1)}
                                        label="Technical"
                                        hint="Depth of technical and domain knowledge shown in the candidate's answers. Scored out of 10."
                                    />
                                    <StatTile
                                        className="bg-teal-50"
                                        valueClassName="text-teal-600"
                                        icon={<MessageSquare className="w-4 h-4 text-teal-600" />}
                                        value={summary.avg_communication.toFixed(1)}
                                        label="Communication"
                                        hint="How clearly and concisely the candidate explained their thinking. Scored out of 10."
                                    />
                                    <StatTile
                                        className="bg-orange-50"
                                        valueClassName="text-orange-600"
                                        icon={<BarChart className="w-4 h-4 text-orange-600" />}
                                        value={summary.avg_problem_solving.toFixed(1)}
                                        label="Problem Solving"
                                        hint="Quality of the candidate's approach and reasoning when working through problems. Scored out of 10."
                                    />
                                    <StatTile
                                        className="bg-violet-50"
                                        valueClassName="text-brand-violet"
                                        icon={<Award className="w-4 h-4 text-brand-violet" />}
                                        value={summary.avg_overall.toFixed(1)}
                                        label="Overall"
                                        hint="Overall performance — the combined average of the technical, communication and problem-solving scores. Out of 10."
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    </TooltipProvider>

                    {/* Results Table Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <h2 className="text-lg font-semibold text-slate-800">Candidate Results</h2>

                        <div className="flex flex-wrap gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="Search candidates..."
                                    className="pl-10 h-9 w-48"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="h-9 w-36">
                                    <SelectValue placeholder="Filter by status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="assigned">Not Started</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Results Table */}
                    <Card>
                        <CardContent className="p-0">
                            <DynamicTable
                                className="rounded-none border-0 shadow-none"
                                customTableStyles={listPageTableStyles}
                                data={filteredResults}
                                columns={resultColumns}
                                pagination={table.pagination}
                                showPagination={false}
                                itemLabel="results"
                                noDataMessage="No candidate results found"
                                noDataSubMessage={searchQuery ? 'Try changing your search query' : 'All candidates are pending'}
                            />

                            {/* Table Footer */}
                            {filteredResults.length > 0 && (
                                <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                                    <div className="text-sm text-slate-600">
                                        Showing <span className="font-medium">{filteredResults.length}</span> of <span className="font-medium">{results.length}</span> results
                                    </div>

                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <div className="flex items-center gap-1">
                                            <BarChart className="w-4 h-4" />
                                            <span>Average Score: <span className="font-bold">{summary.avg_overall.toFixed(2)}</span></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <ConfirmationDialog
                open={deleteConfirmation.open}
                title={deleteConfirmation.title}
                description={deleteConfirmation.description}
                confirmText={deleteConfirmation.confirmText}
                isLoading={isDeleteActionLoading}
                loadingText="Deleting..."
                onOpenChange={(open) => {
                    if (!open && !isDeleteActionLoading) {
                        closeDeleteConfirmation();
                    }
                }}
                onConfirm={handleDeleteConfirmation}
            />
        </AdminLayout>
    );
}   
