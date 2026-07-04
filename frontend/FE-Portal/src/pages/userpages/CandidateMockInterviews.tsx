import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle,
    Clock,
    Play,
    Eye,
    Star,
    Video,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLazyGetCandidateMockInterviewsQuery } from "@/store";
import UserLayout from "@/components/UserLayout";
import { DynamicTable, TableColumn, useTableState } from "@/components/DynamicTable";

export interface CandidateResponse {
    question_id: number;
    rating: number;
    notes: string;
}

export interface InterviewerMockSession {
    id: number;
    candidate_name: string;
    candidate_email: string;
    candidate_id: number;
    candidate_interviewer_name: string;
    candidate_interviewer_email: string;
    candidate_interviewer_id: number;
    stack: string;
    status: "active" | "completed";
    total_questions: number;
    attempted_questions: number;
    questions: number[];
    responses: Record<string, CandidateResponse>;
    overall_feedback: string;
    created_at: number;
    updated_at: number;
}

const CandidateMockInterviews: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<InterviewerMockSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [getCandidateMockInterviews] = useLazyGetCandidateMockInterviewsQuery();
    const table = useTableState({ rowsPerPage: 1000 });

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const data = await getCandidateMockInterviews(
                "/api/mock-interview/interviewer-mock-sessions/"
            ).unwrap();
            const results = data?.results ?? data;
            setSessions(Array.isArray(results) ? results : []);
        } catch (error) {
            toast.error("Failed to load mock interview sessions");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const completedCount = sessions.filter((s) => s.status === "completed").length;
    const activeCount = sessions.filter((s) => s.status === "active").length;

    useEffect(() => {
        table.updatePaginationFromResponse(sessions.length, null, null, 1);
    }, [sessions.length]);

    const sessionColumns: TableColumn<InterviewerMockSession>[] = [
        {
            name: 'Candidate',
            selector: (row) => row.candidate_name,
            sortable: true,
            grow: 1.5,
            cell: (row) => {
                const responses = Object.values(row.responses || {});
                let totalRating = 0;
                let totalCount = 0;
                responses.forEach((r) => {
                    if (r.rating > 0) {
                        totalRating += r.rating;
                        totalCount++;
                    }
                });
                const sessionScore = totalCount > 0 ? (totalRating / totalCount).toFixed(1) : null;

                return (
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-900">{row.candidate_name}</span>
                            {sessionScore && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-100">
                                    <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500 mr-0.5" />
                                    {sessionScore}
                                </span>
                            )}
                        </div>
                        {row.candidate_email && <div className="text-xs text-slate-400">{row.candidate_email}</div>}
                    </div>
                );
            },
        },
        {
            name: 'Interviewer',
            selector: (row) => row.candidate_interviewer_name,
            sortable: true,
            cell: (row) => (
                <div>
                    <div className="text-sm font-medium text-slate-900">{row.candidate_interviewer_name || "N/A"}</div>
                    {row.candidate_interviewer_email && <div className="text-xs text-slate-400">{row.candidate_interviewer_email}</div>}
                </div>
            ),
        },
        {
            name: 'Stack',
            selector: (row) => row.stack,
            sortable: true,
            cell: (row) => <Badge variant="outline" className="text-xs px-2 py-0.5">{row.stack}</Badge>,
        },
        {
            name: 'Status',
            selector: (row) => row.status,
            sortable: true,
            cell: (row) => (
                <Badge variant={row.status === "completed" ? "default" : "secondary"} className="text-xs px-2 py-0.5">
                    {row.status === "completed" ? (
                        <>
                            <CheckCircle className="w-3 h-3 mr-1 inline" />
                            Completed
                        </>
                    ) : (
                        <>
                            <Clock className="w-3 h-3 mr-1 inline" />
                            Active
                        </>
                    )}
                </Badge>
            ),
        },
        {
            name: 'Questions',
            selector: (row) => row.attempted_questions,
            sortable: true,
            cell: (row) => <span className="text-sm text-slate-700">{row.attempted_questions}/{row.total_questions}</span>,
        },
        {
            name: 'Date',
            selector: (row) => row.created_at,
            sortable: true,
            cell: (row) => <span className="text-sm text-slate-600">{row.created_at ? new Date(row.created_at * 1000).toLocaleDateString() : "-"}</span>,
        },
        {
            name: 'Actions',
            cell: (row) => (
                <button
                    title={row.status === "active" ? "Resume Interview" : "View Details"}
                    onClick={() => navigate(`/candidate/mock-interview/session/${row.id}`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                >
                    {row.status === "active" ? (
                        <>
                            <Play className="w-3 h-3" />
                            Resume
                        </>
                    ) : (
                        <Eye className="w-3 h-3" />
                    )}
                </button>
            ),
            ignoreRowClick: true,
            right: true,
        },
    ];

    return (
        <UserLayout>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="mb-5">
                        <div className="flex items-center gap-2 mb-1">
                            <Video className="w-5 h-5 text-slate-700" />
                            <h1 className="text-xl font-semibold text-slate-800">
                                My Mock Interviews
                            </h1>
                        </div>
                        <p className="text-sm text-slate-500">
                            View all mock interview sessions conducted for you.
                        </p>
                    </div>

                    {/* Stats */}
                    {/* <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <p className="text-xs text-slate-500 mb-1">Total Sessions</p>
              <p className="text-2xl font-bold text-slate-800">{sessions.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <p className="text-xs text-slate-500 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
              <p className="text-xs text-slate-500 mb-1">Active</p>
              <p className="text-2xl font-bold text-blue-600">{activeCount}</p>
            </div>
          </div> */}

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <DynamicTable
                            data={sessions}
                            columns={sessionColumns}
                            pagination={table.pagination}
                            isLoading={isLoading}
                            showPagination={false}
                            itemLabel="sessions"
                            loadingMessage="Loading sessions..."
                            noDataMessage="No mock interviews yet"
                            noDataSubMessage="Your mock interview sessions will appear here once scheduled."
                        />
                    </div>
                </div>
            </div>
        </UserLayout>
    );
};

export default CandidateMockInterviews;

