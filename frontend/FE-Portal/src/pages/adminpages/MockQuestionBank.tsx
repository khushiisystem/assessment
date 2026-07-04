import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  Upload,
  Edit,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import {
  useGetMockQuestionsQuery,
  useGetStacksQuery,
  useCreateMockQuestionMutation,
  useUpdateMockQuestionMutation,
  useDeleteMockQuestionMutation,
  useBulkDeleteMockQuestionsMutation,
  useBulkCreateMockQuestionsMutation,
} from "@/store";
import { formatDateFromUnixSeconds } from "@/utils/commonFunctions";
import { ActiveFilterChip, FilterSelectConfig, SearchFilterPanel } from "@/components/common/SearchFilterPanel";
import { ConfirmationDialog } from "@/components/common/ConfirmationDialog";

export interface Question {
  id?: number;
  text: string;
  ideal_answer: string;
  stack: string;
  difficulty: "easy" | "medium" | "hard";
  created_at?: number;
  updated_at?: number;
}

interface DeleteConfirmationState {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  onConfirm: (() => Promise<void>) | null;
}

const MockQuestionBank: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stacks, setStacks] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterStack, setFilterStack] = useState<string>("All");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add/Edit Question Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [newQuestion, setNewQuestion] = useState({
    text: "",
    ideal_answer: "",
    stack: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
  });

  // Bulk Import Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [isDeleteActionLoading, setIsDeleteActionLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmationState>({
    open: false,
    title: "",
    description: "",
    confirmText: "Confirm",
    onConfirm: null,
  });

  // RTK Query hooks
  const { data: questionsRawData, isLoading: questionsLoading, refetch: refetchQuestions } = useGetMockQuestionsQuery();
  const { data: stacksData, refetch: refetchStacks } = useGetStacksQuery();
  const [createQuestionMutation] = useCreateMockQuestionMutation();
  const [updateQuestionMutation] = useUpdateMockQuestionMutation();
  const [deleteQuestionMutation] = useDeleteMockQuestionMutation();
  const [bulkDeleteQuestionsMutation] = useBulkDeleteMockQuestionsMutation();
  const [bulkCreateQuestionsMutation] = useBulkCreateMockQuestionsMutation();

  // Derive questions from auto-fetch query
  useEffect(() => {
    if (questionsRawData) {
      const questionsData = questionsRawData?.results ?? questionsRawData;
      setQuestions(Array.isArray(questionsData) ? questionsData : []);
      setIsLoading(false);
    }
  }, [questionsRawData]);

  // Keep stacks in sync with RTK Query data
  useEffect(() => {
    if (stacksData) {
      setStacks(stacksData);
    }
  }, [stacksData]);

  // Update isLoading from query state
  useEffect(() => {
    if (questionsLoading) {
      setIsLoading(true);
    }
  }, [questionsLoading]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await refetchQuestions();
      if (stacksData && stacksData.length > 0 && !newQuestion.stack) {
        setNewQuestion((prev) => ({ ...prev, stack: stacksData[0] }));
      }
    } catch (error) {
      toast.error("Failed to load questions");
    } finally {
      setIsLoading(false);
    }
  };

  // Set default stack when stacks load
  useEffect(() => {
    if (stacks.length > 0 && !newQuestion.stack) {
      setNewQuestion((prev) => ({ ...prev, stack: stacks[0] }));
    }
  }, [stacks]);

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

  const handleAddQuestion = async () => {
    if (!newQuestion.text || !newQuestion.ideal_answer || !newQuestion.stack) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await createQuestionMutation(newQuestion).unwrap();
      toast.success("Question added");
      setIsAddOpen(false);
      setNewQuestion({ text: "", ideal_answer: "", stack: stacks[0] || "", difficulty: "medium" });
      loadData();
    } catch (error) {
      toast.error("Failed to add question");
    }
  };

  const handleEditQuestion = async () => {
    if (!editingQuestion?.id || !editingQuestion.text || !editingQuestion.ideal_answer || !editingQuestion.stack) {
      toast.error("Please fill all fields");
      return;
    }
    try {
      await updateQuestionMutation({ id: editingQuestion.id, data: editingQuestion }).unwrap();
      toast.success("Question updated");
      setIsEditOpen(false);
      setEditingQuestion(null);
      loadData();
    } catch (error) {
      toast.error("Failed to update question");
    }
  };

  const handleDelete = (id: number) => {
    openDeleteConfirmation({
      title: "Are you sure?",
      description: "Delete this question?",
      confirmText: "Yes, delete it!",
      onConfirm: async () => {
        try {
          await deleteQuestionMutation(id).unwrap();
          toast.success("Question deleted");
          loadData();
        } catch (error) {
          toast.error("Failed to delete question");
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    openDeleteConfirmation({
      title: "Delete Questions?",
      description: `Are you sure you want to delete ${selectedIds.size} questions?`,
      confirmText: "Yes, delete them!",
      onConfirm: async () => {
        try {
          await bulkDeleteQuestionsMutation(Array.from(selectedIds)).unwrap();
          toast.success(`Deleted ${selectedIds.size} questions`);
          setSelectedIds(new Set());
          loadData();
        } catch (error) {
          toast.error("Failed to delete questions");
        }
      },
    });
  };

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) {
        toast.error("JSON must be an array");
        return;
      }
      const difficultyMap: Record<string, "easy" | "medium" | "hard"> = {
      beginner: "easy", junior: "easy", easy: "easy",
      intermediate: "medium", "mid-level": "medium", medium: "medium",
      senior: "hard", advanced: "hard", hard: "hard",
    };

    const normalized = parsed.map((q) => ({
      ...q,
      difficulty: difficultyMap[q.difficulty?.toLowerCase()] ?? "medium",
    }));
      await bulkCreateQuestionsMutation(normalized).unwrap();
      toast.success(`Imported ${normalized.length} questions`);
      setIsImportOpen(false);
      setImportJson("");
      loadData();
    } catch (error) {
      toast.error("Invalid JSON format");
    }
  };

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id!).filter(Boolean)));
    }
  };

  const openEditDialog = (question: Question) => {
    setEditingQuestion({ ...question });
    setIsEditOpen(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStack("All");
    setFilterDifficulty("All");
    setCurrentPage(1);
  };

  const isFilterApplied = searchTerm.trim() !== "" || filterStack !== "All" || filterDifficulty !== "All";
  const filterConfigs: FilterSelectConfig[] = [
    {
      id: "stack",
      label: "Filter by Stack",
      value: filterStack,
      onChange: setFilterStack,
      options: [
        { value: "All", label: "All Stacks" },
        ...stacks.map((s) => ({ value: s, label: s })),
      ],
      className: "w-48",
    },
    {
      id: "difficulty",
      label: "Filter by Difficulty",
      value: filterDifficulty,
      onChange: setFilterDifficulty,
      options: [
        { value: "All", label: "All Levels" },
        { value: "easy", label: "Easy" },
        { value: "medium", label: "Medium" },
        { value: "hard", label: "Hard" },
      ],
      className: "w-48",
    },
  ];
  const activeFilterChips: ActiveFilterChip[] = [
    ...(searchTerm.trim()
      ? [{
        id: "search",
        label: "Search",
        value: searchTerm,
        onRemove: () => setSearchTerm(""),
        tone: "blue" as const,
        quoteValue: true,
      }]
      : []),
    ...(filterStack !== "All"
      ? [{
        id: "stack",
        label: "Stack",
        value: filterStack,
        onRemove: () => setFilterStack("All"),
        tone: "green" as const,
      }]
      : []),
    ...(filterDifficulty !== "All"
      ? [{
        id: "difficulty",
        label: "Difficulty",
        value: filterDifficulty,
        onRemove: () => setFilterDifficulty("All"),
        tone: "purple" as const,
      }]
      : []),
  ];

  const filteredQuestions = questions.filter((q) => {
    const matchesStack = filterStack === "All" || q.stack === filterStack;
    const matchesDifficulty = filterDifficulty === "All" || q.difficulty === filterDifficulty;
    const term = searchTerm.trim().toLowerCase();
    const matchesSearch = !term ||
      (q.text && q.text.toLowerCase().includes(term)) ||
      (q.ideal_answer && q.ideal_answer.toLowerCase().includes(term));
    return matchesStack && matchesDifficulty && matchesSearch;
  });

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredQuestions.length);
  const paginatedQuestions = filteredQuestions.slice(startIndex, endIndex);

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
      case "easy": return "bg-green-100 text-green-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      case "hard": return "bg-red-100 text-red-700";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  const formatDate = (timestamp?: number) => formatDateFromUnixSeconds(timestamp, "N/A");

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-800">
                Question Bank
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Manage interview questions for mock interviews.
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

              <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogTrigger asChild>
                  <button
                    title="Bulk Import"
                    className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Bulk Import Questions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Label className="text-sm">
                      Bulk import questions from a JSON file. The file should be an array of objects with the following keys: "text", "ideal_answer", "stack", "difficulty".
                    </Label>
                    <Textarea
                          placeholder='[{"text": "Question?", "ideal_answer": "Answer", "stack": "Python", "difficulty": "easy","medium","hard"}]'
                          value={importJson}
                          onChange={(e) => setImportJson(e.target.value)}
                          rows={8}
                          className="font-mono text-xs"
                          
                        />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsImportOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleBulkImport}>
                        Import Questions
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <button
                    title="Add Question"
                    className="flex items-center gap-1 px-2 py-0.5 border border-gray-500 rounded hover:bg-gray-300 transition-all duration-200 text-xs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Question</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-medium text-slate-700 mb-1">Stack</Label>
                        <Input
                          list="stacks-list"
                          value={newQuestion.stack}
                          onChange={(e) => setNewQuestion({ ...newQuestion, stack: e.target.value })}
                          placeholder="e.g. Python"
                          className="text-sm py-1.5"
                        />
                        <datalist id="stacks-list">
                          {stacks.map((s) => <option key={s} value={s} />)}
                        </datalist>
                      </div>
                      <div>
                        <Label className="text-xs font-medium text-slate-700 mb-1">Difficulty</Label>
                        <Select
                          value={newQuestion.difficulty}
                          onValueChange={(v) => setNewQuestion({ ...newQuestion, difficulty: v as any })}
                        >
                          <SelectTrigger className="text-sm py-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">easy</SelectItem>
                            <SelectItem value="medium">medium</SelectItem>
                            <SelectItem value="hard">hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700 mb-1">Question</Label>
                      <Textarea
                        value={newQuestion.text}
                        onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                        placeholder="Enter the question..."
                        rows={3}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-slate-700 mb-1">Ideal Answer</Label>
                      <Textarea
                        value={newQuestion.ideal_answer}
                        onChange={(e) => setNewQuestion({ ...newQuestion, ideal_answer: e.target.value })}
                        placeholder="Enter the ideal answer..."
                        rows={4}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddQuestion}>
                        Add Question
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Total Questions</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold">{questions.length}</div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Junior</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-green-600">
                  {questions.filter((q) => q.difficulty === "easy").length}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Mid-Level</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-yellow-600">
                  {questions.filter((q) => q.difficulty === "medium").length}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-medium text-slate-500">Senior</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-xl font-bold text-red-600">
                  {questions.filter((q) => q.difficulty === "hard").length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters Section */}
          <SearchFilterPanel
            search={{
              label: "Search Questions",
              placeholder: "Search by question text or ideal answer...",
              value: searchTerm,
              onChange: setSearchTerm,
              className: "flex-1",
            }}
            filters={filterConfigs}
            activeFilters={activeFilterChips}
            onClearAll={clearFilters}
            fieldsLayoutClassName="flex flex-wrap md:flex-nowrap gap-2 items-end"
          />

          {/* Questions Table */}
          <div className="bg-white rounded shadow-sm border border-gray-200 mb-6 px-3">
            {selectedIds.size > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 bg-blue-50 flex justify-between items-center ">
                <span className="text-xs text-blue-700">
                  {selectedIds.size} question(s) selected
                </span>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 size={12} />
                  Delete Selected
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200">
                    <TableHead className="w-12 py-2 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0}
                        onChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-slate-700">Question</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-slate-700 w-32">Stack</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-slate-700 w-32">Difficulty</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-slate-700 w-40">Created</TableHead>
                    <TableHead className="py-2 px-3 text-xs font-medium text-slate-700 text-right w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-slate-600">Loading questions...</p>
                      </TableCell>
                    </TableRow>
                  ) : paginatedQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                        <div className="flex flex-col items-center">
                          <Search className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-sm font-medium mb-1">No questions found</p>
                          <p className="text-xs text-slate-400">
                            {isFilterApplied
                              ? "No questions available for the selected filters. Try adjusting your filters or search query."
                              : "No questions available yet. Start by adding your first question."}
                          </p>
                          {isFilterApplied && (
                            <button
                              onClick={clearFilters}
                              className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Clear Filters
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedQuestions.map((q) => (
                      <TableRow key={q.id} className="border-b border-gray-100 hover:bg-slate-50">
                        <TableCell className="py-2 px-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(q.id!)}
                            onChange={() => toggleSelection(q.id!)}
                          />
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-900">{q.text}</p>
                            <p className="text-xs text-slate-500 line-clamp-2">{q.ideal_answer}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge variant="outline" className="text-xs px-2 py-0.5">
                            {q.stack}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3">
                          <Badge className={`text-xs px-2 py-0.5 ${getDifficultyColor(q.difficulty)}`}>
                            {q.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 px-3 text-xs text-slate-500">
                          {formatDate(q.created_at)}
                        </TableCell>
                        <TableCell className="py-2 px-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              title="Edit Question"
                              onClick={() => openEditDialog(q)}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              title="Delete Question"
                              onClick={() => handleDelete(q.id!)}
                              className="flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {filteredQuestions.length > 0 && (
              <div className="flex flex-col md:flex-row justify-between items-center p-3 border-t border-gray-200 gap-3">
                <div className="text-xs text-slate-500">
                  Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of <span className="font-medium">{filteredQuestions.length}</span> questions
                  {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFirstPage}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    title="First Page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    <ChevronLeft className="w-3 h-3 -ml-2" />
                  </button>

                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || isLoading}
                    className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
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
                    className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    title="Next Page"
                  >
                    Next
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    onClick={handleLastPage}
                    disabled={currentPage === totalPages || isLoading}
                    className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    title="Last Page"
                  >
                    <ChevronRight className="w-3 h-3" />
                    <ChevronRight className="w-3 h-3 -ml-2" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Question Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          {editingQuestion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-slate-700 mb-1">Stack</Label>
                  <Input
                    list="edit-stacks-list"
                    value={editingQuestion.stack}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, stack: e.target.value })}
                    placeholder="e.g. Python"
                    className="text-sm py-1.5"
                  />
                  <datalist id="edit-stacks-list">
                    {stacks.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700 mb-1">Difficulty</Label>
                  <Select
                    value={editingQuestion.difficulty}
                    onValueChange={(v) => setEditingQuestion({ ...editingQuestion, difficulty: v as any })}
                  >
                    <SelectTrigger className="text-sm py-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Junior</SelectItem>
                      <SelectItem value="medium">Mid-Level</SelectItem>
                      <SelectItem value="hard">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700 mb-1">Question</Label>
                <Textarea
                  value={editingQuestion.text}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })}
                  placeholder="Enter the question..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-slate-700 mb-1">Ideal Answer</Label>
                <Textarea
                  value={editingQuestion.ideal_answer}
                  onChange={(e) => setEditingQuestion({ ...editingQuestion, ideal_answer: e.target.value })}
                  placeholder="Enter the ideal answer..."
                  rows={4}
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditQuestion}>
                  Update Question
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
};

export default MockQuestionBank;

