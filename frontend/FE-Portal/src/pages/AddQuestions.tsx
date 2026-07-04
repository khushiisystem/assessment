import { sanitizeHtml } from "@/lib/sanitize";
import React, { useState, useEffect, lazy, Suspense } from "react";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocation, useNavigate, useParams } from "react-router-dom";
// Lazy so Monaco (~1MB) loads only when the code/SQL editor is rendered.
const CodeEditor = lazy(() => import("@/pages/userpages/CodeEditor"));
import AdminLayout from "@/components/AdminLayout";
import {
  ArrowLeft,
  Plus,
  Trash2,
  PlusCircle,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Database,
  Save,
  Loader2,
  Sparkles,
  Check,
  CheckCircle,
  XCircle,
  X,
  Edit,
  Table,
  FileCode,
  Settings,
  ChevronRight,
  Eye
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import {
  useLazyGetQuestionByIdQuery,
  useGetSqlDatasetsQuery,
  useCreateSqlDatasetMutation,
  useUpdateQuestionMutation,
  useAddQuestionMutation,
  useGetCategoriesQuery,
  useLazyGetAiMockQuestionByIdQuery,
  useUpdateAiMockQuestionMutation,
  useRunCodeMutation,
  useRunSqlMutation,
  useAddAiMockQuestionMutation,
  useGetStacksQuery,
} from "@/store";

interface Category {
  id: number;
  name: string;
  description: string;
}

interface Dataset {
  id: number;
  name: string;
  engine: string;
  schema_ddl: string;
  seed_sql: string;
  reference_solution?: string;
}

interface TestCase {
  input_data: string;
  expected_output: string;
  points: string;
  is_hidden: boolean;
}

interface SQLTestCase {
  id?: number;
  setup_sql: string;
  points: string;
  is_hidden: boolean;
}

interface FormData {
  title: string;
  question_type: string;
  category: string;
  difficulty: string;
  marks?: string;
  description?: string;
  option1?: string;
  option2?: string;
  option3?: string;
  option4?: string;
  option5?: string;
  correct_answer?: string;
  tags?: string;
  sample_input?: string;
  sample_output?: string;
  dataset_id?: string;
  testcases?: TestCase[];
  sql_testcases?: SQLTestCase[];
  reference_solution?: string;
  strict_column_order?: boolean;
  float_tolerance?: string;
  max_rows?: string;
}

interface DatasetFormData {
  name: string;
  engine: string;
  schema_ddl: string;
  seed_sql: string;
  reference_solution: string;
}

export const AddQuestions = () => {
  const [formData, setFormData] = useState<FormData>({
    title: "",
    question_type: "",
    category: "",
    difficulty: "",
    marks: "1",
    description: "",
    option1: "",
    option2: "",
    option3: "",
    option4: "",
    option5: "",
    correct_answer: "",
    tags: "",
    sample_input: "",
    sample_output: "",
    dataset_id: "",
    testcases: [],
    sql_testcases: [],
    reference_solution: "",
    strict_column_order: true,
    float_tolerance: "0",
    max_rows: "5000"
  });

  const [datasetForm, setDatasetForm] = useState<DatasetFormData>({
    name: "",
    engine: "sqlite",
    schema_ddl: "",
    seed_sql: "",
    reference_solution: ""
  });
  // Add these three lines here
  // Add these three lines here
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [addAiMockQuestion] = useAddAiMockQuestionMutation();
  const { data: stacksData } = useGetStacksQuery();
  const availableStacks = stacksData || [];
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);
  const [questionId, setQuestionId] = useState<number | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [showDatasetForm, setShowDatasetForm] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isMockQuestion = typeof id === "string" && id.startsWith("mock_");
  const numericId = id
    ? Number(id.includes("_") ? id.split("_")[1] : id)
    : null;

  const isAiMock = location.state?.source === "ai_mock";

  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin" || user?.role === "org_admin";

  // Debug: Log auth status
  useEffect(() => {
    console.log("🔐 Auth Status:", { user, userRole: user?.role, isAdmin });
    // Make debug function available globally
    (window as any).__DEBUG_AUTH__ = () => {
      const storedUser = sessionStorage.getItem('user');
      const user = storedUser ? JSON.parse(storedUser) : null;
      return {
        user,
        role: user?.role,
        permissions: user?.permissions,
        isSuperAdmin: user?.role === "super_admin",
        isAdmin: user?.role === "admin" || user?.role === "super_admin"
      };
    };
  }, [user, isAdmin]);

  // RTK Query hooks
  const [getQuestionById] = useLazyGetQuestionByIdQuery();
  const [getAiMockQuestionById] = useLazyGetAiMockQuestionByIdQuery();
  const { data: categoriesData } = useGetCategoriesQuery();
  const { data: datasetsData, refetch: refetchDatasets } = useGetSqlDatasetsQuery();
  const [createSqlDatasetMut] = useCreateSqlDatasetMutation();
  const [updateQuestionMut] = useUpdateQuestionMutation();
  const [updateAiMockQuestionMut] = useUpdateAiMockQuestionMutation();
  const [addQuestionMut] = useAddQuestionMutation();

  // Derive categories and datasets from RTK Query
  const categories: Category[] = categoriesData || [];
  const datasets: Dataset[] = Array.isArray(datasetsData)
    ? datasetsData
    : datasetsData?.results || datasetsData || [];

  const questionTypeFromNavigation = location.state?.questionType || "";
  const questionToEdit = location.state?.question;
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLanguage, setPreviewLanguage] = useState('python');
  const [previewCodeResult, setPreviewCodeResult] = useState<any>(null);
  const [previewIsRunning, setPreviewIsRunning] = useState(false);
  const [previewEditorTheme, setPreviewEditorTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [previewEditorFullscreen, setPreviewEditorFullscreen] = useState(false);

  // SQL Preview states
  const [previewSqlQuery, setPreviewSqlQuery] = useState('');
  const [previewSqlResult, setPreviewSqlResult] = useState<any>(null);
  const [previewSqlIsRunning, setPreviewSqlIsRunning] = useState(false);
  const [runSqlMutation] = useRunSqlMutation();
  const [runCode] = useRunCodeMutation();
  const [marksError, setMarksError] = useState("");
  const noop = () => undefined;

  const handlePreviewSqlRun = async () => {
    if (!isAdmin) {
      toast({
        title: "Permission Denied",
        description: "Only administrators can run SQL queries.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    if (!previewSqlQuery.trim()) {
      toast({
        title: "Empty Query",
        description: "Please write a SQL query to run",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setPreviewSqlIsRunning(true);
    setPreviewSqlResult(null);

    try {
      const payload: any = { query: previewSqlQuery };
      if (questionId) {
        payload.question_id = questionId;
      }
      const resp = await runSqlMutation(payload).unwrap();
      setPreviewSqlResult(resp);
      toast({
        title: "Query Executed",
        description: "SQL query ran successfully",
        duration: 2000,
      });
    } catch (error: any) {
      const errorMessage =
        error?.data?.error ||
        error?.data?.stderr ||
        error?.data?.detail ||
        error?.data?.message ||
        error?.message ||
        "Failed to execute SQL query";
      setPreviewSqlResult({ error: errorMessage, raw: error });
      toast({
        title: "SQL Execution Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 4000,
      });
    } finally {
      setPreviewSqlIsRunning(false);
    }
  };

  const handlePreviewCodeRun = async (languageOverride?: string) => {
    const runQuestionId = questionId ?? numericId;
    if (!previewCode.trim() || !runQuestionId) return;

    setPreviewIsRunning(true);
    setPreviewCodeResult(null);
    try {
      const resp = await runCode({
        question_id: runQuestionId,
        code: previewCode,
        language: languageOverride || previewLanguage,
      }).unwrap();
      setPreviewCodeResult(resp);
    } catch (err) {
      setPreviewCodeResult({ error: "Failed to run code" });
    } finally {
      setPreviewIsRunning(false);
    }
  };
  // Fetch question data if editing via URL
  useEffect(() => {
    const fetchQuestionData = async () => {
      if (id) {
        setIsFetchingData(true);
        try {
          console.log("Fetching Question ID:", id, "Numeric:", numericId, "isMock:", isMockQuestion);
          if (isMockQuestion) {
            // Mock interview question — fetch from dedicated endpoint
            const question = await getAiMockQuestionById(numericId).unwrap();
            console.log("Mock Question API Response:", question);
            setQuestionId(numericId);
            setFormData({
              title: question.title || "",
              question_type: "subjective",
              category: "",
              difficulty: question.difficulty || "",
              marks: question.marks?.toString() || "1",
              description: question.description || "",
              option1: "",
              option2: "",
              option3: "",
              option4: "",
              option5: "",
              correct_answer: "",
              tags: question.stack || "",
              sample_input: "",
              sample_output: "",
              dataset_id: "",
              testcases: [],
              sql_testcases: [],
              reference_solution: "",
              strict_column_order: true,
              float_tolerance: "0",
              max_rows: "5000"
            });
          } else {
            // Regular core question
            const question = await getQuestionById(numericId).unwrap();
            console.log("Core Question API Response:", question);
            setQuestionId(numericId);
            setFormData({
              title: question.title || question.text || "",
              question_type: question.question_type || "",
              category: question.category?.toString() || "",
              difficulty: question.difficulty || "",
              marks: question.marks?.toString() || "1",
              description: question.description || question.text ||"",
              option1: question.option1 || "",
              option2: question.option2 || "",
              option3: question.option3 || "",
              option4: question.option4 || "",
              option5: question.option5 || "",
              correct_answer: question.correct_answer || "",
              tags: question.tags || "",
              sample_input: question.sample_input || "",
              sample_output: question.sample_output || "",
              dataset_id: question?.sql_details?.dataset?.toString() || "",
              testcases: (question.testcases || []).map((tc: any) => ({
                input_data: tc.input_data || "",
                expected_output: tc.expected_output || "",
                points: tc.points?.toString() || "1",
                is_hidden: tc.is_hidden || false
              })),
              sql_testcases: (question.sql_testcases || []).map((tc: any) => ({
                id: tc.id,
                setup_sql: tc.setup_sql || "",
                points: tc.points?.toString() || "1",
                is_hidden: tc.is_hidden || false
              })),
              reference_solution: question?.sql_details?.reference_solution || question?.reference_solution || "",
              strict_column_order: question?.sql_details?.strict_column_order !== false,
              float_tolerance: question?.sql_details?.float_tolerance?.toString() || "0",
              max_rows: question?.sql_details?.max_rows?.toString() || "5000"
            });
          }

          setIsDataLoaded(true);

        } catch (error) {
          console.error("Error fetching question ERROR_TRACE:", error);
          toast({
            title: "Error",
            description: "Failed to load question data",
            variant: "destructive",
          });
        } finally {
          setIsFetchingData(false);
        }
      }
    };

    fetchQuestionData();
  }, [id, toast]);

  // Initialize form with navigation data
  useEffect(() => {
    if (questionTypeFromNavigation) {
      setFormData(prev => ({
        ...prev,
        question_type: mapQuestionTypeToApi(questionTypeFromNavigation)
      }));
    }
    if (questionToEdit && !id) {
      const resolvedId = questionToEdit.id || questionToEdit.question_id;

      setQuestionId(resolvedId);
      const mappedFormData: FormData = {
        title: questionToEdit.title || "",
        question_type: questionToEdit.question_type || "",
        category: questionToEdit.category?.toString() || "",
        difficulty: questionToEdit.difficulty || "",
        marks: questionToEdit.marks?.toString() || "1",
        description: questionToEdit.description || "",
        option1: questionToEdit.option1 || "",
        option2: questionToEdit.option2 || "",
        option3: questionToEdit.option3 || "",
        option4: questionToEdit.option4 || "",
        option5: questionToEdit.option5 || "",
        correct_answer: questionToEdit.correct_answer || "",
        tags: questionToEdit.tags || "",
        sample_input: questionToEdit.sample_input || "",
        sample_output: questionToEdit.sample_output || "",
        dataset_id: questionToEdit.dataset_id?.toString() || "",
        reference_solution: questionToEdit.reference_solution || "",
        strict_column_order: questionToEdit.strict_column_order !== false,
        float_tolerance: questionToEdit.float_tolerance?.toString() || "0",
        max_rows: questionToEdit.max_rows?.toString() || "5000"
      };

      // Handle testcases
      if (questionToEdit.testcases && Array.isArray(questionToEdit.testcases)) {
        mappedFormData.testcases = questionToEdit.testcases.map((tc: any) => ({
          input_data: tc.input_data || "",
          expected_output: tc.expected_output || "",
          points: tc.points?.toString() || "1",
          is_hidden: tc.is_hidden || false
        }));
      } else {
        mappedFormData.testcases = [];
      }

      // Handle SQL testcases
      if (questionToEdit.sql_testcases && Array.isArray(questionToEdit.sql_testcases)) {
        mappedFormData.sql_testcases = questionToEdit.sql_testcases.map((tc: any) => ({
            id: tc.id,
            setup_sql: tc.setup_sql || "",
            points: tc.points?.toString() || "1",
          is_hidden: tc.is_hidden || false
        }));
      } else {
        mappedFormData.sql_testcases = [];
      }

      setFormData(mappedFormData);
    }
  }, [questionTypeFromNavigation, questionToEdit, id]);

  // Categories and datasets are auto-fetched by RTK Query hooks above.
  // Set isFetchingData to false once categories are loaded (for non-edit mode).
  useEffect(() => {
    if (!id && categoriesData) {
      setIsFetchingData(false);
    }
  }, [id, categoriesData]);

  useEffect(() => {
    if (formData.dataset_id && datasets.length > 0) {
      const dataset = datasets.find(d => d.id.toString() === formData.dataset_id);
      if (dataset) {
        setSelectedDataset(dataset);
      }
    } else if (!formData.dataset_id) {
      setSelectedDataset(null);
    }
  }, [formData.dataset_id, datasets]);

  // Map UI question type to API question type
  const mapQuestionTypeToApi = (uiType: string): string => {
    const typeMap: Record<string, string> = {
      "MCQ Single": "mcq_single",
      "MCQ Multiple": "mcq_multiple",
      "Coding": "coding",
      "SQL": "sql",
      "Subjective": "subjective",
      "True/False": "true_false",
      "Fill Blanks": "fill_blank"
    };
    return typeMap[uiType] || uiType.toLowerCase();
  };

  // Map API question type to UI question type
  const mapQuestionTypeToUI = (apiType: string): string => {
    const typeMap: Record<string, string> = {
      "mcq_single": "MCQ Single",
      "mcq_multiple": "MCQ Multiple",
      "coding": "Coding",
      "sql": "SQL",
      "subjective": "Subjective",
      "true_false": "True/False",
      "fill_blank": "Fill Blanks"
    };
    return typeMap[apiType] || apiType;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleDatasetInputChange = (field: keyof DatasetFormData, value: string) => {
    setDatasetForm({
      ...datasetForm,
      [field]: value
    });
  };

  const addTestCase = () => {
    setFormData(prev => ({
      ...prev,
      testcases: [
        ...(prev.testcases || []),
        { input_data: "", expected_output: "", points: "1", is_hidden: false }
      ]
    }));
  };

  const addSQLTestCase = () => {
    setFormData(prev => ({
      ...prev,
      sql_testcases: [
        ...(prev.sql_testcases || []),
        { setup_sql: "", points: "1", is_hidden: false }
      ]
    }));
  };

  const removeTestCase = (index: number) => {
    setFormData(prev => ({
      ...prev,
      testcases: prev.testcases?.filter((_, i) => i !== index) || []
    }));
  };

  const removeSQLTestCase = (index: number) => {
    setFormData(prev => ({
      ...prev,
      sql_testcases: prev.sql_testcases?.filter((_, i) => i !== index) || []
    }));
  };

  const updateTestCase = (index: number, field: keyof TestCase, value: string | boolean) => {
    setFormData(prev => {
      const newTestCases = [...(prev.testcases || [])];
      newTestCases[index] = {
        ...newTestCases[index],
        [field]: value
      };
      return {
        ...prev,
        testcases: newTestCases
      };
    });
  };

  const updateSQLTestCase = (index: number, field: keyof SQLTestCase, value: string | boolean) => {
    setFormData(prev => {
      const newTestCases = [...(prev.sql_testcases || [])];
      newTestCases[index] = {
        ...newTestCases[index],
        [field]: value
      };
      return {
        ...prev,
        sql_testcases: newTestCases
      };
    });
  };

  const handleCreateDataset = async () => {
    if (!datasetForm.name.trim()) {
      toast({
        title: "Validation Failed",
        description: "Dataset name is required",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    if (!datasetForm.schema_ddl.trim()) {
      toast({
        title: "Validation Failed",
        description: "Schema DDL is required",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    setIsCreatingDataset(true);
    try {
      const response = await createSqlDatasetMut(datasetForm).unwrap();

      toast({
        title: "Dataset Created",
        description: `Dataset "${datasetForm.name}" created successfully`,
        variant: "success",
        duration: 3000,
      });

      // Reset form and close
      setDatasetForm({
        name: "",
        engine: "",
        schema_ddl: "",
        seed_sql: "",
        reference_solution: ""
      });
      setShowDatasetForm(false);

      // Refresh datasets list (RTK Query invalidates SqlDatasets tag, but refetch to be sure)
      await refetchDatasets();

      // Auto-select the newly created dataset
      const newDatasetId = response.id;
      handleInputChange("dataset_id", newDatasetId.toString());

    } catch (error: any) {
      console.error("Error creating dataset:", error);
      toast({
        title: "Failed Creating Dataset",
        description: error.data?.message || "Failed to create dataset",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsCreatingDataset(false);
    }
  };
  const handleInsertTable = () => {
    // Generate Header: | Header | Header |
    const header = "| " + Array(tableCols).fill("Header").join(" | ") + " |\n";
    // Generate Divider: | --- | --- |
    const divider = "| " + Array(tableCols).fill("---").join(" | ") + " |\n";
    // Generate Rows: | Cell | Cell |
    let rows = "";
    for (let i = 0; i < tableRows; i++) {
      rows += "| " + Array(tableCols).fill("Cell").join(" | ") + " |\n";
    }

    const markdownTable = `\n${header}${divider}${rows}\n`;

    // Append to the description field
    setFormData(prev => ({
      ...prev,
      description: (prev.description || "") + markdownTable
    }));

    setIsTableDialogOpen(false);
  };

  const prepareSubmitData = () => {
    const baseData: any = {
      title: formData.title,
      question_type: formData.question_type,
      category: formData.category ? parseInt(formData.category) : null,
      difficulty: formData.difficulty
    };

    // Add optional fields if they exist
    if (formData.marks) baseData.marks = parseFloat(formData.marks);
    if (formData.description) baseData.description = formData.description;
    if (formData.tags) baseData.tags = formData.tags;
    if (formData.sample_input) baseData.sample_input = formData.sample_input;
    if (formData.sample_output) baseData.sample_output = formData.sample_output;

    // Handle different question types
    switch (formData.question_type) {
      case "mcq_single":
      case "mcq_multiple":
      case "true_false":
        baseData.option1 = formData.option1 || "";
        baseData.option2 = formData.option2 || "";
        baseData.option3 = formData.option3 || "";
        baseData.option4 = formData.option4 || "";
        if (formData.option5) baseData.option5 = formData.option5;
        if (formData.correct_answer) baseData.correct_answer = formData.correct_answer;
        break;

      case "coding":
        if (formData.testcases && formData.testcases.length > 0) {
          baseData.testcases = formData.testcases.map(tc => ({
            input_data: tc.input_data,
            expected_output: tc.expected_output,
            points: parseFloat(tc.points),
            is_hidden: tc.is_hidden
          }));
        }
        break;

      case "sql":
        if (formData.dataset_id) {
          baseData.dataset_id = parseInt(formData.dataset_id);
        }
        if (formData.reference_solution) {
          baseData.reference_solution = formData.reference_solution;
        }
        baseData.strict_column_order = formData.strict_column_order;
        baseData.float_tolerance = parseFloat(formData.float_tolerance || "0");
        baseData.max_rows = parseInt(formData.max_rows || "5000");

        if (formData.sql_testcases && formData.sql_testcases.length > 0) {
          baseData.sql_testcases = formData.sql_testcases.map(tc => ({
            setup_sql: tc.setup_sql,
            points: parseFloat(tc.points),
            is_hidden: tc.is_hidden
          }));
        }
        break;

      case "fill_blank":
      case "subjective":
        // No additional fields needed
        break;
    }

    return baseData;
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      toast({
        title: "Validation Failed",
        description: "Question title is required",
        variant: "destructive",
        duration: 3000,
      });
      return false;
    }

    // For mock interview questions, type and category are not editable — skip these checks
    if (!isMockQuestion && !isAiMock) {
      if (!formData.question_type) {
        toast({
          title: "Validation Failed",
          description: "Question type is required",
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      if (!formData.category) {
        toast({
          title: "Validation Failed",
          description: "Category is required",
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      if (!formData.difficulty) {
        toast({
          title: "Validation Failed",
          description: "Difficulty is required",
          variant: "destructive",
          duration: 3000,
        });
        return false;
      }

      // Additional validation based on question type
      switch (formData.question_type) {
        case "mcq_single":
        case "mcq_multiple":
          if (
            !formData.option1?.trim() ||
            !formData.option2?.trim() ||
            !formData.option3?.trim() ||
            !formData.option4?.trim()
          ) {
            toast({
              title: "Validation Failed",
              description: "Options A, B, C, D are mandatory",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          if (!formData.correct_answer?.trim()) {
            toast({
              title: "Validation Failed",
              description: "Correct answer is required for MCQ questions",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          break;

        case "true_false":
          if (!formData.correct_answer) {
            toast({
              title: "Validation Failed",
              description: "Please select True or False",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          break;

        case "coding":
          if (formData.testcases && formData.testcases.length === 0) {
            toast({
              title: "Validation Failed",
              description: "At least one test case is required for coding questions",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          break;

        case "sql":
          if (!formData.dataset_id) {
            toast({
              title: "Validation Failed",
              description: "Dataset is required for SQL questions",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          if (!formData.reference_solution?.trim()) {
            toast({
              title: "Validation Failed",
              description: "Reference solution is required for SQL questions",
              variant: "destructive",
              duration: 3000,
            });
            return false;
          }
          break;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    const submitData = prepareSubmitData();

    try {
      if (isMockQuestion && questionId) {
        // Update mock interview question via dedicated endpoint
        const mockData = {
          title: formData.title,
          description: formData.description || "",
          difficulty: formData.difficulty,
          stack: formData.tags || "",
        };
        await updateAiMockQuestionMut({ id: questionId, data: mockData }).unwrap();

        toast({
          title: "Question Updated Successfully",
          description: `Question "${formData.title}" has been updated successfully.`,
          duration: 3000,
          variant: "success",
        });
      } else if (questionId) {
        // Update existing core question
        await updateQuestionMut({ id: questionId, data: submitData }).unwrap();

        toast({
          title: "Question Updated Successfully",
          description: `Question "${formData.title}" has been updated successfully.`,
          duration: 3000,
          variant: "success",
        });
      } else {
        //const isAiMock = location.state?.source === "ai_mock";  //commnet out

        if (isAiMock) {
          // AI Mock question add - Use RTK Query mutation instead of raw fetch
          const aiMockData = {
            title: formData.title,
            description: formData.description || "",
            difficulty: formData.difficulty,
            stack: formData.tags || "",
          };

          try {
            await addAiMockQuestion(aiMockData).unwrap();

            toast({
              title: "AI Question Created Successfully",
              description: `Question "${formData.title}" has been added to AI & Mock bank.`,
              duration: 3000,
              variant: "success",
            });
          } catch (error) {
            throw error;
          }
        } else {
          // Create new question
          await addQuestionMut(submitData).unwrap();

          toast({
            title: "Question Created Successfully",
            description: `Question "${formData.title}" has been added successfully.`,
            duration: 3000,
            variant: "success",
          });
        }
      }

      // Navigate back after success
      setTimeout(() => {
        navigate("/admin/questions");
      }, 1000);

    } catch (error: any) {
      console.error("Error submitting question:", error);

      let errorMessage = "Failed to process request. Please try again.";

      if (error.data) {
        const errors = error.data;
        if (typeof errors === 'object') {
          errorMessage = Object.entries(errors)
            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value[0] : value}`)
            .join(', ');
        } else if (typeof errors === 'string') {
          errorMessage = errors;
        }
      }

      toast({
        title: questionId ? "Failed Updating Question" : "Failed Creating Question",
        description: errorMessage,
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const renderQuestionTypeFields = () => {
    const uiQuestionType = mapQuestionTypeToUI(formData.question_type);

    switch (formData.question_type) {
      case "mcq_single":
      case "mcq_multiple":
      case "true_false":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4, 5].map((num) => (
                <div key={num}>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Option {String.fromCharCode(64 + num)} {num <= 4 && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    value={formData[`option${num}` as keyof FormData] as string || ""}
                    onChange={(e) => handleInputChange(`option${num}`, e.target.value)}
                    required={num <= 4}
                    placeholder={`Enter option ${String.fromCharCode(64 + num)}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Correct Answer <span className="text-red-500">*</span>
              </label>
              <input
                value={formData.correct_answer || ""}
                onChange={(e) => handleInputChange("correct_answer", e.target.value)}
                placeholder={formData.question_type === "mcq_single" ? "Enter option letter (A, B, C, D)" : "Enter comma separated letters (A,C)"}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
              />
              <p className="text-xs text-slate-500 mt-0.5">
                {formData.question_type === "mcq_single"
                  ? "Enter single option letter (A, B, C, D)"
                  : formData.question_type === "mcq_multiple"
                    ? "Enter comma separated option letters (A,C or A,B,C)"
                    : "Enter 'True' or 'False'"}
              </p>
            </div>
          </div>
        );

      case "coding":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sample Input
                </label>
                <textarea
                  value={formData.sample_input || ""}
                  onChange={(e) => handleInputChange("sample_input", e.target.value)}
                  placeholder="Enter sample input"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sample Output
                </label>
                <textarea
                  value={formData.sample_output || ""}
                  onChange={(e) => handleInputChange("sample_output", e.target.value)}
                  placeholder="Enter sample output"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                />
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <h3 className="text-sm font-medium mb-1">Test Cases (for Coding questions)</h3>
              <p className="text-xs text-slate-500 mb-3">
                Add multiple test cases. Mark as Hidden if you don't want candidates to see expected output.
              </p>

              <div className="space-y-3">
                {formData.testcases?.map((testCase, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl shadow-sm p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-xs">Test Case {index + 1}</h4>
                      {formData.testcases && formData.testcases.length > 1 && (
                        <button
                          onClick={() => removeTestCase(index)}
                          className="flex items-center gap-0.5 px-2 py-0.5 text-red-600 hover:bg-red-50 rounded transition-all duration-200 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Input Data</label>
                        <textarea
                          value={testCase.input_data}
                          onChange={(e) => updateTestCase(index, "input_data", e.target.value)}
                          placeholder="Input data for test case"
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Expected Output</label>
                        <textarea
                          value={testCase.expected_output}
                          onChange={(e) => updateTestCase(index, "expected_output", e.target.value)}
                          placeholder="Expected output"
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <label className="mb-1 block text-xs font-semibold text-slate-700">Points</label>
                          <input
                            type="number"
                            value={testCase.points}
                            onChange={(e) => updateTestCase(index, "points", e.target.value)}
                            min="1"
                            step="0.5"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                          />
                        </div>
                        <div className="flex items-center gap-1 pt-4">
                          <input
                            type="checkbox"
                            checked={testCase.is_hidden}
                            onChange={(e) => updateTestCase(index, "is_hidden", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-violet"
                          />
                          <label className="text-xs">Hidden</label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {(!formData.testcases || formData.testcases.length === 0) && (
                  <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-slate-500 text-xs">No test cases added yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">Add at least one test case for evaluation</p>
                  </div>
                )}
              </div>

              <button
                onClick={addTestCase}
                className="flex items-center gap-0.5 px-2.5 py-1 border border-brand-violet/40 text-brand-violet rounded-lg hover:bg-violet-50 transition-all duration-200 mt-3 text-xs"
              >
                <PlusCircle className="w-3 h-3" />
                Add Test Case
              </button>
            </div>
          </div>
        );

      case "sql":
        return (
          <div className="space-y-4">
            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200/70">
              <p className="text-xs">
                For SQL questions, candidates will write SELECT queries. The system will compare with reference solution.
              </p>
            </div>

            {/* Sample Input/Output Section for SQL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sample Input
                </label>
                <textarea
                  value={formData.sample_input || ""}
                  onChange={(e) => handleInputChange("sample_input", e.target.value)}
                  placeholder="Enter sample input (e.g., sample data or query context)"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional: Provide sample input or context for the SQL question
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Sample Output
                </label>
                <textarea
                  value={formData.sample_output || ""}
                  onChange={(e) => handleInputChange("sample_output", e.target.value)}
                  placeholder="Enter expected sample output"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional: Show expected output for the sample input
                </p>
              </div>
            </div>

            {/* Dataset Selection with Create Option */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Dataset <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowDatasetForm(!showDatasetForm)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-brand-violet hover:bg-violet-50 rounded-lg border border-brand-violet/30"
                >
                  <Database className="w-3 h-3" />
                  {showDatasetForm ? "Hide Create Form" : "Create New Dataset"}
                </button>
              </div>

              {!showDatasetForm ? (
                <Select.Root
                  value={formData.dataset_id || ""}
                  onValueChange={(value) => {
                    handleInputChange("dataset_id", value);
                    const dataset = datasets.find(d => d.id.toString() === value);
                    setSelectedDataset(dataset || null);
                  }}
                >
                  <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                    <Select.Value placeholder="Select dataset" />
                    <Select.Icon>
                      <ChevronDown className="w-3 h-3" />
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[180px] z-50">
                      <Select.Viewport>
                        {datasets.map(dataset => (
                          <Select.Item
                            key={dataset.id}
                            value={dataset.id.toString()}
                            className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet"
                          >
                            <Select.ItemText>{dataset.name} ({dataset.engine})</Select.ItemText>
                          </Select.Item>
                        ))}
                      </Select.Viewport>
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              ) : (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/70">
                  <h3 className="text-xs font-medium mb-2">Create New Dataset</h3>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Dataset Name</label>
                      <input
                        value={datasetForm.name}
                        onChange={(e) => handleDatasetInputChange("name", e.target.value)}
                        placeholder="e.g., Employee Schema"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Engine</label>
                      <Select.Root
                        value={datasetForm.engine}
                        onValueChange={(value) => handleDatasetInputChange("engine", value)}
                      >
                        <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                          <Select.Value placeholder="Select engine" />
                          <Select.Icon>
                            <ChevronDown className="w-3 h-3" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[180px] z-50">
                            <Select.Viewport>
                              <Select.Item value="sqlite" className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet">
                                <Select.ItemText>SQLite</Select.ItemText>
                              </Select.Item>
                              <Select.Item value="mysql" className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet">
                                <Select.ItemText>MySQL</Select.ItemText>
                              </Select.Item>
                              <Select.Item value="postgres" className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet">
                                <Select.ItemText>PostgreSQL</Select.ItemText>
                              </Select.Item>
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Schema DDL (CREATE TABLE)</label>
                      <textarea
                        value={datasetForm.schema_ddl}
                        onChange={(e) => handleDatasetInputChange("schema_ddl", e.target.value)}
                        placeholder="CREATE TABLE employees(...);"
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">Seed SQL (INSERT)</label>
                      <textarea
                        value={datasetForm.seed_sql}
                        onChange={(e) => handleDatasetInputChange("seed_sql", e.target.value)}
                        placeholder="INSERT INTO employees VALUES (...);"
                        rows={3}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => setShowDatasetForm(false)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateDataset}
                        disabled={isCreatingDataset}
                        className="px-2 py-0.5 text-xs bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg hover:brightness-110 disabled:opacity-50"
                      >
                        {isCreatingDataset ? "Creating..." : "Create Dataset"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reference Solution */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Reference Solution (SELECT) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.reference_solution || ""}
                onChange={(e) => handleInputChange("reference_solution", e.target.value)}
                placeholder="Correct SQL query that will be used for grading"
                rows={3}
                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
              />
            </div>

            {/* SQL Evaluation Settings */}
            <div className="border border-slate-200 rounded-xl p-3">
              <h3 className="text-xs font-medium mb-2">Evaluation Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.strict_column_order}
                    onChange={(e) => handleInputChange("strict_column_order", e.target.checked)}
                    className="w-3 h-3"
                    id="strict-column-order"
                  />
                  <label htmlFor="strict-column-order" className="text-xs">
                    Strict Column Order
                  </label>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Float Tolerance</label>
                  <input
                    type="number"
                    value={formData.float_tolerance}
                    onChange={(e) => handleInputChange("float_tolerance", e.target.value)}
                    min="0"
                    step="0.001"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Max Rows</label>
                  <input
                    type="number"
                    value={formData.max_rows}
                    onChange={(e) => handleInputChange("max_rows", e.target.value)}
                    min="1"
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                  />
                </div>
              </div>
            </div>

            {/* SQL Test Cases */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium mb-1">SQL Test Cases</h3>
              <p className="text-xs text-slate-500 mb-3">
                Add setup SQL for each test case. The reference solution will be compared against candidate's query.
              </p>

              <div className="space-y-3">
                {formData.sql_testcases?.map((testCase, index) => (
                  <div key={index} className="bg-white border border-slate-200 rounded-xl shadow-sm p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-xs">Test Case {index + 1}</h4>
                      {formData.sql_testcases && formData.sql_testcases.length > 1 && (
                          <button
                            onClick={() => removeSQLTestCase(index)}
                            className="flex items-center gap-0.5 px-2 py-0.5 text-red-600 hover:bg-red-50 rounded transition-all duration-200 text-xs"
                          >
                            Remove
                          </button>
                        )}
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-700">Setup SQL (Optional)</label>
                        <textarea
                          value={testCase.setup_sql}
                          onChange={(e) => updateSQLTestCase(index, "setup_sql", e.target.value)}
                          placeholder="INSERT INTO employees VALUES (...);"
                          rows={2}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <label className="mb-1 block text-xs font-semibold text-slate-700">Points</label>
                          <input
                            type="number"
                            value={testCase.points}
                            onChange={(e) => updateSQLTestCase(index, "points", e.target.value)}
                            min="1"
                            step="0.5"
                            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                          />
                        </div>
                        <div className="flex items-center gap-1 pt-4">
                          <input
                            type="checkbox"
                            checked={testCase.is_hidden}
                            onChange={(e) => updateSQLTestCase(index, "is_hidden", e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 accent-brand-violet"
                          />
                          <label className="text-xs">Hidden</label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {(!formData.sql_testcases || formData.sql_testcases.length === 0) && (
                  <div className="text-center py-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-slate-500 text-xs">No SQL test cases added yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">Add SQL test cases for better evaluation</p>
                  </div>
                )}
              </div>

              <button
                onClick={addSQLTestCase}
                className="flex items-center gap-0.5 px-2.5 py-1 border border-brand-violet/40 text-brand-violet rounded-lg hover:bg-violet-50 transition-all duration-200 mt-3 text-xs"
              >
                <PlusCircle className="w-3 h-3" />
                Add SQL Test Case
              </button>
            </div>
          </div>
        );

      case "subjective":
      case "fill_blank":
        return (
          <div className="space-y-3">
            <div className={`p-2 rounded-lg ${formData.question_type === "fill_blank" ? "bg-violet-50" : "bg-amber-50"}`}>
              <p className="text-xs">
                {formData.question_type === "fill_blank"
                  ? "Use [blank] to indicate where blanks should appear in the question text."
                  : "Subjective questions require manual evaluation. No correct answer needed."}
              </p>
              {formData.question_type === "fill_blank" && (
                <p className="text-xs text-slate-600 mt-0.5">
                  Example: The capital of France is [blank].
                </p>
              )}
            </div>

            {formData.question_type === "fill_blank" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Correct Answers (for blanks)
                </label>
                <textarea
                  value={formData.correct_answer || ""}
                  onChange={(e) => handleInputChange("correct_answer", e.target.value)}
                  placeholder="Enter correct answers for each blank, one per line"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                />
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter one answer per line, matching the order of blanks in the question
                </p>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const SelectItem = React.forwardRef<HTMLDivElement, { children: React.ReactNode; value: string }>(
    ({ children, value, ...props }, forwardedRef) => {
    return (
      <Select.Item
        value={value}
        {...props}
        ref={forwardedRef}
        className="px-2.5 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer outline-none text-xs text-slate-700 data-[highlighted]:bg-violet-50 data-[state=checked]:font-semibold data-[state=checked]:text-brand-violet"
      >
        <Select.ItemText>{children}</Select.ItemText>
      </Select.Item>
    );
    }
  );

  const isEditMode = questionId || questionToEdit;

  if (isFetchingData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-violet mx-auto mb-2" />
            <p className="text-slate-600 text-sm">
              {isEditMode ? "Loading question data..." : "Loading question form..."}
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }
  // Candidate Preview
  const renderCandidatePreview = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 min-h-0">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold text-slate-800">
            {formData.title || "Untitled Question"}
          </h3>
          <div className="flex gap-2">
            <span className="px-2 py-1 bg-violet-100 text-[#5b1a85] text-xs rounded-full font-medium">
              Marks: {formData.marks || 1}
            </span>
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${formData.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
              formData.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                formData.difficulty === 'hard' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
              }`}>
              {formData.difficulty ? formData.difficulty.charAt(0).toUpperCase() + formData.difficulty.slice(1) : "Difficulty"}
            </span>
          </div>
        </div>

        {formData.description && (
          <div
            className="mb-6 text-sm text-slate-700 font-sans"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(formData.description) }}
          />
        )}

        {/* Type specific UI */}
        {formData.question_type === 'mcq_single' || formData.question_type === 'mcq_multiple' ? (
          <div className="space-y-3">
            {[formData.option1, formData.option2, formData.option3, formData.option4, formData.option5]
              .filter(opt => opt)
              .map((opt, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed">
                  <input type={formData.question_type === 'mcq_single' ? 'radio' : 'checkbox'} disabled className="w-4 h-4" />
                  <span className="text-sm text-slate-700">{opt}</span>
                </div>
              ))}
          </div>
        ) : formData.question_type === 'true_false' ? (
          <div className="space-y-3">
            {['True', 'False'].map((opt, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50 cursor-not-allowed">
                <input type="radio" disabled className="w-4 h-4" />
                <span className="text-sm text-slate-700">{opt}</span>
              </div>
            ))}
          </div>
        ) : formData.question_type === 'fill_blank' ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">Fill in the blanks:</p>
            <div className="text-sm font-medium leading-relaxed">
              {formData.description?.split('[blank]').map((part, i, arr) => (
                <React.Fragment key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <input disabled className="mx-2 w-24 border-b border-slate-400 bg-white px-1 text-center outline-none" placeholder="..." />
                  )}
                </React.Fragment>
              )) || "Add [blank] in description to preview."}
            </div>
          </div>
        ) : formData.question_type === 'subjective' ? (
          <textarea disabled rows={5} className="w-full p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm" placeholder="Candidate will write their answer here..." />
        ) : formData.question_type === 'coding' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {formData.sample_input && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Sample Input</p>
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{formData.sample_input}</pre>
                </div>
              )}
              {formData.sample_output && (
                <div className="p-3 bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-400 mb-1">Sample Output</p>
                  <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{formData.sample_output}</pre>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {/* Real Code Editor */}
              <Suspense fallback={<div className="flex h-[250px] items-center justify-center text-sm text-slate-400">Loading editor…</div>}>
                <CodeEditor
                  value={previewCode}
                  onChange={setPreviewCode}
                  language={previewLanguage}
                  onLanguageChange={(lang) => {
                    setPreviewLanguage(lang);
                    setPreviewCodeResult(null);
                  }}
                  onRun={() => handlePreviewCodeRun()}
                  onRunPlain={() => handlePreviewCodeRun()}
                  isRunning={previewIsRunning}
                  isRunnings={previewIsRunning}
                  editorTheme={previewEditorTheme}
                  onEditorThemeChange={setPreviewEditorTheme}
                  onToggleFullscreen={() => setPreviewEditorFullscreen((v) => !v)}
                  isFullscreen={previewEditorFullscreen}
                  placeholder="Write your code here..."
                  height="320px"
                />
              </Suspense>

              {/* Output Panel */}
              {previewCodeResult && (
                <div className="rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800 px-4 py-2 flex justify-between items-center">
            <span className="text-sm font-medium text-white">Output</span>
                    {previewCodeResult?.data?.summary && (
                      <span className="text-xs text-slate-300">
                {previewCodeResult.data.summary.passed_count}/{previewCodeResult.data.summary.total_cases} passed
                | {previewCodeResult.data.summary.earned_points}/{previewCodeResult.data.summary.total_points} pts
                      </span>
                    )}
                  </div>
                  <div className="bg-slate-900 p-4 font-mono text-sm max-h-48 overflow-auto">
                    {previewCodeResult?.error ? (
              <pre className="text-red-400">{previewCodeResult.error}</pre>
                    ) : (
              (previewCodeResult?.data?.results || []).map((tc: any, i: number) => (
                <div key={i} className={`mb-2 ${tc.passed ? 'text-green-400' : 'text-red-400'}`}>
                  Test {i + 1}: {tc.passed ? '✓ PASSED' : '✗ FAILED'}
                            {!tc.is_hidden && (
                              <div className="text-slate-400 text-xs ml-4">
                                <div>Expected: {tc.expected_output}</div>
                      <div>Got: {tc.stdout || '(no output)'}</div>
                              </div>
                            )}
                          </div>
              ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : formData.question_type === 'sql' ? (
          <div className="space-y-4">
            {/* Display sample input/output if provided */}
            {(formData.sample_input || formData.sample_output) && (
              <div className="grid grid-cols-2 gap-4">
                {formData.sample_input && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Sample Input / Context</p>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{formData.sample_input}</pre>
                  </div>
                )}
                {formData.sample_output && (
                  <div className="p-3 bg-slate-800 rounded-lg">
                    <p className="text-xs text-slate-400 mb-1">Sample Output</p>
              <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono">{formData.sample_output}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Display dataset schema if selected */}
            {selectedDataset && selectedDataset.schema_ddl ? (
              <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-1 font-semibold">
                            Database Schema: <span className="text-blue-400">{selectedDataset.name}</span>
                </p>
                <pre className="text-sm text-slate-200 whitespace-pre-wrap font-mono max-h-[150px] overflow-y-auto">
                  {selectedDataset.schema_ddl}
                </pre>
              </div>
            ) : formData.dataset_id ? (
              <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                <p className="text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                            Schema loading... Please wait or try selecting the dataset again.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                No dataset selected. Please select a dataset in the form above to view the schema.
                </p>
              </div>
            )}

            {/* SQL Editor with Run button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">

                <label className="text-sm font-medium text-slate-700">
                  Your SQL Query:
                </label>
              </div>
            </div>

            {/* SQL Code Editor */}
            <Suspense fallback={<div className="flex h-[220px] items-center justify-center text-sm text-slate-400">Loading editor…</div>}>
              <CodeEditor
                value={previewSqlQuery}
                onChange={setPreviewSqlQuery}
                language="sql"
                onLanguageChange={noop}
                onRun={handlePreviewSqlRun}
                onRunPlain={handlePreviewSqlRun}
                isRunning={previewSqlIsRunning}
                isRunnings={previewSqlIsRunning}
                editorTheme="vs-dark"
                onEditorThemeChange={noop}
                onToggleFullscreen={() => setPreviewEditorFullscreen((v) => !v)}
                isFullscreen={previewEditorFullscreen}
                placeholder="SELECT * FROM employees;"
                height="220px"
              />
            </Suspense>

            {/* Query Results */}
            {previewSqlResult && (
              <div className="rounded-lg border border-slate-700 overflow-hidden">
                <div className="bg-slate-800 px-4 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    Query Results
                  </span>
                  {!previewSqlResult?.error && (
                              <span className="text-xs text-slate-400">
                                SQL Preview
                              </span>
                  )}
                </div>
                <div className="bg-slate-900 p-4 max-h-[500px] overflow-auto">

                  {/* ERROR VIEW */}
                  {previewSqlResult?.error ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-400">
                        <XCircle className="w-4 h-4" />
                        <span className="font-semibold text-sm">
                          SQL Execution Error
                        </span>
                      </div>
                      <pre className="text-red-300 text-xs whitespace-pre-wrap break-words bg-red-950/30 p-3 rounded border border-red-800">
                        {previewSqlResult.error}
                      </pre>
                    </div>
                            ) : (() => {

                      const rows =
                        previewSqlResult?.rows ||
                        previewSqlResult?.data?.rows ||
                        previewSqlResult?.results ||
                        [];

                      if (Array.isArray(rows) && rows.length > 0) {
                        const firstRow = rows[0];
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">
                                Query executed successfully
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              Returned {rows.length} row(s)
                            </div>
                            <div className="overflow-x-auto border border-slate-700 rounded-lg">
                              <table className="min-w-full text-xs">
                                <thead className="bg-slate-800">
                                  <tr>
                                    {Object.keys(firstRow).map((key) => (
                                      <th
                                        key={key}
                                        className="px-3 py-2 text-left text-slate-200 border-b border-slate-700"
                                      >
                                        {key}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row: any, rowIndex: number) => (
                                    <tr
                                      key={rowIndex}
                                      className="border-b border-slate-800 hover:bg-slate-800/50"
                                    >
                                              {Object.values(row).map((value: any, colIndex: number) => (
                                          <td
                                            key={colIndex}
                                            className="px-3 py-2 text-slate-300"
                                          >
                                            {value === null
                                              ? "NULL"
                                              : typeof value === "object"
                                                ? JSON.stringify(value)
                                                : String(value)}
                                          </td>
                                              ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              Query executed successfully
                            </span>
                          </div>
                          <div className="text-slate-300 text-sm">
                            No rows returned
                          </div>
                          <pre className="text-slate-400 text-xs bg-slate-800 p-3 rounded overflow-auto">
                            {JSON.stringify(previewSqlResult, null, 2)}
                          </pre>
                        </div>
                      );
                            })()}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded text-center text-sm text-slate-500">
            Please fill the form completely to see the preview.
          </div>
                          )
                        }
                            </div >
    );
  };

  return (
    <AdminLayout>
      <div className="w-full">
        <PageHeader
          icon={Database}
          title={isEditMode ? `Edit Question${questionId ? ` (ID: ${questionId})` : ""}` : "Add New Question"}
          description={isEditMode ? "Update this question's content and settings." : "Create a question for the question bank."}
          className="mb-6"
          actions={
            <button
              onClick={() => navigate(-1)}
              title="Back to questions list"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]">
              <div className="p-4">
                <div className="space-y-4">
                  {/* Question Title */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Question Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      placeholder="Enter question title"
                      required
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                    />
                  </div>

                  {/* Question Type, Category, Difficulty and Marks */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Question Type <span className="text-red-500">*</span>
                      </label>
                      <Select.Root
                        value={formData.question_type}
                        onValueChange={(value) => handleInputChange("question_type", value)}
                      >
                        <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                          <Select.Value placeholder="Select question type" />
                          <Select.Icon>
                            <ChevronDown className="w-2.5 h-2.5" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[205px] z-50"
                            position="popper"
                            side="bottom"
                            align="start"
                          >
                            <Select.Viewport className="max-h-[200px] overflow-y-auto">
                              <SelectItem value="mcq_single">MCQ (Single Correct)</SelectItem>
                              <SelectItem value="mcq_multiple">MCQ (Multiple Correct)</SelectItem>
                              <SelectItem value="coding">Coding</SelectItem>
                              <SelectItem value="sql">SQL</SelectItem>
                              <SelectItem value="subjective">Subjective</SelectItem>
                              <SelectItem value="true_false">True/False</SelectItem>
                              <SelectItem value="fill_blank">Fill Blanks</SelectItem>
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select the question type
                      </p>
                    </div>

                    {/* Category */}
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <Select.Root
                        value={formData.category}
                        onValueChange={(value) => handleInputChange("category", value)}
                      >
                        <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                          <Select.Value placeholder="Select category" />
                          <Select.Icon>
                            <ChevronDown className="w-2.5 h-2.5" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[152px] z-50"
                            position="popper"
                            side="bottom"
                            align="start"
                          >
                            <Select.Viewport className="max-h-[200px] overflow-y-auto">
                              {categories.map(category => (
                                <SelectItem key={category.id} value={category.id.toString()}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select the primary category
                      </p>
                    </div>

                    {/* Difficulty */}
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Difficulty <span className="text-red-500">*</span>
                      </label>
                      <Select.Root
                        value={formData.difficulty}
                        onValueChange={(value) => handleInputChange("difficulty", value)}
                      >
                        <Select.Trigger className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40">
                          <Select.Value placeholder="Select difficulty" />
                          <Select.Icon>
                            <ChevronDown className="w-2.5 h-2.5" />
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal>
                          <Select.Content
                            className="bg-white border border-slate-200/80 rounded-xl shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/5 p-1.5 min-w-[152px] z-50"
                            position="popper"
                            side="bottom"
                            align="start"
                            avoidCollisions={false}
                          >
                            <Select.Viewport>
                              <SelectItem value="easy">Easy</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="hard">Hard</SelectItem>
                            </Select.Viewport>
                          </Select.Content>
                        </Select.Portal>
                      </Select.Root>
                    </div>

                    {/* Marks */}
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Marks
                      </label>
                      <input
                        type="number"
                        value={formData.marks}
                        // onChange={(e) => handleInputChange("marks", e.target.value)}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);

                          if (value > 20) {
                            setMarksError("Marks cannot be greater than 20");
                          } else {
                            setMarksError("");
                            handleInputChange("marks", value);
                          }
                        }}
                        placeholder="Enter marks"
                        min="1"
                        max="20"
                        step="0.5"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                      />
                      {marksError && (
                        <p className="text-red-500 text-xs mt-1">
                          {marksError}
                        </p>
                      )}
                    </div>

                  </div>

                  {/* Description */}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Description
                      </label>

                      {!isEditMode && (
                        <Dialog.Root open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
                          <Dialog.Trigger asChild>
                            {/* <button
                              type="button"
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-violet-50 text-brand-violet hover:bg-violet-100 border border-brand-violet/20 rounded-lg transition-all shadow-sm"
                            >
                              <Table className="w-3 h-3" /> Quick Table Builder
                            </button> */}
                          </Dialog.Trigger>

                          <Dialog.Portal>
                            <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]" />
                            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-5 rounded-2xl shadow-2xl z-[101] w-72 border border-slate-200/70">
                              <Dialog.Title className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Table className="w-4 h-4 text-brand-violet" /> Generate Table
                              </Dialog.Title>

                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold uppercase text-slate-500">Rows</label>
                                    <input
                                      type="number"
                                      value={tableRows}
                                      onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-semibold uppercase text-slate-500">Cols</label>
                                    <input
                                      type="number"
                                      value={tableCols}
                                      onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setIsTableDialogOpen(false)}
                                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleInsertTable}
                                    className="px-3 py-1.5 text-xs bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg hover:brightness-110 font-medium shadow-md transition-transform active:scale-95"
                                  >
                                    Insert Table
                                  </button>
                                </div>
                              </div>
                            </Dialog.Content>
                          </Dialog.Portal>
                        </Dialog.Root>
                      )}
                    </div>

                    <textarea
                      value={formData.description || ""}
                      onChange={(e) => handleInputChange("description", e.target.value)}
                      placeholder={isEditMode ? "Enter question description" : "Enter question description."}
                      rows={12}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 font-mono text-xs text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                    />

                    {!isEditMode && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        * Table will be inserted at the end of your current text.
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      Tags{" "}
                      {location.state?.source === "ai_mock" && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>

                    {location.state?.source === "ai_mock" ? (
                      <select
                        value={formData.tags || ""}
                        onChange={(e) =>
                          handleInputChange("tags", e.target.value)
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
                      >
                        <option value="">Select Stack</option>
                        {availableStacks.map((stack) => (
                          <option key={stack} value={stack}>
                            {stack}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.tags || ""}
                      onChange={(e) => handleInputChange("tags", e.target.value)}
                        placeholder="Comma separated tags (optional)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                      />
                    )}
                  </div>

                  {/* Question Type Specific Fields */}
                  {formData.question_type && (
                    <div className="border-t pt-3">
                      <h3 className="text-sm font-medium mb-2">
                        {mapQuestionTypeToUI(formData.question_type)} Configuration
                      </h3>
                      {renderQuestionTypeFields()}
                    </div>
                  )}

                  {/* Submit Button */}
                  {/* Actions: Preview & Submit Button */}
                  <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="flex items-center justify-center gap-1 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-all duration-200 text-sm font-medium"
                    >
                      <Eye className="w-4 h-4" />
                      Preview Question
                    </button>

                    <button
                      onClick={handleSubmit}
                      disabled={isSaving}
                      className="flex items-center justify-center gap-1 px-4 py-2 bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg hover:brightness-110 transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isEditMode ? "Updating..." : "Creating..."}
                        </>
                      ) : (
                        <>
                          {isEditMode ? <Save className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
                          {isEditMode ? "Update Question" : "Add Question"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1">
            <div className="space-y-4 lg:sticky lg:top-4">
              <div className="bg-violet-50 rounded-xl border border-brand-violet/20 p-3">
                <div className="flex items-center gap-1 text-brand-violet font-semibold mb-2">
                  <Info className="w-3 h-3" />
                  <h2 className="text-xs">{isEditMode ? "Editing Question" : "Supported Types"}</h2>
                </div>

                <ul className="space-y-1 text-xs text-slate-700">
                  {isEditMode ? (
                    <>
                      <li><strong>Question ID:</strong> {questionId}</li>
                      <li><strong>Mode:</strong> Edit Mode</li>
                      <li><strong>Note:</strong> You can change question type from dropdown</li>
                    </>
                  ) : (
                    <>
                      <li><strong>MCQ Single:</strong> Single correct answer</li>
                      <li><strong>MCQ Multiple:</strong> Multiple correct answers</li>
                      <li><strong>Coding:</strong> Programming questions</li>
                      <li><strong>SQL:</strong> Database query questions</li>
                      <li><strong>Subjective:</strong> Descriptive answers</li>
                      <li><strong>True/False:</strong> Boolean questions</li>
                      <li><strong>Fill Blanks:</strong> Fill in the blanks</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="bg-amber-50 rounded-xl border border-amber-200/70 p-3">
                <div className="flex items-center gap-1 text-amber-700 font-semibold mb-2">
                  <AlertTriangle className="w-3 h-3" />
                  <h2 className="text-xs">Important Notes</h2>
                </div>

                <ul className="space-y-1 text-xs text-slate-700">
                  {isEditMode ? (
                    <>
                      <li>• Question type can be changed in edit mode</li>
                      <li>• Review all changes before saving</li>
                      <li>• Test cases can be added, modified, or removed</li>
                      <li>• Changing dataset for SQL questions may affect existing answers</li>
                      <li>• Save changes only when you're sure</li>
                    </>
                  ) : (
                    <>
                      <li><strong>MCQ:</strong> Options required, correct answer as A/B/C/D</li>
                      <li><strong>Coding:</strong> Sample input/output recommended</li>
                      <li><strong>SQL:</strong> Select dataset and provide reference solution</li>
                      <li>Hidden testcases will not be shown to candidates</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)] p-3">
                <h2 className="text-xs font-medium mb-2">
                  {isEditMode ? "Edit Best Practices" : "Best Practices"}
                </h2>

                <ul className="space-y-1 text-xs text-slate-700">
                  {isEditMode ? (
                    <>
                      <li>• Verify that changes don't break existing assessments</li>
                      <li>• Test modified test cases thoroughly</li>
                      <li>• Update tags if question scope has changed</li>
                      <li>• Consider notifying users if major changes are made</li>
                      <li>• Keep a record of what was changed</li>
                      <li>• Test the question after editing</li>
                    </>
                  ) : (
                    <>
                      <li>• Keep questions clear and concise</li>
                      <li>• Provide sufficient context for candidates</li>
                      <li>• For coding questions, include sample input/output</li>
                      <li>• For SQL questions, test your reference solution</li>
                      <li>• Use appropriate difficulty levels</li>
                      <li>• Add relevant tags to make questions searchable</li>
                      <li>• Select relevant categories for better organization</li>
                      <li>• Review questions for accuracy before adding</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Candidate Preview Modal */}
      <Dialog.Root open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-100 rounded-2xl border border-slate-200/70 shadow-2xl z-[101] w-11/12 max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200">
              <div>
                <Dialog.Title className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-brand-violet" />
                  Candidate Preview
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-500 mt-1">
                  This is how the candidate will see this question during the test.
                </Dialog.Description>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {renderCandidatePreview()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                Close Preview
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </AdminLayout>
  );
};
