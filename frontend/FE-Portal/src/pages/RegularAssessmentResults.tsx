import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BarChart,
  Calendar,
  CheckCircle,
  Eye,
  FileText,
  Search,
  User,
  Users,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useLazyGetAssessmentByIdQuery,
  useLazyGetAssessmentCandidatesWithScoreQuery,
} from "@/store";
import { formatDateValue } from "@/utils/commonFunctions";
import { DynamicTable, TableColumn, useTableState } from "@/components/DynamicTable";
import { RowActionIcon } from "@/components/common/RowActionIcon";
import { StatTile } from "@/components/common/StatTile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { listPageTableStyles } from "@/utils/listPageTableStyles";

interface AssessmentHeader {
  id: number;
  title: string;
  start_date?: string;
  end_date?: string;
  passing_percentage?: number;
}

interface CandidateScore {
  candidate_assessment_id: number;
  id: number; // candidate id
  first_name?: string;
  last_name?: string;
  email?: string;
  status: "assigned" | "in_progress" | "completed" | "expired";
  assigned_at?: string;
  score: number;
  total_marks: number;
  percentage: number;
}

const candidateName = (row: CandidateScore) =>
  `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.email || `Candidate #${row.id}`;

export default function RegularAssessmentResults() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [assessment, setAssessment] = useState<AssessmentHeader | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [results, setResults] = useState<CandidateScore[]>([]);

  const [getAssessmentById] = useLazyGetAssessmentByIdQuery();
  const [getCandidatesWithScore] = useLazyGetAssessmentCandidatesWithScoreQuery();
  const table = useTableState({ rowsPerPage: 1000 });

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        const [detail, scores] = await Promise.all([
          getAssessmentById(Number(id)).unwrap(),
          // Empty status returns every candidate; large page size = all in one shot.
          getCandidatesWithScore({ id: Number(id), status: "", page: 1, page_size: 1000 }).unwrap(),
        ]);

        const a = detail?.assessment;
        if (a) {
          setAssessment({
            id: a.id,
            title: a.title,
            start_date: a.start_date,
            end_date: a.end_date,
            passing_percentage: a.passing_percentage,
          });
        }
        setQuestionCount((detail?.questions || []).length);
        const list = (scores?.results || []) as CandidateScore[];
        // Single-candidate (interview-style) assessment: skip the list and open
        // that candidate's report directly. Multiple candidates still show the list.
        if (list.length === 1 && list[0].status === "completed" && list[0].candidate_assessment_id) {
          navigate(`/admin/results/assessment/${id}/report/${list[0].candidate_assessment_id}`, { replace: true });
          return;
        }
        setResults(list);
      } catch (error) {
        console.error("Error fetching assessment results:", error);
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
    void fetchAll();
  }, [id]);

  const formatDate = (dateString?: string) =>
    formatDateValue(dateString || "", { year: "numeric", month: "short", day: "numeric" }, dateString || "");

  const formatDateTime = (dateString?: string) =>
    formatDateValue(
      dateString || "",
      { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" },
      dateString || ""
    );

  // Client-side summary — the regular candidates-score endpoint returns rows only.
  const summary = useMemo(() => {
    const total = results.length;
    const completed = results.filter((r) => r.status === "completed");
    const completedCount = completed.length;
    const avgPercentage = completedCount
      ? completed.reduce((sum, r) => sum + (r.percentage || 0), 0) / completedCount
      : 0;
    const passMark = assessment?.passing_percentage || 0;
    const passedCount = passMark
      ? completed.filter((r) => (r.percentage || 0) >= passMark).length
      : 0;
    const passRate = completedCount && passMark ? (passedCount / completedCount) * 100 : 0;
    return { total, completedCount, avgPercentage, passMark, passedCount, passRate };
  }, [results, assessment]);

  const filteredResults = results.filter((row) => {
    const matchesSearch = candidateName(row).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === "all" || row.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  useEffect(() => {
    table.updatePaginationFromResponse(filteredResults.length, null, null, 1);
  }, [filteredResults.length]);

  const statusBadge = (status: CandidateScore["status"]) => {
    if (status === "completed") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
    if (status === "in_progress") return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">In Progress</Badge>;
    if (status === "expired") return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">Expired</Badge>;
    return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Not Started</Badge>;
  };

  const resultColumns: TableColumn<CandidateScore>[] = [
    {
      name: "Candidate",
      selector: (row) => candidateName(row),
      sortable: true,
      grow: 1.5,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
            <User className="h-4 w-4 text-brand-violet" />
          </div>
          <div>
            <div
              className="cursor-pointer font-medium text-slate-800 hover:text-brand-violet hover:underline"
              onClick={() => navigate(`/admin/learner/${row.id}`)}
            >
              {candidateName(row)}
            </div>
            <div className="text-xs text-slate-500">{row.email || `Candidate ID: ${row.id}`}</div>
          </div>
        </div>
      ),
    },
    {
      name: "Status",
      selector: (row) => row.status,
      sortable: true,
      cell: (row) => statusBadge(row.status),
    },
    {
      name: "Score",
      selector: (row) => row.score,
      sortable: true,
      cell: (row) => (
        <div className="font-medium text-slate-800">
          {row.status === "completed" ? `${row.score} / ${row.total_marks}` : "--"}
        </div>
      ),
    },
    {
      name: "Percentage",
      selector: (row) => row.percentage,
      sortable: true,
      cell: (row) =>
        row.status === "completed" ? (
          <div className="flex items-center gap-2">
            <div className="text-lg font-bold text-slate-800">{row.percentage.toFixed(2)}%</div>
            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand-violet" style={{ width: `${Math.min(row.percentage, 100)}%` }} />
            </div>
          </div>
        ) : (
          <span className="text-slate-400">--</span>
        ),
    },
    {
      name: "Assigned Date",
      selector: (row) => row.assigned_at || "",
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar className="h-3 w-3" />
          {row.assigned_at ? formatDateTime(row.assigned_at) : "--"}
        </div>
      ),
    },
    {
      name: "Actions",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <RowActionIcon
            label={row.status === "completed" ? "View report" : "Result available once completed"}
            disabled={row.status !== "completed"}
            onClick={() => navigate(`/admin/results/assessment/${id}/report/${row.candidate_assessment_id}`)}
            className="hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet"
          >
            <Eye className="h-4 w-4" />
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-brand-violet" />
            <p className="text-slate-600">Loading assessment results...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!assessment) {
    return (
      <AdminLayout>
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold text-slate-800">No results found</h2>
            <Button onClick={() => navigate(`/admin/assessment/${id}`)}>Back to Assessment</Button>
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
          <div className="mb-6 flex items-center justify-between">
            <PageHeader title="Assessment Results" description="View and analyze candidate performance" />
            <button
              title="Back"
              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
            </button>
          </div>

          <TooltipProvider delayDuration={150}>
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Assessment overview */}
            <Card>
              <CardContent className="pt-6">
                <h2
                  className="cursor-pointer text-xl font-bold text-slate-800 hover:text-brand-violet hover:underline"
                  onClick={() => navigate(`/admin/assessment/${id}`)}
                  title="View Assessment"
                >
                  {assessment.title}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <FileText className="h-3 w-3" />
                    {questionCount} questions
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <Calendar className="h-3 w-3" />
                    {formatDate(assessment.start_date)} – {formatDate(assessment.end_date)}
                  </span>
                  {assessment.passing_percentage ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      <Award className="h-3 w-3" />
                      Pass mark {assessment.passing_percentage}%
                    </span>
                  ) : null}
                </div>

                {/* Completion progress */}
                {(() => {
                  const total = summary.total || 0;
                  const done = summary.completedCount || 0;
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
                          ? "Everyone has finished the assessment."
                          : `${pending} candidate${pending === 1 ? "" : "s"} still to finish.`}
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {/* Performance summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700">Performance Summary</CardTitle>
                <p className="text-xs text-slate-400">Averages cover candidates who have completed the assessment.</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatTile
                    className="bg-violet-50"
                    valueClassName="text-brand-violet"
                    icon={<Users className="h-4 w-4 text-brand-violet" />}
                    value={summary.total}
                    label="Candidates"
                    hint="Total number of candidates assigned to this assessment."
                  />
                  <StatTile
                    className="bg-teal-50"
                    valueClassName="text-teal-600"
                    icon={<CheckCircle className="h-4 w-4 text-teal-600" />}
                    value={summary.completedCount}
                    label="Completed"
                    hint="How many of the assigned candidates have finished and been scored."
                  />
                  <StatTile
                    className="bg-orange-50"
                    valueClassName="text-orange-600"
                    icon={<BarChart className="h-4 w-4 text-orange-600" />}
                    value={`${summary.avgPercentage.toFixed(1)}%`}
                    label="Avg Score"
                    hint="Average percentage score across the completed candidates."
                  />
                  <StatTile
                    className="bg-purple-50"
                    valueClassName="text-purple-600"
                    icon={<Award className="h-4 w-4 text-purple-600" />}
                    value={summary.passMark ? `${summary.passRate.toFixed(0)}%` : "--"}
                    label="Pass Rate"
                    hint={
                      summary.passMark
                        ? `Share of completed candidates who scored at or above the ${summary.passMark}% pass mark.`
                        : "No pass mark is set on this assessment, so a pass rate can't be calculated."
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          </TooltipProvider>

          {/* Results Table Header */}
          <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-lg font-semibold text-slate-800">Candidate Results</h2>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search candidates..."
                  className="h-9 w-48 pl-10"
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
                  <SelectItem value="expired">Expired</SelectItem>
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
                noDataSubMessage={searchQuery ? "Try changing your search query" : "No candidates assigned yet"}
              />

              {filteredResults.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                  <div className="text-sm text-slate-600">
                    Showing <span className="font-medium">{filteredResults.length}</span> of{" "}
                    <span className="font-medium">{results.length}</span> results
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <BarChart className="h-4 w-4" />
                    <span>
                      Average Score: <span className="font-bold">{summary.avgPercentage.toFixed(2)}%</span>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
