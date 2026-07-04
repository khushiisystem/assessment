import React, { useEffect, useState } from "react";
import { useNavigate,useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AlertTriangle, ArrowLeft, Clock, Eye } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { DynamicTable, TableColumn, useTableState } from "@/components/DynamicTable";
import { PAGE_TITLE } from "@/lib/uiStyles";

export const AssessmentCandidateResults = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const table = useTableState({ rowsPerPage: 100 });

  const candidateInfo = {
    name: "jay pratap",
    email: "jaypratap.d@SkilTechy.com",
    role: "Candidate"
  };

  const assessmentResults = [
    {
      id: 1,
      assessment: "Python-01",
      completedOn: "16 Oct 2025, 13:06",
      score: 20.0,
      totalMarks: 40.0,
      percentage: 50.00,
      status: "Completed",
      proctoring: "4 Alert(s)",
      proctoringData: {
        totalIncidents: 10,
        incidents: [
          {
            type: "Tab Switch",
            severity: "High",
            description: "Tab switch (count=1)",
            timestamp: "15 Oct 2025, 20:01:16"
          },
          {
            type: "Fullscreen Exit",
            severity: "High",
            description: "Candidate exited fullscreen (count=2)",
            timestamp: "15 Oct 2025, 20:00:48"
          },
          {
            type: "No Face Detected",
            severity: "Medium",
            description: "No face detected in frame",
            timestamp: "15 Oct 2025, 20:00:37",
            hasView: true
          },
          {
            type: "Fullscreen Exit",
            severity: "High",
            description: "Candidate exited fullscreen (count=1)",
            timestamp: "15 Oct 2025, 20:00:30"
          }
        ]
      }
    }
  ];

  const getPercentageColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-100 text-green-800 hover:bg-green-100';
    if (percentage >= 60) return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
    if (percentage >= 40) return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
    return 'bg-red-100 text-red-800 hover:bg-red-100';
  };

  const getSeverityColor = (severity) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'medium': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'low': return 'bg-green-100 text-green-800 hover:bg-green-100';
      default: return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
    }
  };

  const handleProctoringClick = (result) => {
    setSelectedAssessment(result);
    setIsModalOpen(true);
  };

  useEffect(() => {
    table.updatePaginationFromResponse(assessmentResults.length, null, null, 1);
  }, []);

  const resultColumns: TableColumn<any>[] = [
    { name: '#', selector: (row) => row.id, sortable: true, cell: (row) => <span className="font-medium text-xs">{row.id}</span>, width: '60px' },
    {
      name: 'ASSESSMENT',
      selector: (row) => row.assessment,
      sortable: true,
      cell: (row) => <span className="font-medium text-brand-violet hover:underline cursor-pointer text-xs">{row.assessment}</span>,
    },
    { name: 'COMPLETED ON', selector: (row) => row.completedOn, sortable: true, cell: (row) => <span className="text-slate-600 text-xs">{row.completedOn}</span> },
    { name: 'SCORE', selector: (row) => row.score, sortable: true, cell: (row) => <span className="font-medium text-xs">{row.score}</span> },
    { name: 'TOTAL MARKS', selector: (row) => row.totalMarks, sortable: true, cell: (row) => <span className="font-medium text-xs">{row.totalMarks}</span> },
    {
      name: 'PERCENTAGE',
      selector: (row) => row.percentage,
      sortable: true,
      cell: (row) => <Badge className={`text-xs ${getPercentageColor(row.percentage)}`}>{row.percentage.toFixed(2)}%</Badge>,
    },
    {
      name: 'STATUS',
      selector: (row) => row.status,
      sortable: true,
      cell: (row) => <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{row.status}</Badge>,
    },
    {
      name: 'PROCTORING',
      cell: (row) => (
        <Badge
          className="bg-orange-100 text-orange-800 hover:bg-orange-100 cursor-pointer flex items-center gap-0.5 text-xs"
          onClick={() => handleProctoringClick(row)}
        >
          <AlertTriangle className="w-2.5 h-2.5" />
          {row.proctoring}
        </Badge>
      ),
      ignoreRowClick: true,
    },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className={PAGE_TITLE}>Assessment Results</h1>
          </div>
          <button
          title="Back to Results"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-xs"
          >
            <ArrowLeft className="w-3 h-3" />
          </button>
        </div>

        {/* Candidate Profile Card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-violet-100 text-brand-violet text-lg font-bold">
                  {candidateInfo.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{candidateInfo.name}</h1>
                <p className="text-slate-600 text-xs">{candidateInfo.email}</p>
                <Badge variant="secondary" className="mt-1 bg-violet-100 text-brand-violet text-xs">
                  {candidateInfo.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assessment Results Section */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-t px-4 py-2">
            <CardTitle className="text-sm font-semibold">Assessment Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              <DynamicTable
                data={assessmentResults}
                columns={resultColumns}
                pagination={table.pagination}
                showPagination={false}
                itemLabel="results"
                noDataMessage="No assessment results found"
              />
            </div>
          </CardContent>
        </Card>

        {/* Proctoring Incidents Dialog */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[70vh] overflow-hidden flex flex-col">
            <DialogHeader className="bg-yellow-50 border-b border-yellow-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-yellow-600 w-4 h-4" />
                <div>
                  <DialogTitle className="text-sm font-semibold text-slate-900">
                    Proctoring Incidents - {selectedAssessment?.assessment}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-600 mt-0.5">
                    Total Incidents: {selectedAssessment?.proctoringData.totalIncidents}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 px-4">
              <div className="divide-y divide-slate-200">
                {selectedAssessment?.proctoringData.incidents.map((incident, index) => (
                  <div key={index} className="py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          <Badge className={`text-xs ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </Badge>
                          <span className="font-semibold text-slate-900 text-xs">{incident.type}</span>
                        </div>
                        <p className="text-xs text-slate-600 mb-1">{incident.description}</p>
                        <div className="flex items-center gap-0.5 text-xs text-slate-500">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{incident.timestamp}</span>
                        </div>
                      </div>
                      {incident.hasView && (
                        <button className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-xs">
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-3 border-t border-slate-200">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-xs"
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </AdminLayout>
  );
};
