import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { AlertTriangle, ArrowLeft, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  useGetCategoriesQuery,
  useLazyGetAssessmentByIdQuery,
  useUpdateAssessmentMutation,
  useCreateAssessmentMutation,
  useLazyGetCandidatesQuery,
  useLazyGetAssessmentCandidatesByStatusQuery,
  useAssignAssessmentMutation,
  useUnassignAssessmentMutation,
  useLazyGetAssessmentQuestionsQuery,
  useLazyGetQuestionsByRuleQuery,
} from "@/store";
import { DateTimePicker } from "@/components/common/DateTimePicker";
import { LABEL_CLASS, INPUT_CLASS, TEXTAREA_CLASS } from "@/lib/uiStyles";
import {
  AssessmentWizardShell,
  type WizardStep,
} from "@/components/assessments/AssessmentWizardShell";
import { WizardCandidateStep } from "@/components/assessments/WizardCandidateStep";
import {
  WizardQuestionStepClient,
  type SelectedQuestion,
  type ClientAutoFillRule,
} from "@/components/assessments/WizardQuestionStepClient";
import {
  getDifficultyColor,
  getMarksDisplay,
  getQuestionTypeDisplay,
} from "@/components/assessments/assessmentDetailsUtils";
import type { Category as BankCategory } from "@/components/assessments/AssessmentDetailsTypes";

// Define the category type
interface Category {
  id: number;
  name: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { key: "details", label: "Basic Details" },
  { key: "configuration", label: "Configuration" },
  { key: "questions", label: "Questions" },
  { key: "review", label: "Review" },
  { key: "candidates", label: "Candidates" },
];

const STEP_DETAILS = 0;
const STEP_CONFIG = 1;
const STEP_QUESTIONS = 2;
const STEP_REVIEW = 3;
const STEP_CANDIDATES = 4;

const DEFAULT_ASSESSMENT_INSTRUCTIONS = `1. Ensure a stable internet connection before you begin.
2. The timer starts when you open the assessment and cannot be paused.
3. Do not refresh, close, or switch away from the assessment tab.
4. Use of external help, resources, or devices is not allowed.
5. Your answers are saved automatically as you proceed.
6. Review your responses, then click "Submit" once you are done.`;

/** Map a raw question-bank object into the minimal selected-state shape. */
const toSelectedQuestion = (q: any): SelectedQuestion => ({
  id: q.id,
  title: q.title,
  question_type: q.question_type,
  difficulty: q.difficulty,
  marks: q.marks,
});

