import { sanitizeHtml } from "@/lib/sanitize";
import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AdminLayout from "@/components/AdminLayout";
import { useToast } from "@/components/ui/use-toast";
import {
  useGetStacksQuery,
  useLazyGetAiAssessmentByIdQuery,
  useUpdateAiAssessmentMutation,
  useCreateAiAssessmentMutation,
  useLazyGetHardcodedQuestionsQuery,
  useLazyGetCandidatesQuery,
  useAssignAiAssessmentMutation,
  useUnassignAiAssessmentMutation,
} from "@/store";
import {
  ArrowLeft,
  Sparkles,
  X,
  Brain,
  Mic,
  Video,
  Crown,
  FileText,
  MessageSquare,
  CheckCircle,
  GraduationCap,
  Code,
} from "lucide-react";
import {
  AI_EXPERIENCE_TO_LABEL_MAP,
  AI_LABEL_TO_EXPERIENCE_MAP,
  AI_LABEL_TO_ROLE_MAP,
  AI_ROLE_TO_LABEL_MAP,
} from "@/constants/roleMappings";
import { DateTimePicker } from "@/components/common/DateTimePicker";
import { Dropdown, type DropdownOption } from "@/components/common/Dropdown";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { TECH_OPTIONS } from "@/lib/techOptions";
import { parseResume } from "@/APIs/services/ai_interview.service";
import { LABEL_CLASS, INPUT_CLASS, TEXTAREA_CLASS } from "@/lib/uiStyles";
import {
  AssessmentWizardShell,
  type WizardStep,
} from "@/components/assessments/AssessmentWizardShell";
import { WizardCandidateStep } from "@/components/assessments/WizardCandidateStep";

const REFERENCE_DOC_ACCEPT = ".pdf,.doc,.docx,.txt";
const REFERENCE_DOC_MAX_BYTES = 5 * 1024 * 1024;

const WIZARD_STEPS: WizardStep[] = [
  { key: "basic", label: "Basic Details" },
  { key: "config", label: "Configuration" },
  { key: "review", label: "Review" },
  { key: "candidates", label: "Candidates" },
];

const STEP_BASIC = 0;
const STEP_CONFIG = 1;
const STEP_REVIEW = 2;
const STEP_CANDIDATES = 3;

const DEFAULT_AI_INSTRUCTIONS = `1. Ensure your camera and microphone are working and allowed in the browser.
2. Sit in a quiet, well-lit room with a stable internet connection.
3. The AI interviewer asks one question at a time — answer clearly and naturally.
4. Your responses are recorded and analyzed automatically.
5. Do not refresh, close, or switch away from the interview tab.
6. Use of external help, resources, or devices is not allowed.`;

// Keywords matched (case-insensitive) against the backend stack names to surface
// the technologies relevant to a given interview role.
const ROLE_TECH_KEYWORDS: Record<string, string[]> = {
  frontend_developer: ["react", "angular", "vue", "javascript", "typescript", "html", "css", "next", "redux", "tailwind", "frontend", "svelte"],
  backend_developer: ["node", "express", "django", "flask", "spring", "java", "python", "sql", "postgres", "mysql", "mongodb", "api", "backend", "php", "laravel", ".net", "c#", "go", "ruby"],
  fullstack_developer: ["react", "angular", "vue", "javascript", "typescript", "node", "express", "django", "spring", "java", "python", "sql", "mongodb", "html", "css", "next"],
  java_developer: ["java", "spring", "hibernate", "sql", "maven", "jpa", "microservices", "kafka"],
  python_developer: ["python", "django", "flask", "fastapi", "pandas", "numpy", "sql"],
  mern_stack_developer: ["mongodb", "express", "react", "node", "javascript", "typescript"],
  mean_stack_developer: ["mongodb", "express", "angular", "node", "javascript", "typescript"],
  devops_engineer: ["docker", "kubernetes", "aws", "azure", "gcp", "terraform", "jenkins", "ci/cd", "ansible", "linux", "devops", "helm"],
  machine_learning_engineer: ["python", "tensorflow", "pytorch", "scikit", "machine learning", "ml", "deep learning", "numpy", "pandas"],
  data_scientist: ["python", "r", "pandas", "numpy", "scikit", "statistics", "machine learning", "sql", "tensorflow"],
  data_engineer: ["python", "sql", "spark", "hadoop", "airflow", "etl", "kafka", "aws", "snowflake", "databricks"],
  ai_engineer: ["python", "tensorflow", "pytorch", "llm", "nlp", "machine learning", "ai", "deep learning", "langchain"],
  ux_designer: ["figma", "sketch", "adobe xd", "ui", "ux", "design", "prototyping", "wireframe"],
  salesforce_developer: ["salesforce", "apex", "visualforce", "lwc", "lightning", "soql"],
  salesforce_admin: ["salesforce", "admin", "flow", "lightning"],
  tableau_developer: ["tableau", "sql", "data visualization", "dashboard"],
  power_bi_developer: ["power bi", "powerbi", "dax", "sql", "data visualization", "dashboard"],
  data_analyst: ["sql", "excel", "tableau", "power bi", "python", "statistics", "data analysis"],
};

const EXPERIENCE_LEVEL_OPTIONS: DropdownOption<string>[] = [
  { value: "Fresher", label: "Fresher" },
  { value: "0-2 years", label: "0-2 years" },
  { value: "2-5 years", label: "2-5 years" },
  { value: "5-8 years", label: "5-8 years" },
  { value: "8+ years", label: "8+ years" },
];

const INTERVIEWER_PERSONA_OPTIONS: DropdownOption<string>[] = [
  { value: "friendly", label: "Friendly & encouraging" },
  { value: "neutral", label: "Neutral & professional" },
  { value: "challenging", label: "Challenging & probing" },
];

