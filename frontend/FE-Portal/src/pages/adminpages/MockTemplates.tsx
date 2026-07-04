import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Layers, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import {
  useGetTemplatesQuery,
  useGetMockQuestionsQuery,
  useGetStacksQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} from "@/store";
import { formatDateFromUnixSeconds } from "@/utils/commonFunctions";
import { ActiveFilterChip, SearchFilterPanel } from "@/components/common/SearchFilterPanel";

export interface InterviewTemplate {
  id?: number;
  name: string;
  questions: number[];
  created_at?: number;
  updated_at?: number;
}

export interface Question {
  id?: number;
  text: string;
  ideal_answer: string;
  stack: string;
  difficulty: "Junior" | "Mid-Level" | "Senior";
  created_at?: number;
  updated_at?: number;
}

const MockTemplates: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stacks, setStacks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  // Create Template
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InterviewTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);
  const [filterStack, setFilterStack] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("All");

  // RTK Query hooks
  const { data: templatesRawData, isLoading: templatesLoading, refetch: refetchTemplates } = useGetTemplatesQuery();
  const { data: questionsRawData, isLoading: questionsLoading, refetch: refetchQuestions } = useGetMockQuestionsQuery();
  const { data: stacksData } = useGetStacksQuery();
  const [createTemplateMutation] = useCreateTemplateMutation();
  const [updateTemplateMutation] = useUpdateTemplateMutation();
  const [deleteTemplateMutation] = useDeleteTemplateMutation();

  // Derive templates and questions from auto-fetch queries
  useEffect(() => {
    if (templatesRawData) {
      const templatesData = templatesRawData?.results ?? templatesRawData;
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
    }
  }, [templatesRawData]);

  useEffect(() => {
    if (questionsRawData) {
      const questionsData = questionsRawData?.results ?? questionsRawData;
      setQuestions(Array.isArray(questionsData) ? questionsData : []);
    }
  }, [questionsRawData]);

  // Keep stacks in sync
  useEffect(() => {
    if (stacksData) {
      setStacks(stacksData);
      if (stacksData.length > 0 && !filterStack) {
        setFilterStack(stacksData[0]);
      }
    }
  }, [stacksData]);

  // Update isLoading from query states
  useEffect(() => {
    setIsLoading(templatesLoading || questionsLoading);
  }, [templatesLoading, questionsLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([refetchTemplates(), refetchQuestions()]);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  // Logic to open Create Dialog
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setNewTemplateName("");
    setSelectedQuestionIds([]);
    setIsCreateOpen(true);
  };

  // Logic to open Edit Dialog
  const handleEditClick = (template: InterviewTemplate) => {
    setEditingTemplate(template);
    setNewTemplateName(template.name);
    setSelectedQuestionIds(template.questions);
    setIsCreateOpen(true);
  };

  // Unified Save Handler (Create or Update)
  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (selectedQuestionIds.length === 0) {
      toast.error("Please select at least one question");
      return;
    }
    try {
      if (editingTemplate && editingTemplate.id) {
        // Update Mode
        await updateTemplateMutation({
          id: editingTemplate.id,
          data: {
            name: newTemplateName,
            questions: selectedQuestionIds,
          },
        }).unwrap();
        toast.success("Template updated successfully");
      } else {
        // Create Mode
        await createTemplateMutation({
          name: newTemplateName,
          questions: selectedQuestionIds,
        }).unwrap();
        toast.success("Template created successfully");
      }

      setIsCreateOpen(false);
      setEditingTemplate(null);
      setNewTemplateName("");
      setSelectedQuestionIds([]);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error("Failed to save template");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplateMutation(id).unwrap();
      toast.success("Template deleted");
      loadData();
    } catch (error) {
      toast.error("Failed to delete template");
    }
  };

  const toggleQuestion = (id: number) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((qId) => qId !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setCurrentPage(1);
  };

  const isFilterApplied = searchTerm.trim() !== "";
  const activeFilterChips: ActiveFilterChip[] = searchTerm.trim()
    ? [
      {
        id: "search",
        label: "Search",
        value: searchTerm,
        onRemove: () => setSearchTerm(""),
        tone: "blue",
        quoteValue: true,
      },
    ]
    : [];

  const filteredTemplates = templates.filter(template => {
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term || template.name.toLowerCase().includes(term);
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredTemplates.length);
  const paginatedTemplates = filteredTemplates.slice(startIndex, endIndex);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleFirstPage = () => setCurrentPage(1);
  const handleLastPage = () => setCurrentPage(totalPages);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Junior": return "bg-green-100 text-green-700";
      case "Mid-Level": return "bg-yellow-100 text-yellow-700";
      case "Senior": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const formatDate = (timestamp?: number) => formatDateFromUnixSeconds(timestamp, "N/A");

  const filteredQuestions = questions.filter((q) => {
    const matchesStack = !filterStack || q.stack === filterStack;
    const matchesDifficulty = filterDifficulty === "All" || q.difficulty === filterDifficulty;
    return matchesStack && matchesDifficulty;
  });

  const areAllFilteredSelected =
    filteredQuestions.length > 0 &&
    filteredQuestions.every((q) => selectedQuestionIds.includes(q.id!));

  const handleSelectAll = () => {
    if (areAllFilteredSelected) {
      const filteredIds = filteredQuestions.map((q) => q.id!);
      setSelectedQuestionIds((prev) =>
        prev.filter((id) => !filteredIds.includes(id))
      );
    } else {
      const filteredIds = filteredQuestions.map((q) => q.id!);
      setSelectedQuestionIds((prev) =>
        Array.from(new Set([...prev, ...filteredIds]))
      );
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Interview Templates
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Create reusable interview question sets for mock interviews.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/admin/mock-interview")}
                title="Back to Dashboard"
                className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <button
                    onClick={handleOpenCreate}
                    title="Create Template"
                    className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                {/* FIX APPLIED HERE:
                   onOpenAutoFocus={(e) => e.preventDefault()}
                   This prevents the input from being focused and selected automatically on open.
                */}
                <DialogContent
                  className="max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <DialogHeader className="px-6 pt-6 pb-2">
                    <DialogTitle>
                      {editingTemplate ? "Edit Interview Template" : "Create Interview Template"}
                    </DialogTitle>
                  </DialogHeader>

                  {/* Main Content Area - Fixed Flexbox */}
                  <div className="flex-1 flex flex-col gap-4 px-6 pb-6 overflow-hidden">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 mb-1">Template Name</Label>
                      <Input
                        placeholder="e.g. Python + Django Interview"
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        className="text-sm py-1.5"
                      />
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex-1 flex flex-col min-h-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 shrink-0">
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 mb-1">Stack</Label>
                          <select
                            value={filterStack}
                            onChange={(e) => setFilterStack(e.target.value)}
                            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                          >
                            {stacks.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-slate-700 mb-1">Difficulty Level</Label>
                          <select
                            value={filterDifficulty}
                            onChange={(e) => setFilterDifficulty(e.target.value)}
                            className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                          >
                            <option value="All">All Levels</option>
                            <option value="Junior">Junior</option>
                            <option value="Mid-Level">Mid-Level</option>
                            <option value="Senior">Senior</option>
                          </select>
                        </div>
                      </div>

                      <Label className="text-xs font-semibold text-slate-700 mb-2 block shrink-0">Select Questions</Label>
                      <div className="flex-1 overflow-y-auto border rounded-lg bg-white divide-y min-h-0">
                        {filteredQuestions.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-500">
                            No questions available for the selected filters
                          </div>
                        ) : (
                          filteredQuestions.map((q) => (
                            <div
                              key={q.id}
                              className={`p-2 flex items-start gap-2 cursor-pointer transition-colors hover:bg-slate-50 ${selectedQuestionIds.includes(q.id!)
                                ? "bg-violet-50"
                                : ""
                                }`}
                              onClick={() => toggleQuestion(q.id!)}
                            >
                              <div
                                className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedQuestionIds.includes(q.id!)
                                  ? "bg-brand-violet border-brand-violet"
                                  : "border-slate-300"
                                  }`}
                              >
                                {selectedQuestionIds.includes(q.id!) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{q.text}</p>
                                <div className="flex items-center gap-1 mt-1">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${getDifficultyColor(q.difficulty)}`}>
                                    {q.difficulty}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {q.stack}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-auto shrink-0">
                      <span className="text-xs text-slate-600">
                        {selectedQuestionIds.length} questions selected
                      </span>
                      <div className="flex gap-2 items-center">
                        {/* Select All Button  */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAll}
                          disabled={filteredQuestions.length === 0}
                          className="text-xs h-9 px-2 text-indigo-600 hover:text-indigo-800 hover:bg-violet-50"
                        >
                          {areAllFilteredSelected ? "Deselect All " : "Select All "}
                        </Button>

                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)} className="text-xs h-9 px-2">
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveTemplate}
                          className="text-xs h-9 px-2"
                          size="sm"
                          disabled={!newTemplateName.trim() || selectedQuestionIds.length === 0}
                        >
                          {editingTemplate ? "Update Template" : "Create Template"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Total Templates</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{templates.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Total Questions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-blue-600">{questions.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Available Stacks</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-indigo-600">{stacks.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Section */}
          <SearchFilterPanel
            search={{
              label: "Search Templates",
              placeholder: "Search by template name...",
              value: searchTerm,
              onChange: setSearchTerm,
              className: "flex-1",
            }}
            activeFilters={activeFilterChips}
            onClearAll={clearFilters}
            fieldsLayoutClassName="flex flex-wrap md:flex-nowrap gap-2 items-end"
          />

          {/* Templates Grid */}
          <div className="bg-white rounded shadow-sm border border-gray-200 p-4 mb-6">
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-slate-600">Loading templates...</p>
              </div>
            ) : paginatedTemplates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="flex flex-col items-center">
                  <Layers className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm font-medium mb-1">No templates found</p>
                  <p className="text-xs text-slate-400">
                    {isFilterApplied
                      ? "No templates available for the selected filters. Try adjusting your search query."
                      : "No templates available yet. Create your first template to get started."}
                  </p>
                  {isFilterApplied && (
                    <button
                      onClick={clearFilters}
                      className="mt-2 px-3 py-1.5 text-xs bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg shadow-sm hover:brightness-110"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-4">
                  {paginatedTemplates.map((template) => (
                    <Card
                      key={template.id}
                      onClick={() => handleEditClick(template)}
                      className="border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <CardHeader className="pb-2 pt-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium text-slate-800 group-hover:text-blue-600 transition-colors truncate">{template.name}</CardTitle>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(template.id!)
                            }}
                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                          <Layers className="w-3.5 h-3.5" />
                          <span>{template.questions.length} Questions</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Created {formatDate(template.created_at)}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {filteredTemplates.length > 0 && (
                  <div className="flex flex-col md:flex-row justify-between items-center p-3 border-t border-gray-200 gap-3">
                    <div className="text-xs text-slate-500">
                      Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{filteredTemplates.length}</span> templates
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleFirstPage}
                        disabled={currentPage === 1 || isLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        title="First Page"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        <ChevronLeft className="w-3 h-3 -ml-2" />
                      </button>

                      <button
                        onClick={handlePrevPage}
                        disabled={currentPage === 1 || isLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-3 h-3" />
                        Previous
                      </button>

                      <div className="px-2 py-1 text-xs text-slate-700">
                        Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                      </div>

                      <button
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages || isLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        title="Next Page"
                      >
                        Next
                        <ChevronRight className="w-3 h-3" />
                      </button>

                      <button
                        onClick={handleLastPage}
                        disabled={currentPage === totalPages || isLoading}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        title="Last Page"
                      >
                        <ChevronRight className="w-3 h-3" />
                        <ChevronRight className="w-3 h-3 -ml-2" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default MockTemplates;