export const CreateAssessment = () => {
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    duration: "",
    categories: [] as number[],
    startDate: "",
    endDate: "",
    instructions: DEFAULT_ASSESSMENT_INSTRUCTIONS,
    passingPercentage: "",
  });
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  // In edit mode, `?step=candidates` lands the wizard straight on the last
  // step so admins can add/remove candidates without clicking through.
  const [currentStep, setCurrentStep] = React.useState(
    id && searchParams.get("step") === "candidates" ? STEP_CANDIDATES : 0
  );
  const [showCategoriesDropdown, setShowCategoriesDropdown] = React.useState(false);
  const [shuffleQuestions, setShuffleQuestions] = React.useState(false);
  const [shuffleOptions, setShuffleOptions] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [enableCertificate, setEnableCertificate] = React.useState(false);
  const categoriesDropdownRef = React.useRef<HTMLDivElement>(null);

  // The id of the assessment once it exists. In edit mode this is the route id;
  // on create it is captured from the single create call at the Review step.
  const [createdId, setCreatedId] = React.useState<number | null>(id ? Number(id) : null);

  // RTK Query hooks
  const { data: categoriesData, isLoading: categoriesLoading, isError: categoriesError } = useGetCategoriesQuery();
  const [getAssessmentById, { isLoading: assessmentLoading }] = useLazyGetAssessmentByIdQuery();
  const [updateAssessment] = useUpdateAssessmentMutation();
  const [createAssessment] = useCreateAssessmentMutation();
  const [getCandidates] = useLazyGetCandidatesQuery();
  const [getAssessmentCandidatesByStatus] = useLazyGetAssessmentCandidatesByStatusQuery();
  const [assignAssessment] = useAssignAssessmentMutation();
  const [unassignAssessment] = useUnassignAssessmentMutation();
  const [getAssessmentQuestions] = useLazyGetAssessmentQuestionsQuery();
  const [getQuestionsByRule] = useLazyGetQuestionsByRuleQuery();

  const isLoading = categoriesLoading || assessmentLoading;

  // ----------------------------------------------------------------------
  // CLIENT-SIDE question selection (steps 1-3 perform NO API writes).
  // ----------------------------------------------------------------------
  const [selectedQuestions, setSelectedQuestions] = React.useState<SelectedQuestion[]>([]);
  const selectedIds = React.useMemo(() => selectedQuestions.map((q) => q.id), [selectedQuestions]);
  const totalSelectedQuestions = selectedQuestions.length;

  // Bank browsing (read-only).
  const [bankQuestions, setBankQuestions] = React.useState<SelectedQuestion[]>([]);
  const [bankSearch, setBankSearch] = React.useState("");
  const [bankPage, setBankPage] = React.useState(1);
  const [bankHasMore, setBankHasMore] = React.useState(true);
  const [loadingBank, setLoadingBank] = React.useState(false);
  const [loadingMoreBank, setLoadingMoreBank] = React.useState(false);
  const bankSearchDebounceRef = React.useRef<number | null>(null);

  // Auto-fill rules (client-side).
  const [autoFillRules, setAutoFillRules] = React.useState<ClientAutoFillRule[]>([
    { id: 1, category: "", type: "", difficulty: "", count: "" },
  ]);
  const [autoFilling, setAutoFilling] = React.useState(false);
  const isAutoFillValid = autoFillRules.every((rule) => rule.category && rule.type && rule.count);

  const categoryKey = React.useMemo(() => (formData.categories || []).join(","), [formData.categories]);

  const addSelectedQuestions = React.useCallback((incoming: SelectedQuestion[]) => {
    setSelectedQuestions((prev) => {
      const seen = new Set(prev.map((q) => q.id));
      const merged = [...prev];
      for (const q of incoming) {
        if (!seen.has(q.id)) {
          seen.add(q.id);
          merged.push(q);
        }
      }
      return merged;
    });
  }, []);

  const onAddQuestion = React.useCallback(
    (q: SelectedQuestion) => addSelectedQuestions([q]),
    [addSelectedQuestions]
  );

  const onRemoveQuestion = React.useCallback((qid: number) => {
    setSelectedQuestions((prev) => prev.filter((q) => q.id !== qid));
  }, []);

  // Read-only bank fetch (no writes). Scoped by the form's selected categories.
  const fetchBank = React.useCallback(
    (page: number, append: boolean, search: string) => {
      const doFetch = async () => {
        try {
          if (append) setLoadingMoreBank(true);
          else setLoadingBank(true);

          const ids = categoryKey ? categoryKey.split(",").map(Number) : [];
          const params: { page: number; page_size: number; categories?: number[]; search?: string } = {
            page,
            page_size: 20,
          };
          if (ids.length) params.categories = ids;
          if (search.trim()) params.search = search.trim();

          const data = await getAssessmentQuestions(params).unwrap();
          const newQuestions: SelectedQuestion[] = (data?.results?.questions || []).map(toSelectedQuestion);

          setBankQuestions((prev) => (append ? [...prev, ...newQuestions] : newQuestions));
          setBankHasMore(!!data?.next);
          setBankPage(page);
        } catch (error) {
          console.error("Error fetching questions:", error);
          toast({
            title: "Failed",
            description: "Failed to load questions",
            variant: "destructive",
            duration: 3000,
          });
        } finally {
          setLoadingBank(false);
          setLoadingMoreBank(false);
        }
      };
      void doFetch();
    },
    [getAssessmentQuestions, categoryKey]
  );

  // Debounced bank load while on the Questions step.
  React.useEffect(() => {
    if (currentStep !== STEP_QUESTIONS) return;
    if (bankSearchDebounceRef.current) clearTimeout(bankSearchDebounceRef.current);
    bankSearchDebounceRef.current = window.setTimeout(() => {
      fetchBank(1, false, bankSearch);
    }, 400);
    return () => {
      if (bankSearchDebounceRef.current) clearTimeout(bankSearchDebounceRef.current);
    };
  }, [currentStep, bankSearch, fetchBank]);

  const onBankScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (scrollBottom <= 50 && bankHasMore && !loadingMoreBank && !loadingBank) {
      fetchBank(bankPage + 1, true, bankSearch);
    }
  };

  const onClearBankSearch = () => setBankSearch("");

  // Deduped categories for the auto-fill dropdown (names can repeat).
  const dedupedCategories = React.useMemo<BankCategory[]>(() => {
    const seen = new Set<string>();
    return (Array.isArray(categoriesData) ? (categoriesData as BankCategory[]) : []).filter((category) => {
      const key = (category.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categoriesData]);

  const onAddAutoFillRule = () => {
    setAutoFillRules((prev) => [
      ...prev,
      { id: prev.length ? Math.max(...prev.map((r) => r.id)) + 1 : 1, category: "", type: "", difficulty: "", count: "" },
    ]);
  };

  const onRemoveAutoFillRule = (ruleId: number) => {
    setAutoFillRules((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== ruleId) : prev));
  };

  const onUpdateAutoFillRule = (ruleId: number, field: keyof ClientAutoFillRule, value: string) => {
    setAutoFillRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, [field]: value } : r)));
  };

  // CLIENT-SIDE auto-fill: for each rule, READ /my-admin/questions/ filtered by
  // category / type / difficulty, take `count` of them, and merge (dedupe by id)
  // into the selected-state array. No writes.
  const onAutoFill = async () => {
    setAutoFilling(true);
    try {
      const validRules = autoFillRules.filter((r) => r.category && r.type && r.count);
      if (validRules.length === 0) {
        toast({
          title: "Invalid Rules",
          description: "Please select a valid category, type, and count.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      let totalAdded = 0;
      let totalRequested = 0;
      const collected: SelectedQuestion[] = [];
      const alreadyHave = new Set(selectedIds);

      for (const rule of validRules) {
        const want = Number(rule.count) || 0;
        totalRequested += want;
        // The BE accepts a category id or name; we pass the chosen name.
        const data = await getQuestionsByRule({
          category: rule.category,
          question_type: rule.type,
          difficulty: rule.difficulty || "any",
          page_size: Math.max(want, 20),
        }).unwrap();

        const candidates: SelectedQuestion[] = (data?.results?.questions || []).map(toSelectedQuestion);
        let takenForRule = 0;
        for (const q of candidates) {
          if (takenForRule >= want) break;
          if (alreadyHave.has(q.id)) continue;
          alreadyHave.add(q.id);
          collected.push(q);
          takenForRule += 1;
          totalAdded += 1;
        }
      }

      if (totalAdded === 0) {
        toast({
          title: "No matching questions",
          description:
            "No new questions are available for the selected rules. Try a different category, type, or difficulty.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      addSelectedQuestions(collected);

      if (totalRequested && totalAdded < totalRequested) {
        toast({
          title: "Partially filled",
          description: `Added ${totalAdded} of ${totalRequested} requested — not enough questions matched.`,
          duration: 3000,
        });
      } else {
        toast({
          title: "Auto-fill completed",
          description: `Added ${totalAdded} question${totalAdded === 1 ? "" : "s"}`,
          variant: "success",
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error("Auto-fill failed", error);
      toast({
        title: "Auto-fill failed",
        description:
          error?.data?.detail || error?.response?.data?.detail || "Unable to auto-fill questions",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setAutoFilling(false);
    }
  };

  // ----------------------------------------------------------------------
  // Assign Candidates (only after the assessment exists).
  // ----------------------------------------------------------------------
  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [candidateSearch, setCandidateSearch] = React.useState("");
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = React.useState<number[]>([]);
  const [assignedCandidateIds, setAssignedCandidateIds] = React.useState<number[]>([]);
  // candidate id -> CandidateAssessment (assignment) id, needed to unassign.
  const [assignmentIdByCandidate, setAssignmentIdByCandidate] = React.useState<Record<number, number>>({});
  const [assignedCount, setAssignedCount] = React.useState(0);
  const [assigning, setAssigning] = React.useState(false);
  const [unassigning, setUnassigning] = React.useState(false);

  const refreshAssignedCandidateIds = React.useCallback(async () => {
    if (!createdId) return;
    try {
      const res = await getAssessmentCandidatesByStatus({
        id: createdId,
        status: "",
        page: 1,
        page_size: 200,
      }).unwrap();
      const grouped = res?.results ?? res ?? {};
      const rows = [
        ...(grouped.assigned || []),
        ...(grouped.in_progress || []),
        ...(grouped.completed || []),
        ...(grouped.expired || []),
      ];
      const ids: number[] = [];
      const map: Record<number, number> = {};
      rows.forEach((r: any) => {
        const cid = Number(r?.id);
        const aid = Number(r?.candidate_assessment_id);
        if (!Number.isNaN(cid)) {
          ids.push(cid);
          if (!Number.isNaN(aid)) map[cid] = aid;
        }
      });
      setAssignedCandidateIds(ids);
      setAssignmentIdByCandidate(map);
    } catch {
      // Best-effort: leave the optimistic merge as the source of truth.
    }
  }, [createdId, getAssessmentCandidatesByStatus]);

  const handleUnassignCandidate = async (candidateId: number) => {
    const assignmentId = assignmentIdByCandidate[candidateId];
    if (!createdId || !assignmentId) {
      toast({ title: "Can't unassign yet", description: "Try again in a moment.", variant: "destructive", duration: 3000 });
      return;
    }
    try {
      setUnassigning(true);
      await unassignAssessment({
        id: createdId,
        data: { candidate_assessment_ids: [assignmentId] },
      }).unwrap();
      setAssignedCandidateIds((prev) => prev.filter((id) => id !== candidateId));
      setAssignmentIdByCandidate((prev) => {
        const next = { ...prev };
        delete next[candidateId];
        return next;
      });
      setAssignedCount((prev) => Math.max(0, prev - 1));
      toast({ title: "Unassigned", description: "Candidate removed from this assessment.", variant: "success", duration: 2500 });
    } catch (error: any) {
      const errData = error?.data || error?.response?.data;
      toast({ title: "Failed", description: errData?.message || errData?.detail || "Failed to unassign.", variant: "destructive", duration: 3000 });
    } finally {
      setUnassigning(false);
    }
  };

  const fetchCandidates = React.useCallback(
    async (search = "") => {
      try {
        setLoadingCandidates(true);
        let url = `/my-admin/candidates/?page=1&page_size=50`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const data = await getCandidates(url).unwrap();
        setCandidates(data.results?.candidates || []);
      } catch (error) {
        console.error("Failed to fetch candidates:", error);
        toast({
          title: "Failed",
          description: "Failed to load candidates. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      } finally {
        setLoadingCandidates(false);
      }
    },
    [getCandidates]
  );

  // Load (and debounce-search) candidates only on the candidates step.
  React.useEffect(() => {
    if (currentStep !== STEP_CANDIDATES || !createdId) return;
    const timeoutId = setTimeout(() => {
      void fetchCandidates(candidateSearch);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [currentStep, createdId, candidateSearch, fetchCandidates]);

  // Refresh the assigned-id set when landing on the candidates step.
  React.useEffect(() => {
    if (currentStep !== STEP_CANDIDATES || !createdId) return;
    void refreshAssignedCandidateIds();
  }, [currentStep, createdId, refreshAssignedCandidateIds]);

  const toggleCandidate = (candidateId: number) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((cid) => cid !== candidateId) : [...prev, candidateId]
    );
  };

  const toggleAllCandidates = () => {
    const assignable = candidates.filter((c) => !assignedCandidateIds.includes(c.id));
    setSelectedCandidateIds((prev) =>
      prev.length === assignable.length ? [] : assignable.map((c) => c.id)
    );
  };

  const handleAssignSelected = async () => {
    if (!createdId || selectedCandidateIds.length === 0) return;

    try {
      setAssigning(true);
      await assignAssessment({
        id: createdId,
        data: { candidate_ids: selectedCandidateIds },
      }).unwrap();

      toast({
        title: "Success",
        description: `Assessment assigned to ${selectedCandidateIds.length} candidate(s)`,
        variant: "success",
        duration: 3000,
      });

      setAssignedCount((prev) => prev + selectedCandidateIds.length);
      setAssignedCandidateIds((prev) => Array.from(new Set([...prev, ...selectedCandidateIds])));
      setSelectedCandidateIds([]);
      void fetchCandidates(candidateSearch);
      void refreshAssignedCandidateIds();
    } catch (error: any) {
      console.error("Assignment failed:", error);
      const errData = error?.data || error?.response?.data;
      const message =
        errData?.message || errData?.detail || "Failed to assign assessment. Please try again.";
      toast({
        title: "Failed",
        description: message,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setAssigning(false);
    }
  };

  const availableCategories: Category[] = React.useMemo(() => {
    if (categoriesData && Array.isArray(categoriesData)) {
      return categoriesData;
    }
    if (categoriesError) {
      return [
        { id: 1, name: "Python", description: "Category 1" },
        { id: 3, name: "Programming", description: "Imported category: Programming" },
        { id: 6, name: "SQL", description: "" },
      ];
    }
    return [];
  }, [categoriesData, categoriesError]);

  React.useEffect(() => {
    if (categoriesError) {
      toast({
        title: "Failed",
        description: "Failed to fetch categories. Using default categories.",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [categoriesError]);

  // Close categories dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoriesDropdownRef.current &&
        !categoriesDropdownRef.current.contains(event.target as Node)
      ) {
        setShowCategoriesDropdown(false);
      }
    };
    if (showCategoriesDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCategoriesDropdown]);

  // Fetch assessment data for editing — prefill all steps + load its questions
  // into the client-side selected-state.
  React.useEffect(() => {
    const fetchAssessmentForEdit = async () => {
      if (id) {
        try {
          setIsEditing(true);
          setCreatedId(Number(id));

          const data = await getAssessmentById(Number(id)).unwrap();

          if (data.assessment) {
            const assessment = data.assessment;
            const categoryIds = assessment.categories || [];

            setFormData({
              title: assessment.title || "",
              description: assessment.description || "",
              duration: assessment.duration ? assessment.duration.toString() : "",
              categories: categoryIds,
              startDate: formatDateForInput(assessment.start_date) || "",
              endDate: formatDateForInput(assessment.end_date) || "",
              instructions: assessment.instructions || "",
              passingPercentage: assessment.passing_percentage ? String(assessment.passing_percentage) : "",
            });

            setShuffleQuestions(assessment.shuffle_questions || false);
            setShuffleOptions(assessment.shuffle_options || false);
            setEnableCertificate((assessment.passing_percentage || 0) > 0);

            // Load existing questions into the client-side selected-state.
            const existing: SelectedQuestion[] = (data.questions || []).map(toSelectedQuestion);
            setSelectedQuestions(existing);
          }
        } catch (error: any) {
          console.error("Failed to fetch assessment for editing:", error);
          toast({
            title: "Failed",
            description: "Failed to load assessment data. Please try again.",
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    };

    fetchAssessmentForEdit();
  }, [id]);

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
    }
    return "";
  };

  const formatDateForAPI = (dateTimeLocalString: string) => {
    if (!dateTimeLocalString) return "";
    try {
      const date = new Date(dateTimeLocalString);
      return date.toISOString();
    } catch (error) {
      console.error("Error formatting date for API:", error);
      return "";
    }
  };

  // Step 1 (Basic Details) validation.
  const validateDetails = () => {
    const errors: string[] = [];
    if (!formData.title.trim()) errors.push("Title is required");
    return errors;
  };

  // Step 2 (Configuration) validation — duration, schedule, passing.
  const validateConfiguration = () => {
    const errors: string[] = [];

    if (!formData.duration || parseInt(formData.duration) <= 0) {
      errors.push("Valid duration is required");
    }

    if (!formData.startDate) errors.push("Start date is required");
    if (!formData.endDate) errors.push("End date is required");

    if (formData.startDate && formData.endDate) {
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      if (endDate <= startDate) {
        errors.push("End date must be after start date");
      }

      // Prevent scheduling a brand-new assessment in the past. Only enforced on
      // create — editing an assessment that has already started stays allowed.
      if (!isEditing) {
        const now = Date.now();
        if (startDate.getTime() < now) errors.push("Start date cannot be in the past");
        if (endDate.getTime() < now) errors.push("End date cannot be in the past");
      }
    }

    if (enableCertificate) {
      const pct = parseFloat(formData.passingPercentage);
      if (!formData.passingPercentage || Number.isNaN(pct) || pct <= 0 || pct > 100) {
        errors.push("Passing score must be between 1 and 100");
      }
    }

    return errors;
  };

  const toastErrors = (errors: string[]) => {
    errors.forEach((error) =>
      toast({ title: "Validation Error", description: error, variant: "destructive", duration: 3000 })
    );
  };

  // Build the FULL create/update payload, including the selected question ids.
  const buildPayload = () => ({
    title: formData.title.trim(),
    description: formData.description.trim(),
    duration: parseInt(formData.duration),
    categories: formData.categories,
    start_date: formatDateForAPI(formData.startDate),
    end_date: formatDateForAPI(formData.endDate),
    instructions: formData.instructions.trim(),
    shuffle_questions: shuffleQuestions,
    shuffle_options: shuffleOptions,
    is_active: true,
    is_published: false,
    passing_percentage:
      enableCertificate && formData.passingPercentage ? parseFloat(formData.passingPercentage) : 0,
    question_ids: selectedIds,
  });

  const extractError = (error: any): string => {
    let errorMessage = "Failed to save assessment. Please try again.";
    const errData = error.data || error.response?.data;
    if (errData) {
      if (typeof errData === "string") errorMessage = errData;
      else if (errData.detail) errorMessage = errData.detail;
      else if (errData.message) errorMessage = errData.message;
      else if (errData.error) errorMessage = errData.error;
      else if (typeof errData === "object") {
        const fieldErrors = Object.values(errData).flat();
        errorMessage = (fieldErrors[0] as string) || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return errorMessage;
  };

  // THE single create/update call. Runs once at the Review step. On success,
  // captures the id and advances to the Candidates step.
  const handleCreateOrUpdate = async () => {
    // Re-validate the gated steps before the one write.
    const errors = [...validateDetails(), ...validateConfiguration()];
    if (errors.length > 0) {
      toastErrors(errors);
      return;
    }
    if (totalSelectedQuestions === 0) {
      toast({
        title: "Add questions",
        description: "Add at least one question before creating the assessment.",
        variant: "destructive",
        duration: 3000,
      });
      setCurrentStep(STEP_QUESTIONS);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload();

      if (isEditing && createdId) {
        await updateAssessment({ id: createdId, data: payload }).unwrap();
        toast({
          title: "Success",
          description: "Assessment updated — now assign candidates.",
          variant: "success",
          duration: 3000,
        });
        setCurrentStep(STEP_CANDIDATES);
        return;
      }

      const result = await createAssessment(payload).unwrap();
      const newId = result?.assessment?.id ?? result?.id ?? result?.data?.id;

      if (newId) {
        setCreatedId(Number(newId));
        toast({
          title: "Success",
          description: "Assessment created — now assign candidates.",
          variant: "success",
          duration: 3000,
        });
        setCurrentStep(STEP_CANDIDATES);
        return;
      }

      // Fallback: API didn't echo an id — bounce to the list.
      toast({
        title: "Created",
        description: "Assessment created.",
        variant: "success",
        duration: 3000,
      });
      setTimeout(() => navigate("/admin/assessments"), 1200);
    } catch (error: any) {
      console.error("Error submitting assessment:", error);
      toast({ title: "Error", description: extractError(error), variant: "destructive", duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to get category names for display
  const getCategoryNames = () => {
    return formData.categories
      .map((catId) => availableCategories.find((c) => c.id === catId)?.name)
      .filter(Boolean);
  };

  const handleCategoryToggle = (categoryId: number) => {
    const updatedCategories = formData.categories.includes(categoryId)
      ? formData.categories.filter((cid) => cid !== categoryId)
      : [...formData.categories, categoryId];

    handleInputChange("categories", updatedCategories);
  };

  const handleSelectAllCategories = () => {
    if (formData.categories.length === availableCategories.length) {
      handleInputChange("categories", []);
    } else {
      handleInputChange(
        "categories",
        availableCategories.map((cat) => cat.id)
      );
    }
  };

  // --- Wizard navigation ---
  // Keep Next/Finish clickable so the user always gets a clear reason (via
  // validation on click) instead of a silently-disabled button.
  const canProceed = true;

  const handleNext = async () => {
    if (currentStep === STEP_DETAILS) {
      const errors = validateDetails();
      if (errors.length > 0) {
        toastErrors(errors);
        return;
      }
      setCurrentStep(STEP_CONFIG);
      return;
    }

    if (currentStep === STEP_CONFIG) {
      const errors = validateConfiguration();
      if (errors.length > 0) {
        toastErrors(errors);
        return;
      }
      setCurrentStep(STEP_QUESTIONS);
      return;
    }

    if (currentStep === STEP_QUESTIONS) {
      if (totalSelectedQuestions === 0) {
        toast({
          title: "Add questions",
          description: "Add at least one question before continuing.",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }
      setCurrentStep(STEP_REVIEW);
      return;
    }

    if (currentStep === STEP_REVIEW) {
      // The shell's Next on the Review step performs the ONE create/update call
      // (same as the in-card "Create/Update Assessment" button).
      await handleCreateOrUpdate();
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleStepSelect = (index: number) => {
    // Free movement among the no-write steps (1-4). The Candidates step (5)
    // requires the assessment to exist.
    if (index === STEP_CANDIDATES && !createdId) return;
    setCurrentStep(index);
  };

  // Finish (only shown on the last step — Candidates).
  const handleFinish = () => {
    navigate("/admin/assessments");
  };

  const durationLabel = formData.duration ? `${formData.duration} min` : "—";
  const passingLabel =
    enableCertificate && formData.passingPercentage ? `${formData.passingPercentage}%` : "—";

  const summary = {
    name: formData.title,
    totalQuestions: totalSelectedQuestions,
    totalCandidates: assignedCount,
    duration: durationLabel,
    passingScore: passingLabel,
  };

  return (
    <AdminLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {isEditing ? "Edit Assessment" : "Create Assessment"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {isEditing ? "Update assessment details and questions." : "Build a new assessment for candidates."}
            </p>
          </div>
          <button
            title="Back to Assessments"
            onClick={() => navigate("/admin/assessments")}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-brand-violet" />
              <p className="text-sm text-slate-600">
                {isEditing ? "Loading assessment data..." : "Loading categories..."}
              </p>
            </div>
          </div>
        ) : (
          <AssessmentWizardShell
            steps={WIZARD_STEPS}
            currentIndex={currentStep}
            canProceed={canProceed}
            onBack={handleBack}
            onNext={handleNext}
            onFinish={handleFinish}
            onStepSelect={handleStepSelect}
            summary={summary}
            busy={isSubmitting}
          >
            {/* Step 1: Basic Details */}
            {currentStep === STEP_DETAILS && (
              <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Basic Details</h2>

                {/* Title */}
                <div>
                  <label className={LABEL_CLASS}>
                    Assessment Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter assessment title"
                    required
                    disabled={isSubmitting}
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Enter assessment description (optional)"
                    rows={3}
                    disabled={isSubmitting}
                    className={TEXTAREA_CLASS}
                  />
                </div>

                {/* Tech Stack / Topics (= categories) */}
                <div className="relative" ref={categoriesDropdownRef}>
                  <label className={LABEL_CLASS}>Tech Stack / Topics</label>

                  <button
                    type="button"
                    onClick={() => !isSubmitting && setShowCategoriesDropdown((prev) => !prev)}
                    disabled={isSubmitting}
                    className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50 disabled:cursor-not-allowed disabled:bg-slate-50"
                  >
                    <span className="truncate">
                      {formData.categories.length > 0
                        ? getCategoryNames().join(", ")
                        : "Select tech stack / topics"}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>

                  {showCategoriesDropdown && !isSubmitting && (
                    <div className="absolute z-50 mt-2 max-h-60 w-full space-y-0.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1.5 text-sm shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5">
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-violet-50">
                        <input
                          type="checkbox"
                          checked={formData.categories.length === availableCategories.length}
                          onChange={handleSelectAllCategories}
                          className="h-4 w-4 rounded border-slate-300 accent-brand-violet"
                          disabled={isSubmitting}
                        />
                        <span className="font-medium">Select All</span>
                      </label>

                      <div className="my-1 border-t border-slate-100"></div>

                      {availableCategories.map((category) => (
                        <label
                          key={category.id}
                          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-violet-50"
                        >
                          <input
                            type="checkbox"
                            checked={formData.categories.includes(category.id)}
                            onChange={() => handleCategoryToggle(category.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-brand-violet"
                            disabled={isSubmitting}
                          />
                          <span className="flex-1">{category.name}</span>
                        </label>
                      ))}

                      {availableCategories.length === 0 && (
                        <p className="p-2 text-center text-xs text-slate-500">No topics available</p>
                      )}
                    </div>
                  )}

                  <p className="mt-1 text-xs text-slate-500">
                    {formData.categories.length > 0
                      ? `${formData.categories.length} selected`
                      : "Select one or more tech stacks / topics"}
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {currentStep === STEP_CONFIG && (
              <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Configuration</h2>

                {/* Duration */}
                <div>
                  <label className={LABEL_CLASS}>
                    Time Limit (minutes) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => handleInputChange("duration", e.target.value)}
                    placeholder="Enter duration in minutes"
                    required
                    min="1"
                    disabled={isSubmitting}
                    className={INPUT_CLASS}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {formData.duration
                      ? `≈ ${Math.floor(parseInt(formData.duration) / 60)}h ${parseInt(formData.duration) % 60}m total`
                      : "Total time allowed for the assessment"}
                  </p>
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={LABEL_CLASS}>
                      Available From <span className="text-rose-500">*</span>
                    </label>
                    <DateTimePicker
                      value={formData.startDate}
                      onChange={(v) => handleInputChange("startDate", v)}
                      placeholder="Select start date & time"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      Available Until <span className="text-rose-500">*</span>
                    </label>
                    <DateTimePicker
                      value={formData.endDate}
                      onChange={(v) => handleInputChange("endDate", v)}
                      placeholder="Select end date & time"
                      align="right"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-sm font-semibold text-slate-700">Candidate Instructions</label>
                    <button
                      type="button"
                      onClick={() => handleInputChange("instructions", DEFAULT_ASSESSMENT_INSTRUCTIONS)}
                      disabled={isSubmitting || formData.instructions === DEFAULT_ASSESSMENT_INSTRUCTIONS}
                      className="text-xs font-semibold text-brand-violet transition-colors hover:text-brand-purple disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Reset to default
                    </button>
                  </div>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => handleInputChange("instructions", e.target.value)}
                    placeholder="Enter instructions for candidates"
                    rows={3}
                    disabled={isSubmitting}
                    className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-700 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50 disabled:cursor-not-allowed disabled:bg-slate-50"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Pre-filled with standard instructions — edit or add your own as needed.
                  </p>
                </div>

                {/* Passing criteria */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={enableCertificate}
                      onChange={(e) => {
                        setEnableCertificate(e.target.checked);
                        if (!e.target.checked) handleInputChange("passingPercentage", "");
                      }}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Issue a completion certificate</p>
                      <p className="text-xs text-slate-500">Issue a downloadable certificate to candidates who pass</p>
                    </div>
                  </div>
                  {enableCertificate && (
                    <div className="ml-5">
                      <label className={LABEL_CLASS}>
                        Passing Score (%) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.passingPercentage}
                        onChange={(e) => handleInputChange("passingPercentage", e.target.value)}
                        placeholder="e.g., 70"
                        min="1"
                        max="100"
                        step="0.1"
                        disabled={isSubmitting}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Candidates scoring at or above this % will get a certificate.
                      </p>
                    </div>
                  )}
                </div>

                {/* Settings */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => !isSubmitting && setShuffleQuestions(e.target.checked)}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Randomize question order</p>
                      <p className="text-xs text-slate-500">Randomize question order for each candidate</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => !isSubmitting && setShuffleOptions(e.target.checked)}
                      disabled={isSubmitting}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Randomize answer options</p>
                      <p className="text-xs text-slate-500">Randomize MCQ options order</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Questions (client-side selection — NO API writes) */}
            {currentStep === STEP_QUESTIONS && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-800">Questions</h2>
                  <span className="text-xs font-medium text-slate-500">
                    {totalSelectedQuestions} selected
                  </span>
                </div>

                {totalSelectedQuestions === 0 && (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700">
                      Add at least one question — you can't create a regular assessment with zero questions.
                    </p>
                  </div>
                )}

                <WizardQuestionStepClient
                  selectedQuestions={selectedQuestions}
                  onRemoveQuestion={onRemoveQuestion}
                  selectedIds={selectedIds}
                  bankQuestions={bankQuestions}
                  loadingBank={loadingBank}
                  loadingMoreBank={loadingMoreBank}
                  onScroll={onBankScroll}
                  onAddQuestion={onAddQuestion}
                  searchQuery={bankSearch}
                  onSearchQueryChange={setBankSearch}
                  onClearSearch={onClearBankSearch}
                  categories={dedupedCategories}
                  autoFillRules={autoFillRules}
                  isAutoFillValid={isAutoFillValid}
                  autoFilling={autoFilling}
                  onAddAutoFillRule={onAddAutoFillRule}
                  onRemoveAutoFillRule={onRemoveAutoFillRule}
                  onUpdateAutoFillRule={onUpdateAutoFillRule}
                  onAutoFill={onAutoFill}
                />
              </div>
            )}

            {/* Step 4: Review & Confirmation */}
            {currentStep === STEP_REVIEW && (
              <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Review &amp; Confirmation</h2>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Left: summary */}
                  <div className="space-y-4">
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                      <ReviewRow label="Assessment Name" value={formData.title || "—"} />
                      <ReviewRow label="Duration" value={durationLabel} />
                      <ReviewRow
                        label="Tech Stack / Topics"
                        value={getCategoryNames().join(", ") || "—"}
                      />
                      <ReviewRow label="Passing Score" value={passingLabel} />
                      <ReviewRow label="Available From" value={formData.startDate || "—"} />
                      <ReviewRow label="Available Until" value={formData.endDate || "—"} />
                      <ReviewRow label="Total Questions" value={String(totalSelectedQuestions)} />
                      <ReviewRow label="Certificate" value={enableCertificate ? "Enabled" : "Disabled"} />
                      <ReviewRow label="Randomize questions" value={shuffleQuestions ? "Yes" : "No"} />
                      <ReviewRow label="Randomize options" value={shuffleOptions ? "Yes" : "No"} />
                    </dl>
                    {formData.description && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Description</p>
                        <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700">
                          {formData.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right: selected questions */}
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      Selected Questions ({selectedQuestions.length})
                    </p>
                    {selectedQuestions.length > 0 ? (
                      <ul className="max-h-[20rem] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 px-3">
                        {selectedQuestions.map((q) => (
                          <li key={q.id} className="py-2">
                            <p className="mb-1 line-clamp-2 text-sm font-medium text-slate-800">{q.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                                {getQuestionTypeDisplay(q.question_type)}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getDifficultyColor(
                                  q.difficulty
                                )}`}
                              >
                                {q.difficulty}
                              </span>
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-brand-violet ring-1 ring-inset ring-violet-100">
                                {getMarksDisplay(q.marks)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex h-[20rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 px-4 text-center">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <p className="text-xs text-amber-700">
                          No questions added. Go back to the Questions step before creating.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* The ONLY create/update call. */}
                <div className="border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={handleCreateOrUpdate}
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isEditing ? "Update Assessment" : "Create Assessment"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Candidates */}
            {currentStep === STEP_CANDIDATES && (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <WizardCandidateStep
                  candidates={candidates}
                  loading={loadingCandidates}
                  search={candidateSearch}
                  onSearchChange={setCandidateSearch}
                  selectedIds={selectedCandidateIds}
                  onToggle={toggleCandidate}
                  onToggleAll={toggleAllCandidates}
                  onAssign={handleAssignSelected}
                  assigning={assigning}
                  assignedIds={assignedCandidateIds}
                  onUnassign={handleUnassignCandidate}
                  unassigning={unassigning}
                />
              </div>
            )}
          </AssessmentWizardShell>
        )}
      </div>
    </AdminLayout>
  );
};

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
  </div>
);