export const CreateAIAssessment: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { id: editId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  // editId is the route param; assessmentId is the live id (route param OR the id
  // captured right after create) used to drive candidate assignment in place.
  const [createdId, setCreatedId] = React.useState<number | null>(null);
  const assessmentId = editId ? Number(editId) : createdId;
  const isEditMode = Boolean(editId);
  const isConfigured = Boolean(assessmentId);

  // In edit mode, `?step=candidates` lands the wizard straight on the last step
  // so admins can add/remove candidates without clicking through.
  const [currentStep, setCurrentStep] = React.useState(
    editId && searchParams.get("step") === "candidates" ? STEP_CANDIDATES : 0
  );
  const [isLoadingData, setIsLoadingData] = React.useState(false);
  const [formData, setFormData] = React.useState({
    title: "",
    description: "",
    interviewRole: "",
    techStack: [] as string[],
    experienceLevel: "",
    numberOfAiQuestions: "",
    numberOfHardcodedQuestions: "",
    numberOfCodingQuestions: "0",
    codingTimeLimit: "10",
    startDateTime: "",
    endDateTime: "",
    instructions: DEFAULT_AI_INSTRUCTIONS,
    passingPercentage: "",
  });
  const [enableVoiceRecording, setEnableVoiceRecording] = React.useState(true);
  const [enableCameraMonitoring, setEnableCameraMonitoring] = React.useState(true);
  const [activeAssessment, setActiveAssessment] = React.useState(true);
  const [enableCertificate, setEnableCertificate] = React.useState(false);
  const [assessmentType, setAssessmentType] = React.useState<"regular" | "premium">("regular");
  const [requireResume, setRequireResume] = React.useState(true);
  const [generateFromResume, setGenerateFromResume] = React.useState(true);
  const [targetTechnologies, setTargetTechnologies] = React.useState<string[]>([]);
  const [dynamicFollowups, setDynamicFollowups] = React.useState(true);
  const [maxFollowups, setMaxFollowups] = React.useState("2");
  const [interviewerPersona, setInterviewerPersona] = React.useState("neutral");
  const [referenceDocType, setReferenceDocType] = React.useState<"jd" | "resume_sample">("jd");
  const [referenceDocName, setReferenceDocName] = React.useState("");
  const [referenceData, setReferenceData] = React.useState<any>(null);
  const [referenceParsing, setReferenceParsing] = React.useState(false);
  const [referenceError, setReferenceError] = React.useState("");
  const referenceInputRef = React.useRef<HTMLInputElement>(null);
  const isPremium = assessmentType === "premium";
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [hasCodingQuestions, setHasCodingQuestions] = React.useState(false);
  const [editQuestionsLoaded, setEditQuestionsLoaded] = React.useState(false);
  const [availableQuestions, setAvailableQuestions] = React.useState<{ id: number; title: string }[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<(string | number)[]>([]);
  const [questionsLoading, setQuestionsLoading] = React.useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = React.useState(false);
  const [questionSearch, setQuestionSearch] = React.useState("");
  const [showQuestionsModal, setShowQuestionsModal] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [questionsPage, setQuestionsPage] = React.useState(1);
  const [hasMoreQuestions, setHasMoreQuestions] = React.useState(true);
  const [totalQuestionsCount, setTotalQuestionsCount] = React.useState(0);
  const QUESTIONS_PAGE_SIZE = 20;
  const navigate = useNavigate();
  const { toast } = useToast();

  // RTK Query hooks
  const { data: stacksData } = useGetStacksQuery();
  const [getAiAssessmentById] = useLazyGetAiAssessmentByIdQuery();
  const [updateAiAssessmentMut] = useUpdateAiAssessmentMutation();
  const [createAiAssessmentMut] = useCreateAiAssessmentMutation();
  const [getHardcodedQuestions] = useLazyGetHardcodedQuestionsQuery();
  const [getCandidates] = useLazyGetCandidatesQuery();
  const [assignAiAssessment] = useAssignAiAssessmentMutation();
  const [unassignAiAssessment] = useUnassignAiAssessmentMutation();

  const availableStacks: string[] = React.useMemo(
    () => (Array.isArray(stacksData) ? stacksData : []),
    [stacksData]
  );

  // Premium always runs a video + voice interview, so force those on.
  React.useEffect(() => {
    if (isPremium) {
      setEnableVoiceRecording(true);
      setEnableCameraMonitoring(true);
    }
  }, [isPremium]);

  // --- Candidate assignment (AI) ---
  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [candidateSearch, setCandidateSearch] = React.useState("");
  const [loadingCandidates, setLoadingCandidates] = React.useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = React.useState<number[]>([]);
  const [assignedCandidateIds, setAssignedCandidateIds] = React.useState<number[]>([]);
  // candidate id -> CandidateAIAssessment (assignment) id, needed to unassign.
  const [assignmentIdByCandidate, setAssignmentIdByCandidate] = React.useState<Record<number, number>>({});
  const [assignedCount, setAssignedCount] = React.useState(0);
  const [assigning, setAssigning] = React.useState(false);
  const [unassigning, setUnassigning] = React.useState(false);

  // Reads the already-assigned candidate ids from an AI assessment payload.
  // The serializer uses fields="__all__", so each item's `candidate` is the FK id
  // and `id` is the CandidateAIAssessment (assignment) id.
  const extractAssignedIds = (data: any): number[] =>
    (data?.assigned_candidates || [])
      .map((a: any) => Number(a?.candidate ?? a?.candidate_id ?? a?.candidate?.id))
      .filter((n: number) => !Number.isNaN(n));

  const extractAssignmentMap = (data: any): Record<number, number> => {
    const map: Record<number, number> = {};
    (data?.assigned_candidates || []).forEach((a: any) => {
      const cid = Number(a?.candidate ?? a?.candidate_id ?? a?.candidate?.id);
      const aid = Number(a?.id);
      if (!Number.isNaN(cid) && !Number.isNaN(aid)) map[cid] = aid;
    });
    return map;
  };

  const applyAssignedData = (data: any) => {
    setAssignedCandidateIds(extractAssignedIds(data));
    setAssignmentIdByCandidate(extractAssignmentMap(data));
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
    [getCandidates, toast]
  );

  React.useEffect(() => {
    if (!isConfigured || currentStep !== STEP_CANDIDATES) return;
    const timeoutId = setTimeout(() => {
      void fetchCandidates(candidateSearch);
    }, 400);
    return () => clearTimeout(timeoutId);
  }, [isConfigured, currentStep, candidateSearch, fetchCandidates]);

  // Refresh already-assigned ids whenever we land on the candidates step with a
  // live assessment id (covers freshly-created assessments that skip edit-load).
  React.useEffect(() => {
    if (!assessmentId || currentStep !== STEP_CANDIDATES) return;
    getAiAssessmentById(assessmentId)
      .unwrap()
      .then((data) => applyAssignedData(data))
      .catch(() => { });
  }, [assessmentId, currentStep, getAiAssessmentById]);

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

  // Reuse the AI assign mutation (useAssignAiAssessmentMutation). The AI generates
  // questions from the assessment role/JD, so resume_text is sent empty here.
  const handleAssignSelected = async () => {
    if (!assessmentId || selectedCandidateIds.length === 0) return;
    try {
      setAssigning(true);
      await assignAiAssessment({
        id: assessmentId,
        data: { candidate_ids: selectedCandidateIds, resume_text: "" },
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
      // Refresh so the assignment-id map covers the newly-assigned candidates
      // (needed to unassign them).
      if (assessmentId) {
        getAiAssessmentById(assessmentId).unwrap().then(applyAssignedData).catch(() => { });
      }
    } catch (error: any) {
      const errData = error?.data || error?.response?.data;
      const message =
        errData?.detail || errData?.message || "Failed to assign assessment. Please try again.";
      toast({ title: "Error", description: message, variant: "destructive", duration: 4000 });
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignCandidate = async (candidateId: number) => {
    const assignmentId = assignmentIdByCandidate[candidateId];
    if (!assessmentId || !assignmentId) {
      toast({ title: "Can't unassign yet", description: "Try again in a moment.", variant: "destructive", duration: 3000 });
      return;
    }
    try {
      setUnassigning(true);
      await unassignAiAssessment({
        id: assessmentId,
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

  // Debounced search (hardcoded questions modal)
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const debounceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    debounceTimeoutRef.current = setTimeout(() => setDebouncedSearch(questionSearch), 500);
    return () => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, [questionSearch]);

  const fetchHardcodedQuestions = React.useCallback(
    async (page = 1, append = false) => {
      if (!showQuestionsModal) return;

      if (page === 1) {
        setQuestionsLoading(true);
        if (!append) setAvailableQuestions([]);
        setHasMoreQuestions(true);
      } else {
        setLoadMoreLoading(true);
      }

      try {
        const data = await getHardcodedQuestions({
          stack: categoryFilter || "",
          page: String(page),
          page_size: String(QUESTIONS_PAGE_SIZE),
          search: debouncedSearch,
        }).unwrap();

        const list = data?.results?.questions || data?.questions || data?.results || [];
        setAvailableQuestions((prev) => (append && page > 1 ? [...prev, ...list] : list));
        setQuestionsPage(page);

        let totalCount = 0;
        if (data?.count !== undefined) totalCount = data.count;
        else if (data?.total !== undefined) totalCount = data.total;
        else if (data?.pagination?.total !== undefined) totalCount = data.pagination.total;
        else totalCount = list.length;
        setTotalQuestionsCount(totalCount);

        const nextPageExists =
          Boolean(data?.next) || (Array.isArray(list) && list.length === QUESTIONS_PAGE_SIZE);
        setHasMoreQuestions(nextPageExists);
      } catch {
        if (!append) {
          setAvailableQuestions([]);
          setTotalQuestionsCount(0);
        }
        setHasMoreQuestions(false);
      } finally {
        setQuestionsLoading(false);
        setLoadMoreLoading(false);
      }
    },
    [categoryFilter, getHardcodedQuestions, debouncedSearch, showQuestionsModal]
  );

  const handleQuestionListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (
      hasMoreQuestions &&
      !loadMoreLoading &&
      !questionsLoading &&
      target.scrollTop + target.clientHeight >= target.scrollHeight - 120
    ) {
      fetchHardcodedQuestions(questionsPage + 1, true);
    }
  };

  const [stackSearch, setStackSearch] = React.useState("");
  const [showStackDropdown, setShowStackDropdown] = React.useState(false);
  const [selectedQuestions, setSelectedQuestions] = React.useState<any[]>([]);

  const filteredQuestions = React.useMemo(() => {
    return availableQuestions.filter((q: any) => {
      const type = q.question_type?.toLowerCase() || "";
      if (type.includes("mcq") || type.includes("single") || type.includes("multiple")) return false;
      return true;
    });
  }, [availableQuestions]);

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStackDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!showQuestionsModal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showQuestionsModal]);

  React.useEffect(() => {
    if (!showQuestionsModal) return;
    setQuestionsPage(1);
    setHasMoreQuestions(true);
    fetchHardcodedQuestions(1, false);
  }, [showQuestionsModal, categoryFilter, debouncedSearch]);

  const stripInlineStyles = (html: string): string => {
    if (!html) return "";
    return html.replace(/style="[^"]*"/gi, "").replace(/color:\s*#ffffff[^;]*;?/gi, "");
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const clearReferenceDoc = () => {
    setReferenceDocName("");
    setReferenceData(null);
    setReferenceError("");
    if (referenceInputRef.current) referenceInputRef.current.value = "";
  };

  const handleReferenceFile = async (file: File | undefined | null) => {
    if (!file) return;
    setReferenceError("");

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!["pdf", "doc", "docx", "txt"].includes(ext)) {
      setReferenceError("Unsupported file. Upload a PDF, DOC, DOCX, or TXT.");
      return;
    }
    if (file.size > REFERENCE_DOC_MAX_BYTES) {
      setReferenceError("File must be smaller than 5MB.");
      return;
    }

    setReferenceDocName(file.name);
    setReferenceParsing(true);
    setReferenceData(null);

    try {
      const res = await parseResume(file);
      setReferenceData(res?.resume_data || res || null);
    } catch (err) {
      console.error("Failed to parse reference document", err);
      setReferenceError("Could not read this document. The file is attached but text extraction failed.");
    } finally {
      setReferenceParsing(false);
    }
  };

  const resolveRoleValue = (role: string): string => {
    if (!role) return "";
    if (ROLE_TECH_KEYWORDS[role]) return role;
    return AI_LABEL_TO_ROLE_MAP[role] || role;
  };

  const matchesRole = (tech: string, keywords: string[]) => {
    const t = tech.toLowerCase();
    return keywords.some((kw) => t.includes(kw) || kw.includes(t));
  };

  const relevantTechnologies = React.useMemo(() => {
    const keywords = ROLE_TECH_KEYWORDS[resolveRoleValue(formData.interviewRole)];
    if (!keywords) return [];
    return availableStacks.filter((s) => matchesRole(s, keywords));
  }, [formData.interviewRole, availableStacks]);

  const displayTechnologies = React.useMemo(() => {
    const set = new Set<string>(relevantTechnologies);
    targetTechnologies.forEach((t) => set.add(t));
    return Array.from(set);
  }, [relevantTechnologies, targetTechnologies]);

  const MAX_TECH_STACK = 10;
  const handleAddSkill = (skill: string) => {
    setFormData((prev) => {
      if (prev.techStack.includes(skill)) return prev;
      if (prev.techStack.length >= MAX_TECH_STACK) {
        toast({ title: "Up to 10 skills", description: "You can pick up to 10 technologies.", variant: "destructive", duration: 3000 });
        return prev;
      }
      return { ...prev, techStack: [...prev.techStack, skill] };
    });
  };
  const handleRemoveSkill = (skill: string) => {
    setFormData((prev) => ({ ...prev, techStack: prev.techStack.filter((s) => s !== skill) }));
  };

  const formatDateForAPI = (dateTimeString: string) => {
    if (!dateTimeString) return "";
    const date = new Date(dateTimeString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  };

  const mapExperienceToBackend = (experience: string): string => AI_LABEL_TO_EXPERIENCE_MAP[experience] || experience;
  const mapRoleFromBackend = (role: string): string => AI_ROLE_TO_LABEL_MAP[role] || role;
  const mapExperienceFromBackend = (exp: string): string => AI_EXPERIENCE_TO_LABEL_MAP[exp] || exp;

  const formatDateForInput = (dateString: string) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openQuestionsModal = () => {
    setShowQuestionsModal(true);
    setCategoryFilter("");
    setQuestionSearch("");
    setDebouncedSearch("");
    setStackSearch("");
    setAvailableQuestions([]);
    setQuestionsPage(1);
    setHasMoreQuestions(true);
    setTotalQuestionsCount(0);
    setQuestionsLoading(true);
  };

  // Fetch existing assessment data in edit mode
  React.useEffect(() => {
    if (!editId) return;
    setIsLoadingData(true);
    getAiAssessmentById(Number(editId))
      .unwrap()
      .then((data) => {
        const a = data.assessment;
        applyAssignedData(data);
        setFormData({
          title: a.title || "",
          description: a.description || "",
          interviewRole: mapRoleFromBackend(a.role_type),
          techStack: Array.isArray(a.tech_stack) ? a.tech_stack : [],
          experienceLevel: mapExperienceFromBackend(a.experience_level),
          numberOfAiQuestions: String(a.num_questions || ""),
          numberOfHardcodedQuestions: String(a.num_hardcoded_questions || ""),
          numberOfCodingQuestions: String(a.num_coding_questions || 0),
          codingTimeLimit: String(a.coding_time_limit || 10),
          startDateTime: formatDateForInput(a.start_date),
          endDateTime: formatDateForInput(a.end_date),
          instructions: a.instructions || "",
          passingPercentage: a.passing_percentage ? String(a.passing_percentage) : "",
        });
        setEnableVoiceRecording(a.enable_voice_recording ?? true);
        setEnableCameraMonitoring(a.enable_camera ?? true);
        setActiveAssessment(a.is_active ?? true);
        setEnableCertificate((a.passing_percentage || 0) > 0);
        setAssessmentType(a.assessment_type === "premium" ? "premium" : "regular");
        setRequireResume(a.require_resume ?? true);
        setGenerateFromResume(a.generate_questions_from_resume ?? true);
        setTargetTechnologies(Array.isArray(a.target_technologies) ? a.target_technologies : []);
        setDynamicFollowups(a.dynamic_followups ?? true);
        setMaxFollowups(String(a.max_followups ?? 2));
        setInterviewerPersona(a.interviewer_persona || "neutral");
        setReferenceDocType(a.reference_document_type === "resume_sample" ? "resume_sample" : "jd");
        setReferenceDocName(a.reference_document_name || "");
        setReferenceData(a.reference_document_data ?? null);
        if (a.hardcoded_question_ids && Array.isArray(a.hardcoded_question_ids)) {
          setSelectedQuestionIds(a.hardcoded_question_ids);
        }
      })
      .catch((error) => {
        console.error("Error loading assessment:", error);
        toast({ title: "Error", description: "Failed to load assessment data", variant: "destructive", duration: 3000 });
      })
      .finally(() => setIsLoadingData(false));
  }, [editId]);

  React.useEffect(() => {
    if (!isEditMode || selectedQuestionIds.length === 0 || editQuestionsLoaded) return;

    getHardcodedQuestions({ stack: "", page: "1", page_size: "100", search: "" })
      .unwrap()
      .then((data) => {
        const list = data?.results?.questions || data?.questions || data?.results || [];
        const matched = list.filter((q: any) => selectedQuestionIds.includes(q.id));
        if (matched.length > 0) {
          setSelectedQuestions(matched);
          setHasCodingQuestions(matched.some((q: any) => q.question_type?.toLowerCase() === "coding"));
        }
      })
      .catch(() => { })
      .finally(() => setEditQuestionsLoaded(true));
  }, [isEditMode, selectedQuestionIds.length, editQuestionsLoaded]);

  // Auto-populate selectedQuestions when availableQuestions loads
  React.useEffect(() => {
    if (availableQuestions.length === 0 || selectedQuestionIds.length === 0) return;
    const matched = availableQuestions.filter((q: any) => selectedQuestionIds.includes(q.id));
    if (matched.length > 0) {
      setSelectedQuestions((prev) => {
        const existingIds = prev.map((q) => q.id);
        const newOnes = matched.filter((q) => !existingIds.includes(q.id));
        const updated = [...prev, ...newOnes];
        setHasCodingQuestions(updated.some((q: any) => q.question_type?.toLowerCase() === "coding"));
        return updated;
      });
    }
  }, [availableQuestions]);

  // --- Step validity + persistence ---
  // Basic Details (step 0): name, role, experience.
  const validateBasic = (): string[] => {
    const errors: string[] = [];
    if (!formData.title.trim()) errors.push("Assessment name is required");
    // Job Description is the primary input that drives question generation.
    if (!formData.description.trim()) errors.push("Job Description is required");
    // if (!formData.techStack.length) errors.push("Select at least one technology");
    if (!formData.experienceLevel) errors.push("Experience level is required");
    return errors;
  };

  // Configuration (step 1): total questions + schedule (start/end, end>start, no past on create).
  const validateConfig = (): string[] => {
    const errors: string[] = [];
    if (!formData.numberOfAiQuestions || parseInt(formData.numberOfAiQuestions) <= 0) {
      errors.push("Total number of questions is required");
    }
    if (!formData.startDateTime) errors.push("Start date is required");
    if (!formData.endDateTime) errors.push("End date is required");

    const start = formData.startDateTime ? new Date(formData.startDateTime) : null;
    const end = formData.endDateTime ? new Date(formData.endDateTime) : null;
    if (start && end && end <= start) errors.push("End date must be after start date");
    if (!isEditMode) {
      const now = Date.now();
      if (start && start.getTime() < now) errors.push("Start date cannot be in the past");
      if (end && end.getTime() < now) errors.push("End date cannot be in the past");
    }
    return errors;
  };

  // Full validation (run before the single create/update at Review).
  const validateDetails = (): string[] => [...validateBasic(), ...validateConfig()];

  // Build the full create/update payload from the current Details state.
  const buildPayload = () => {
    const cleanHardcodedIds: string[] = selectedQuestionIds
      .map((id) => String(id).trim())
      .filter((s) => /^(?:core_|mock_)?\d+$/.test(s));

    return {
      title: formData.title,
      description: formData.description || "",
      tech_stack: formData.techStack,
      experience_level: mapExperienceToBackend(formData.experienceLevel),
      start_date: formatDateForAPI(formData.startDateTime),
      end_date: formatDateForAPI(formData.endDateTime),
      instructions: formData.instructions || "",
      num_questions: parseInt(formData.numberOfAiQuestions) || 0,
      num_hardcoded_questions: cleanHardcodedIds.length,
      hardcoded_question_ids: cleanHardcodedIds,
      num_coding_questions: hasCodingQuestions
        ? selectedQuestions.filter((q: any) => q.question_type?.toLowerCase() === "coding").length
        : parseInt(formData.numberOfCodingQuestions) || 0,
      coding_time_limit: parseInt(formData.codingTimeLimit) || 10,
      enable_voice_recording: enableVoiceRecording,
      enable_camera: enableCameraMonitoring,
      is_active: activeAssessment,
      passing_percentage:
        enableCertificate && formData.passingPercentage ? parseFloat(formData.passingPercentage) : 0,
      assessment_type: assessmentType,
      ...(isPremium
        ? {
          require_resume: requireResume,
          generate_questions_from_resume: generateFromResume,
          target_technologies: targetTechnologies,
          dynamic_followups: dynamicFollowups,
          max_followups: parseInt(maxFollowups) || 0,
          interviewer_persona: interviewerPersona,
          reference_document_type: referenceDocType,
          reference_document_name: referenceDocName,
          reference_document_data: referenceData,
        }
        : {}),
    };
  };

  // The ONE create/update call. Invoked only by the Review step's primary button
  // (Create Assessment / Update Assessment) — NOT by the step-1 Next.
  const submitAssessment = async (): Promise<boolean> => {
    const errors = validateDetails();
    if (errors.length) {
      toast({ title: "Invalid details", description: errors.join(". "), variant: "destructive", duration: 4000 });
      return false;
    }

    setIsSubmitting(true);
    try {
      const payload = buildPayload();

      if (assessmentId) {
        await updateAiAssessmentMut({ id: assessmentId, data: payload }).unwrap();
        toast({ title: "Saved", description: "AI assessment details saved.", variant: "success", duration: 3000 });
        return true;
      }

      const result = await createAiAssessmentMut(payload).unwrap();
      // BE wraps the created assessment under `data` ({ status, message, data: {...} }).
      const newId =
        result?.data?.id ??
        result?.assessment?.id ??
        result?.id ??
        result?.assessment_id;
      if (newId) {
        setCreatedId(Number(newId));
        toast({
          title: "AI Assessment Created",
          description: "Now assign candidates.",
          variant: "success",
          duration: 3000,
        });
        return true;
      }
      toast({
        title: "Creation Failed",
        description: "Assessment created but no id was returned. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
      return false;
    } catch (error: any) {
      let errorMessage = isEditMode
        ? "Failed to update AI assessment. Please try again."
        : "Failed to create AI assessment. Please try again.";
      const errData = error.data || error.response?.data;
      if (errData) {
        if (typeof errData === "object") {
          const errors = Object.entries(errData)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
            .join("; ");
          errorMessage = `Validation Error: ${errors}`;
        } else if (typeof errData === "string") {
          errorMessage = errData;
        }
      }
      toast({
        title: isEditMode ? "Update Failed" : "Creation Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  // The Basic & Configuration steps perform NO API write — they only validate
  // their own subset before advancing.
  const validateBasicStep = (): boolean => {
    const errors = validateBasic();
    if (errors.length) {
      toast({ title: "Invalid details", description: errors.join(". "), variant: "destructive", duration: 4000 });
      return false;
    }
    return true;
  };

  const validateConfigStep = (): boolean => {
    const errors = validateConfig();
    if (errors.length) {
      toast({ title: "Invalid details", description: errors.join(". "), variant: "destructive", duration: 4000 });
      return false;
    }
    return true;
  };

  // --- Wizard navigation ---
  // Keep Next clickable so the user gets a clear reason on click (validateDetails
  // toasts) instead of a silently-disabled button.
  const canProceed = true;

  // Review step's primary action. In create mode this fires the SINGLE create
  // call exactly once; if the assessment was already created (re-visiting Review
  // without an edit-mode id) it simply advances — no duplicate write. In edit
  // mode it runs the update each time. On success, advance to Candidates.
  const handleConfirmCreate = async () => {
    if (isConfigured && !isEditMode) {
      setCurrentStep(STEP_CANDIDATES);
      return;
    }
    const ok = await submitAssessment();
    if (ok) setCurrentStep(STEP_CANDIDATES);
  };

  const handleNext = async () => {
    // Step 0 (Basic Details): validate the basic subset — NO API write — advance.
    if (currentStep === STEP_BASIC) {
      if (validateBasicStep()) setCurrentStep(STEP_CONFIG);
      return;
    }
    // Step 1 (Configuration): validate the config subset — NO API write — advance.
    if (currentStep === STEP_CONFIG) {
      if (validateConfigStep()) setCurrentStep(STEP_REVIEW);
      return;
    }
    // Step 2 (Review): the SINGLE create/update call.
    if (currentStep === STEP_REVIEW) {
      await handleConfirmCreate();
      return;
    }
    // Remaining steps just advance.
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const handleBack = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleStepSelect = (index: number) => {
    // The Candidates step requires a live assessment id. Basic (0), Configuration
    // (1) and Review (2) are always reachable.
    if (!isConfigured && index >= STEP_CANDIDATES) return;
    setCurrentStep(index);
  };

  const handleFinish = () => navigate("/admin/assessments", { state: { AssessmentType: "ai" } });

  const handleCancel = () => {
    if (onBack) onBack();
    else navigate("/admin/assessments", { state: { AssessmentType: "ai" } });
  };

  const numQuestionsLabel = formData.numberOfAiQuestions
    ? `≈ ${parseInt(formData.numberOfAiQuestions) * 2} min`
    : "—";
  const passingLabel =
    enableCertificate && formData.passingPercentage ? `${formData.passingPercentage}%` : "—";

  // AI wizard summary omits Total Questions (AI generates them).
  const summary = {
    name: formData.title,
    totalCandidates: assignedCount,
    duration: numQuestionsLabel,
    passingScore: passingLabel,
  };

  return (
    <AdminLayout>
      <div className="w-full">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {isEditMode ? "Edit AI Assessment" : "Create AI Assessment"}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {isEditMode
                ? "Update this AI-powered interview assessment."
                : "Create an AI-conducted interview assessment for candidates."}
            </p>
          </div>
          <button
            title="Back to Assessments"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        {isLoadingData ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-brand-violet border-t-transparent" />
              <p className="text-sm text-slate-600">Loading assessment data...</p>
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
            {currentStep === STEP_BASIC && (
              <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Basic Details</h2>

                {/* Assessment Type — Regular vs Premium */}
                <div>
                  <label className={LABEL_CLASS}>Assessment Type</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(
                      [
                        { value: "regular" as const, icon: Brain, title: "Regular", desc: "Hardcoded questions with a fixed interview flow.", comingSoon: false },
                        { value: "premium" as const, icon: Crown, title: "Premium", desc: "Resume-based, dynamic AI conversation with video + voice.", comingSoon: true },
                      ]
                    ).map((opt) => {
                      const selected = assessmentType === opt.value;
                      const Icon = opt.icon;
                      const locked = opt.comingSoon;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => !locked && setAssessmentType(opt.value)}
                          disabled={isSubmitting || locked}
                          title={locked ? "Coming soon" : undefined}
                          aria-disabled={locked}
                          className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all disabled:cursor-not-allowed ${locked
                              ? "border-slate-200 bg-slate-50 opacity-70"
                              : selected
                                ? "border-brand-violet bg-brand-violet/5 ring-1 ring-brand-violet/30"
                                : "border-slate-200 bg-white hover:border-brand-violet/40 hover:bg-violet-50/40"
                            }`}
                        >
                          <span
                            className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${selected && !locked ? "bg-brand-violet text-white" : "bg-slate-100 text-slate-500"
                              }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5">
                              <span className={`text-sm font-semibold ${selected && !locked ? "text-brand-violet" : "text-slate-800"}`}>
                                {opt.title}
                              </span>
                              {locked && (
                                <span className="rounded-full border border-dashed border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                                  Coming soon
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-slate-500">{opt.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className={LABEL_CLASS}>
                    Assessment Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter AI assessment title"
                    required
                    disabled={isSubmitting}
                    className={INPUT_CLASS}
                  />
                </div>

                {/* Job Description — the PRIMARY input that drives generation. */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="block text-sm font-semibold text-slate-700">
                      Job Description <span className="text-red-500">*</span>
                    </label>
                    <span className="rounded-full border border-brand-violet/30 bg-brand-violet/[0.06] px-2 py-0.5 text-[10px] font-semibold text-brand-violet">
                      Primary input
                    </span>
                  </div>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Paste the job description / role context — this is the main source the AI uses to generate questions"
                    rows={4}
                    required
                    disabled={isSubmitting}
                    className={`${TEXTAREA_CLASS} resize-y`}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    The AI grounds questions in this first, then layers on the tech stack and experience level.
                  </p>
                </div>

                {/* Tech Stack and Experience Level (supporting inputs for generation) */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <SearchableSelect
                      options={TECH_OPTIONS}
                      selected={formData.techStack}
                      onSelect={handleAddSkill}
                      onRemove={handleRemoveSkill}
                      placeholder="Search and add a technology"
                      label="Tech Stack *"
                      icon={<Code className="h-3.5 w-3.5" />}
                      variant="blue"
                    />
                    <p className="mt-1 text-xs text-slate-500">Pick the technologies/skills this interview should cover (required, up to 10).</p>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>
                      Experience Level <span className="text-red-500">*</span>
                    </label>
                    <Dropdown
                      value={formData.experienceLevel}
                      onChange={(v) => handleInputChange("experienceLevel", v)}
                      options={EXPERIENCE_LEVEL_OPTIONS}
                      icon={GraduationCap}
                      placeholder="Select experience level"
                      align="right"
                      disabled={isSubmitting}
                    />
                    <p className="mt-1 text-xs text-slate-500">Expected candidate experience level</p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {currentStep === STEP_CONFIG && (
              <div className="space-y-5 rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">Configuration</h2>

                {/* Premium Interview Settings */}
                {isPremium && (
                  <div className="space-y-3 rounded-xl border border-brand-violet/30 bg-brand-violet/[0.03] p-4">
                    <div className="flex items-center gap-1.5">
                      <Crown className="h-4 w-4 text-brand-violet" />
                      <h3 className="text-sm font-semibold text-brand-violet">Premium Interview Settings</h3>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={requireResume}
                          onChange={(e) => {
                            setRequireResume(e.target.checked);
                            if (!e.target.checked) setGenerateFromResume(false);
                          }}
                          disabled={isSubmitting}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                        />
                        <span>
                          <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                            <FileText className="h-3 w-3" /> Require resume upload
                          </span>
                          <span className="block text-xs text-slate-500">Candidate uploads their latest resume before the interview starts.</span>
                        </span>
                      </label>

                      <label className={`ml-6 flex items-start gap-2 ${!requireResume ? "opacity-50" : ""}`}>
                        <input
                          type="checkbox"
                          checked={generateFromResume}
                          onChange={(e) => setGenerateFromResume(e.target.checked)}
                          disabled={isSubmitting || !requireResume}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                        />
                        <span>
                          <span className="text-xs font-medium text-slate-700">Generate questions from resume</span>
                          <span className="block text-xs text-slate-500">AI builds case-based &amp; technical questions from the resume and selected technologies.</span>
                        </span>
                      </label>
                    </div>

                    {/* Reference document */}
                    <div>
                      <label className={LABEL_CLASS}>
                        Reference Document <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <div className="mb-2 inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                        {(
                          [
                            { value: "jd" as const, label: "Job Description" },
                            { value: "resume_sample" as const, label: "Sample Resume" },
                          ]
                        ).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setReferenceDocType(opt.value)}
                            disabled={isSubmitting}
                            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${referenceDocType === opt.value ? "bg-brand-violet text-white" : "text-slate-600 hover:text-brand-violet"
                              }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <input
                        ref={referenceInputRef}
                        type="file"
                        accept={REFERENCE_DOC_ACCEPT}
                        className="hidden"
                        onChange={(e) => handleReferenceFile(e.target.files?.[0])}
                      />

                      {!referenceDocName ? (
                        <button
                          type="button"
                          onClick={() => referenceInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand-violet/40 bg-brand-violet/5 px-3 py-3 text-sm font-medium text-brand-violet transition-colors hover:bg-brand-violet/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FileText className="h-4 w-4" />
                          Upload {referenceDocType === "jd" ? "job description" : "sample resume"} (PDF, DOC, DOCX, TXT · max 5MB)
                        </button>
                      ) : (
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                          <span className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 flex-shrink-0 text-brand-violet" />
                            <span className="truncate text-sm text-slate-700">{referenceDocName}</span>
                            {referenceParsing ? (
                              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-slate-400">
                                <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-violet border-t-transparent" />
                                Reading…
                              </span>
                            ) : referenceData ? (
                              <span className="flex flex-shrink-0 items-center gap-0.5 text-xs text-green-600">
                                <CheckCircle className="h-3 w-3" /> Parsed
                              </span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={clearReferenceDoc}
                            disabled={isSubmitting}
                            className="flex-shrink-0 rounded-full p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400 disabled:cursor-not-allowed"
                            aria-label="Remove document"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {referenceError && <p className="mt-1 text-xs text-red-500">{referenceError}</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        AI generates interview questions, case studies &amp; follow-ups from this document.
                      </p>
                    </div>

                    {/* Target technologies */}
                    <div>
                      <label className={LABEL_CLASS}>Target Technologies</label>
                      {!formData.interviewRole ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-400">
                          Select an Interview Role first to see relevant technologies.
                        </div>
                      ) : (
                        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
                          {displayTechnologies.length === 0 ? (
                            <span className="px-1 py-0.5 text-xs text-slate-400">No technologies match this role.</span>
                          ) : (
                            displayTechnologies.map((tech) => {
                              const active = targetTechnologies.includes(tech);
                              return (
                                <button
                                  key={tech}
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    setTargetTechnologies((prev) =>
                                      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
                                    )
                                  }
                                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed ${active ? "bg-brand-violet text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-violet/10 hover:text-brand-violet"
                                    }`}
                                >
                                  {tech}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                      <p className="mt-1 text-xs text-slate-500">Focus AI-generated questions on these skills (optional).</p>
                    </div>

                    {/* Dynamic follow-ups + persona */}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={dynamicFollowups}
                            onChange={(e) => setDynamicFollowups(e.target.checked)}
                            disabled={isSubmitting}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-violet disabled:cursor-not-allowed"
                          />
                          <span>
                            <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                              <MessageSquare className="h-3 w-3" /> Dynamic follow-up questions
                            </span>
                            <span className="block text-xs text-slate-500">AI asks adaptive follow-ups based on each answer.</span>
                          </span>
                        </label>
                        {dynamicFollowups && (
                          <div className="ml-6 mt-2">
                            <label className="mb-1 block text-xs font-medium text-slate-600">Max follow-ups per answer</label>
                            <input
                              type="number"
                              value={maxFollowups}
                              onChange={(e) => setMaxFollowups(e.target.value)}
                              min="0"
                              max="5"
                              disabled={isSubmitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className={LABEL_CLASS}>AI Interviewer Persona</label>
                        <Dropdown
                          value={interviewerPersona}
                          onChange={(v) => setInterviewerPersona(String(v))}
                          options={INTERVIEWER_PERSONA_OPTIONS}
                          icon={Sparkles}
                          placeholder="Select persona"
                          align="right"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-2 text-xs text-brand-purple">
                      <Video className="h-3.5 w-3.5 flex-shrink-0" />
                      Premium runs a video + voice interview — voice recording and camera monitoring are always enabled.
                    </div>
                  </div>
                )}

                {/* Questions */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Questions</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Total Number of Questions */}
                    <div>
                      <label className={LABEL_CLASS}>
                        Total Number of Questions <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.numberOfAiQuestions}
                        onChange={(e) => handleInputChange("numberOfAiQuestions", e.target.value)}
                        placeholder="5"
                        required
                        min="1"
                        max="20"
                        disabled={isSubmitting}
                        className={INPUT_CLASS}
                      />
                      <p className="mt-1 text-xs text-slate-500">Remaining after hardcoded are AI-generated.</p>
                    </div>

                    {/* Hardcoded Questions */}
                    <div>
                      <label className={LABEL_CLASS}>
                        Hardcoded Questions <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <button
                        type="button"
                        disabled={formData.techStack.length === 0 || !formData.experienceLevel || isSubmitting}
                        onClick={openQuestionsModal}
                        className="flex w-full items-center justify-between rounded-xl border border-dashed border-brand-violet/40 bg-brand-violet/5 px-3 py-2.5 text-sm font-medium text-brand-violet transition-colors hover:bg-brand-violet/10 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <span>
                          {formData.techStack.length === 0 || !formData.experienceLevel
                            ? "Select Tech Stack & Experience first"
                            : selectedQuestionIds.length > 0
                              ? `${selectedQuestionIds.length} question${selectedQuestionIds.length > 1 ? "s" : ""} selected`
                              : "Click to select questions"}
                        </span>
                        <span className="text-brand-violet/60">↗</span>
                      </button>
                      <p className="mt-1 text-xs text-slate-500">Pick specific questions; the rest are AI-generated.</p>
                    </div>
                  </div>

                  {/* Coding settings — only when coding questions are picked */}
                  {hasCodingQuestions && (
                    <div className="mt-3 grid grid-cols-1 items-center gap-3 sm:grid-cols-2">
                      <div className="flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                        <span className="font-semibold">
                          {selectedQuestions.filter((q: any) => q.question_type?.toLowerCase() === "coding").length} coding
                          question
                          {selectedQuestions.filter((q: any) => q.question_type?.toLowerCase() === "coding").length > 1 ? "s" : ""}
                        </span>
                        &nbsp;detected
                      </div>
                      <div>
                        <label className={LABEL_CLASS}>Time per Coding Question (min)</label>
                        <input
                          type="number"
                          value={formData.codingTimeLimit}
                          onChange={(e) => handleInputChange("codingTimeLimit", e.target.value)}
                          placeholder="10"
                          min="1"
                          max="60"
                          disabled={isSubmitting}
                          className={INPUT_CLASS}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div className="border-t border-slate-100 pt-5">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Schedule</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>
                        Available From <span className="text-red-500">*</span>
                      </label>
                      <DateTimePicker
                        value={formData.startDateTime}
                        onChange={(v) => handleInputChange("startDateTime", v)}
                        placeholder="Select start date & time"
                        disabled={isSubmitting}
                      />
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>
                        Available Until <span className="text-red-500">*</span>
                      </label>
                      <DateTimePicker
                        value={formData.endDateTime}
                        onChange={(v) => handleInputChange("endDateTime", v)}
                        placeholder="Select end date & time"
                        align="right"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Certificate */}
                <div className="border-t border-slate-100 pt-5">
                  <label className="flex items-center gap-2">
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
                    <span>
                      <span className="block text-sm font-medium text-slate-700">Enable Certificate</span>
                      <span className="block text-xs text-slate-500">Issue a downloadable certificate to candidates who pass.</span>
                    </span>
                  </label>
                  {enableCertificate && (
                    <div className="ml-6 mt-3 max-w-xs">
                      <label className={LABEL_CLASS}>
                        Passing Score (%) <span className="text-red-500">*</span>
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
                      <p className="mt-1 text-xs text-slate-500">Candidates scoring at or above this % earn a certificate.</p>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="border-t border-slate-100 pt-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-700">Candidate Instructions</label>
                    {formData.instructions !== DEFAULT_AI_INSTRUCTIONS && (
                      <button
                        type="button"
                        onClick={() => handleInputChange("instructions", DEFAULT_AI_INSTRUCTIONS)}
                        disabled={isSubmitting}
                        className="text-xs font-medium text-brand-violet transition-colors hover:text-brand-purple disabled:opacity-50"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <textarea
                    value={formData.instructions}
                    onChange={(e) => handleInputChange("instructions", e.target.value)}
                    placeholder="Default instructions are pre-filled. Edit or add your own."
                    rows={3}
                    disabled={isSubmitting}
                    className={`${TEXTAREA_CLASS} resize-y text-xs leading-relaxed`}
                  />
                  <p className="mt-1 text-xs text-slate-400">Shown to candidates before they start the interview.</p>
                </div>

                {/* Voice Recording / Camera Monitoring / Active Assessment toggles
                    hidden for now — sent with their default values in the payload. */}

                {/* Deferred — Save as Draft (coming soon) */}
                <div className="pt-1">
                  <button
                    type="button"
                    disabled
                    title="Coming soon"
                    className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
                  >
                    Save as Draft (coming soon)
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Confirmation — the SINGLE create/update happens here */}
            {currentStep === STEP_REVIEW && (
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-slate-800">Review &amp; Confirmation</h2>
                <p className="text-xs text-slate-500">
                  {isEditMode
                    ? "Review the details below, then update the assessment."
                    : isConfigured
                      ? "This assessment has been created. Continue to assign candidates."
                      : "Review the details below. Click Create Assessment to create it — then you'll assign candidates."}
                </p>
                {/* Job Description — primary input, shown first and full-width. */}
                <div className="rounded-xl border border-brand-violet/20 bg-brand-violet/[0.03] p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-600">Job Description</p>
                    <span className="rounded-full border border-brand-violet/30 bg-brand-violet/[0.06] px-2 py-0.5 text-[10px] font-semibold text-brand-violet">
                      Primary input
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{formData.description || "—"}</p>
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <ReviewRow label="Assessment Name" value={formData.title || "—"} />
                  <ReviewRow label="Type" value={isPremium ? "Premium" : "Regular"} />
                  <ReviewRow label="Tech Stack" value={formData.techStack.join(", ") || "—"} />
                  <ReviewRow label="Experience Level" value={formData.experienceLevel || "—"} />
                  <ReviewRow label="Total Questions" value={formData.numberOfAiQuestions || "—"} />
                  <ReviewRow label="Passing Score" value={passingLabel} />
                  <ReviewRow label="Available From" value={formData.startDateTime || "—"} />
                  <ReviewRow label="Available Until" value={formData.endDateTime || "—"} />
                  <ReviewRow
                    label="Hardcoded Questions"
                    value={selectedQuestionIds.length ? String(selectedQuestionIds.length) : "—"}
                  />
                </dl>

                <div className="border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={handleConfirmCreate}
                    disabled={isSubmitting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting
                      ? isEditMode
                        ? "Updating…"
                        : "Creating…"
                      : isConfigured && !isEditMode
                        ? "Continue to Candidates"
                        : isEditMode
                          ? "Update Assessment"
                          : "Create Assessment"}
                  </button>
                  {isConfigured && !isEditMode && (
                    <p className="mt-2 text-xs text-green-600">
                      Assessment created. Click to continue to candidate assignment.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Candidates */}
            {currentStep === STEP_CANDIDATES && (
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
            )}
          </AssessmentWizardShell>
        )}
      </div>

      {/* Hardcoded Questions Selection Modal */}
      {showQuestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="mx-auto flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Select Hardcoded Questions</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {questionsLoading ? "Loading..." : `${selectedQuestionIds.length} selected · ${totalQuestionsCount} questions available`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionsModal(false)}
                className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-gray-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search + Category Filter */}
            <div className="flex gap-3 border-b border-gray-100 px-5 py-3">
              <input
                type="text"
                placeholder="Search questions by title..."
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                autoFocus
              />

              <div ref={dropdownRef} className="relative min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowStackDropdown((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm hover:border-brand-violet/40 focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
                >
                  <span className="truncate">
                    {categoryFilter ? availableStacks.find((s) => s.toLowerCase() === categoryFilter) || categoryFilter : "All Categories"}
                  </span>
                  <span className="ml-2 text-gray-400">▾</span>
                </button>

                {showStackDropdown && (
                  <div className="absolute right-0 top-full z-50 mt-1 max-h-[220px] w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="border-b p-2">
                      <input
                        type="text"
                        placeholder="Search category..."
                        value={stackSearch}
                        onChange={(e) => setStackSearch(e.target.value)}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-violet/40"
                      />
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {[
                        { label: "All Categories", value: "" },
                        { label: "Coding", value: "coding" },
                        ...[...availableStacks]
                          .sort((a, b) => a.localeCompare(b))
                          .filter((s) => s.toLowerCase().includes(stackSearch.toLowerCase()))
                          .map((s) => ({ label: s, value: s.toLowerCase() })),
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => {
                            setCategoryFilter(item.value);
                            setShowStackDropdown(false);
                            setStackSearch("");
                            setQuestionsPage(1);
                            setHasMoreQuestions(true);
                            setAvailableQuestions([]);
                            setTotalQuestionsCount(0);
                            setQuestionsLoading(true);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-brand-violet/5 hover:text-brand-violet ${categoryFilter === item.value ? "bg-brand-violet/5 font-medium text-brand-violet" : "text-slate-700"
                            }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Body: Question List + Selected Panel */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <div className="min-w-0 flex-1 divide-y divide-gray-100 overflow-y-auto border-r border-gray-200" onScroll={handleQuestionListScroll}>
                {questionsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-violet border-t-transparent" />
                    Loading questions...
                  </div>
                ) : filteredQuestions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                      <Brain className="h-7 w-7 text-slate-400" />
                    </div>
                    <p className="mb-1 text-sm font-semibold text-slate-600">No questions found</p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {categoryFilter
                        ? `No questions available in "${categoryFilter}" category.`
                        : questionSearch
                          ? `No questions match "${questionSearch}".`
                          : "No questions available for the selected role and experience."}
                    </p>
                    {(categoryFilter || questionSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter("");
                          setQuestionSearch("");
                          setDebouncedSearch("");
                        }}
                        className="mt-3 text-xs font-medium text-brand-violet underline hover:text-brand-purple"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
                      <input
                        type="checkbox"
                        id="select-all"
                        checked={filteredQuestions.length > 0 && filteredQuestions.every((q: any) => selectedQuestionIds.includes(q.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            const allIds = filteredQuestions.map((q: any) => q.id);
                            setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...allIds])));
                            setSelectedQuestions((prev) => {
                              const existingIds = prev.map((q) => q.id);
                              const newOnes = filteredQuestions.filter((q: any) => !existingIds.includes(q.id));
                              return [...prev, ...newOnes];
                            });
                          } else {
                            const filteredIds = filteredQuestions.map((q: any) => q.id);
                            setSelectedQuestionIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
                            setSelectedQuestions((prev) => prev.filter((q) => !filteredIds.includes(q.id)));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 accent-brand-violet"
                      />
                      <label htmlFor="select-all" className="cursor-pointer select-none text-xs font-medium text-slate-600">
                        Select all ({filteredQuestions.length}) of {totalQuestionsCount}
                      </label>
                    </div>

                    {filteredQuestions.map((q: any) => {
                      const isSelected = selectedQuestionIds.includes(q.id);
                      const difficultyColor =
                        q.difficulty?.toLowerCase() === "easy"
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : q.difficulty?.toLowerCase() === "hard"
                            ? "bg-red-100 text-red-700 border border-red-200"
                            : "bg-yellow-100 text-yellow-700 border border-yellow-200";

                      return (
                        <label
                          key={q.id}
                          className={`flex cursor-pointer items-start gap-3 px-5 py-4 transition-all ${isSelected ? "border-l-4 border-l-brand-violet bg-brand-violet/5" : "border-l-4 border-l-transparent hover:bg-gray-50"
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedQuestionIds((prev) =>
                                prev.includes(q.id) ? prev.filter((id) => id !== q.id) : [...prev, q.id]
                              );
                              setSelectedQuestions((prev) => {
                                const updated = prev.some((item) => item.id === q.id)
                                  ? prev.filter((item) => item.id !== q.id)
                                  : [...prev, q];
                                setHasCodingQuestions(updated.some((item: any) => item.question_type?.toLowerCase() === "coding"));
                                return updated;
                              });
                            }}
                            className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300 accent-brand-violet"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold leading-snug ${isSelected ? "text-brand-violet" : "text-slate-800"}`}>
                              {q.title}
                            </p>
                            {q.description && (
                              <div
                                className="mt-1 line-clamp-2 overflow-hidden text-xs leading-relaxed text-slate-500 [&_*]:text-slate-500 [&_strong]:font-semibold [&_strong]:text-slate-600"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(stripInlineStyles(q.description)) }}
                              />
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full border border-brand-violet/20 bg-brand-violet/10 px-2 py-0.5 text-[11px] font-medium text-brand-violet">
                                {q.question_type || "Coding"}
                              </span>
                              {q.difficulty && (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${difficultyColor}`}>{q.difficulty}</span>
                              )}
                              {q.category_name && (
                                <span className="rounded-full border border-purple-100 bg-purple-50 px-2 py-0.5 text-[11px] text-purple-600">
                                  {q.category_name}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-violet" />}
                        </label>
                      );
                    })}
                    {(loadMoreLoading || hasMoreQuestions) && !questionsLoading && (
                      <div className="flex items-center justify-center py-4 text-sm text-slate-500">
                        {loadMoreLoading ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-brand-violet border-t-transparent" />
                            Loading more questions...
                          </>
                        ) : (
                          "Scroll to load more questions"
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right panel — selected questions */}
              {selectedQuestionIds.length > 0 && (
                <div className="flex w-[320px] flex-shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-slate-50">
                  <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      Selected
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-violet text-[10px] font-bold text-white">
                        {selectedQuestionIds.length}
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedQuestionIds([]);
                        setSelectedQuestions([]);
                        setHasCodingQuestions(false);
                      }}
                      className="text-xs text-red-400 underline hover:text-red-600"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto p-3">
                    {selectedQuestions.map((q) => {
                      if (!q || !q.id) return null;
                      const difficultyColor =
                        q.difficulty?.toLowerCase() === "easy"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : q.difficulty?.toLowerCase() === "hard"
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-yellow-100 text-yellow-700 border-yellow-200";

                      return (
                        <div
                          key={q.id}
                          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm transition-colors hover:border-brand-violet/40"
                        >
                          <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-violet" />
                          <div className="min-w-0 flex-1">
                            <p className="whitespace-normal break-words text-sm font-semibold leading-snug text-slate-800">{q.title}</p>
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {q.difficulty && (
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${difficultyColor}`}>{q.difficulty}</span>
                              )}
                              {q.category_name && (
                                <span className="rounded-full border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[10px] text-purple-600">
                                  {q.category_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuestionIds((prev) => prev.filter((i) => i !== q.id));
                              setSelectedQuestions((prev) => {
                                const updated = prev.filter((item) => item.id !== q.id);
                                setHasCodingQuestions(updated.some((item: any) => item.question_type?.toLowerCase() === "coding"));
                                return updated;
                              });
                            }}
                            className="flex-shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-shrink-0 items-center justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-white px-5 py-3">
              <button
                type="button"
                onClick={() => setShowQuestionsModal(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowQuestionsModal(false)}
                className="rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
              >
                Done ({selectedQuestionIds.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

const ReviewRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
  </div>
);
