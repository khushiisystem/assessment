import React from "react";
import { toast } from "@/hooks/use-toast";
import {
  useAutofillAssessmentQuestionsMutation,
  useGetCategoriesQuery,
  useLazyGetAssessmentByIdQuery,
  useLazyGetAssessmentQuestionsQuery,
  useUpdateAssessmentMutation,
} from "@/store";
import {
  Assessment,
  AutoFillRule,
  Category,
  Question,
} from "@/components/assessments/AssessmentDetailsTypes";

export interface UseAssessmentQuestionsResult {
  // Search
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  // Question list
  loadingQuestions: boolean;
  loadingMoreQuestions: boolean;
  filteredQuestions: Question[];
  totalQuestions: number;
  hasMoreQuestions: boolean;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  onAddQuestion: (questionId: number) => void;
  // Already-assigned question ids (lives on the assessment)
  assessmentQuestionIds: number[];
  // The full selected-question objects (for previewing/removing in the panel)
  selectedQuestions: Question[];
  onRemoveQuestion: (questionId: number) => void;
  // Auto-fill
  autoFillRules: AutoFillRule[];
  isAutoFillValid: boolean;
  onAddAutoFillRule: () => void;
  onRemoveAutoFillRule: (ruleId: number) => void;
  onUpdateAutoFillRule: (ruleId: number, field: keyof AutoFillRule, value: string) => void;
  onAutoFillQuestions: () => void;
  // Deduped categories
  categories: Category[];
}

/**
 * Encapsulates the Question Bank + Auto-fill logic shared between
 * AssessmentDetails and the configure flow on CreateAssessment.
 *
 * @param assessmentId  The assessment id to operate on (null until created).
 * @param categoryIds   The assessment's category ids — used to scope the
 *                      question-bank search. Pass the live form value so the
 *                      bank narrows as the admin edits categories.
 * @param onChanged     Called after a successful add / auto-fill so the parent
 *                      can refresh its own assessment data.
 */
export function useAssessmentQuestions(
  assessmentId: number | null,
  categoryIds: number[],
  onChanged?: () => void | Promise<void>
): UseAssessmentQuestionsResult {
  const { data: categoriesData } = useGetCategoriesQuery();
  const [getAssessmentById] = useLazyGetAssessmentByIdQuery();
  const [getAssessmentQuestions] = useLazyGetAssessmentQuestionsQuery();
  const [updateAssessmentMut] = useUpdateAssessmentMutation();
  const [autofillQuestions] = useAutofillAssessmentQuestionsMutation();

  const searchDebounceRef = React.useRef<number | null>(null);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredQuestions, setFilteredQuestions] = React.useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = React.useState(false);
  const [loadingMoreQuestions, setLoadingMoreQuestions] = React.useState(false);
  const [questionPage, setQuestionPage] = React.useState(1);
  const [hasMoreQuestions, setHasMoreQuestions] = React.useState(true);
  const [totalQuestions, setTotalQuestions] = React.useState(0);

  // The set of question ids already on the assessment. AssessmentDetails reads
  // this off its own assessmentData; here we own a copy so this hook can be the
  // single source of truth for the panel regardless of the consumer.
  const [assessmentQuestionIds, setAssessmentQuestionIds] = React.useState<number[]>([]);

  // The full selected-question objects plus the assessment object itself, so the
  // panel can preview the selection and removal can spread the assessment.
  const [selectedQuestions, setSelectedQuestions] = React.useState<Question[]>([]);
  const assessmentRef = React.useRef<Assessment | null>(null);

  const [autoFillRules, setAutoFillRules] = React.useState<AutoFillRule[]>([
    { id: 1, category: "", type: "", difficulty: "", count: "" },
  ]);
  const isAutoFillValid = autoFillRules.every((rule) => rule.category && rule.type && rule.count);

  // The categories API can return duplicate names; dedupe by name (auto-fill
  // looks a category up by name) so the dropdown has no repeats.
  const categories = React.useMemo<Category[]>(() => {
    const seen = new Set<string>();
    return (categoriesData || []).filter((category: Category) => {
      const key = (category.name || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categoriesData]);

  // Keep a serialized key so the fetch callback stays stable across renders.
  const categoryKey = React.useMemo(() => (categoryIds || []).join(","), [categoryIds]);

  const refreshAssessmentQuestionIds = React.useCallback(async () => {
    if (!assessmentId) {
      setAssessmentQuestionIds([]);
      setSelectedQuestions([]);
      assessmentRef.current = null;
      return;
    }
    try {
      const data = await getAssessmentById(assessmentId).unwrap();
      const assessment = data?.assessment as Assessment | undefined;
      assessmentRef.current = assessment || null;
      setAssessmentQuestionIds(assessment?.question_ids || []);
      setSelectedQuestions((data?.questions as Question[] | undefined) || []);
    } catch (error) {
      console.error("Error loading assessment question ids:", error);
    }
  }, [assessmentId, getAssessmentById]);

  React.useEffect(() => {
    void refreshAssessmentQuestionIds();
  }, [refreshAssessmentQuestionIds]);

  const fetchQuestions = React.useCallback(
    (page: number = 1, append: boolean = false, search: string = "") => {
      const doFetch = async () => {
        try {
          if (page === 1 && !append) {
            setLoadingQuestions(true);
          } else {
            setLoadingMoreQuestions(true);
          }

          const params: { page: number; page_size: number; categories?: number[]; search?: string } = {
            page,
            page_size: 20,
          };

          const ids = categoryKey ? categoryKey.split(",").map(Number) : [];
          if (ids.length) {
            params.categories = ids;
          }

          if (search.trim()) {
            params.search = search.trim();
          }

          const data = await getAssessmentQuestions(params).unwrap();

          if (data) {
            const newQuestions = data.results?.questions || [];
            const total = data.count || 0;

            if (append) {
              setFilteredQuestions((prev) => [...prev, ...newQuestions]);
            } else {
              setFilteredQuestions(newQuestions);
            }

            setTotalQuestions(total);
            setHasMoreQuestions(!!data.next);
            setQuestionPage(page);
          }
        } catch (error) {
          console.error("Error fetching questions:", error);
          toast({
            title: "Failed",
            description: "Failed to load questions",
            variant: "destructive",
            duration: 3000,
          });
        } finally {
          setLoadingQuestions(false);
          setLoadingMoreQuestions(false);
        }
      };

      void doFetch();
    },
    [getAssessmentQuestions, categoryKey]
  );

  React.useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      fetchQuestions(1, false, searchQuery);
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [fetchQuestions, searchQuery]);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

    if (scrollBottom <= 50 && hasMoreQuestions && !loadingMoreQuestions) {
      fetchQuestions(questionPage + 1, true, searchQuery);
    }
  };

  const onSearchSubmit = () => fetchQuestions(1, false, searchQuery);

  const onClearSearch = () => {
    setSearchQuery("");
    fetchQuestions(1, false, "");
  };

  const notifyChanged = React.useCallback(async () => {
    await refreshAssessmentQuestionIds();
    if (onChanged) await onChanged();
  }, [refreshAssessmentQuestionIds, onChanged]);

  const onAddQuestion = async (questionId: number) => {
    if (!assessmentId) return;

    try {
      const data = await getAssessmentById(assessmentId).unwrap();
      const assessment = data?.assessment as Assessment | undefined;
      if (!assessment) return;

      const updatedQuestionIds = [...assessment.question_ids, questionId];

      await updateAssessmentMut({
        id: assessmentId,
        data: { ...assessment, question_ids: updatedQuestionIds },
      }).unwrap();

      await notifyChanged();

      toast({
        title: "Success",
        description: "Question added to assessment",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error adding question:", error);
      toast({
        title: "Failed",
        description: "Failed to add question to assessment",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const onRemoveQuestion = async (questionId: number) => {
    if (!assessmentId) return;

    const assessment = assessmentRef.current;
    if (!assessment) return;

    try {
      const updatedQuestionIds = assessment.question_ids.filter((idItem) => idItem !== questionId);

      await updateAssessmentMut({
        id: assessmentId,
        data: { ...assessment, question_ids: updatedQuestionIds },
      }).unwrap();

      await notifyChanged();

      toast({
        title: "Success",
        description: "Question removed from assessment",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error removing question:", error);
      toast({
        title: "Failed",
        description: "Failed to remove question from assessment",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const onAddAutoFillRule = () => {
    setAutoFillRules((prev) => [
      ...prev,
      { id: prev.length + 1, category: "", type: "", difficulty: "", count: "" },
    ]);
  };

  const onRemoveAutoFillRule = (ruleId: number) => {
    if (autoFillRules.length > 1) {
      setAutoFillRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    }
  };

  const onUpdateAutoFillRule = (ruleId: number, field: keyof AutoFillRule, value: string) => {
    setAutoFillRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
    );
  };

  const onAutoFillQuestions = async () => {
    if (!assessmentId) return;

    try {
      const rulesPayload = autoFillRules
        .filter((rule) => rule.category && rule.type)
        .map((rule) => {
          const categoryObj = categories.find((category) => category.name === rule.category);
          return {
            category_id: categoryObj?.id,
            question_type: rule.type,
            difficulty: rule.difficulty || "any",
            count: rule.count ? Number(rule.count) : 0,
          };
        })
        .filter((rule) => rule.category_id);

      if (rulesPayload.length === 0) {
        toast({
          title: "Invalid Rules",
          description: "Please select valid category and type",
          variant: "destructive",
        });
        return;
      }

      const data = await autofillQuestions({
        id: assessmentId,
        data: { rules: rulesPayload },
      }).unwrap();

      const added = data.added || 0;
      const requested = rulesPayload.reduce((sum, rule) => sum + (rule.count || 0), 0);

      if (added === 0) {
        // No questions matched the selected category / type / difficulty.
        toast({
          title: "No matching questions",
          description:
            "No questions are available for the selected rules. Try a different category, type, or difficulty.",
          variant: "destructive",
        });
        return;
      }

      if (requested && added < requested) {
        // Some matched, but not as many as requested.
        toast({
          title: "Partially filled",
          description: `Added ${added} of ${requested} requested — not enough questions matched the selected rules.`,
          variant: "default",
        });
      } else {
        toast({
          title: "Auto-fill completed",
          description: `Added ${added} question${added === 1 ? "" : "s"}`,
          variant: "success",
        });
      }

      await notifyChanged();
    } catch (error: any) {
      console.error("Auto-fill failed", error);
      toast({
        title: "Auto-fill failed",
        description:
          error?.data?.detail || error?.response?.data?.detail || "Unable to auto-fill questions",
        variant: "destructive",
      });
    }
  };

  return {
    searchQuery,
    onSearchQueryChange: setSearchQuery,
    onSearchSubmit,
    onClearSearch,
    loadingQuestions,
    loadingMoreQuestions,
    filteredQuestions,
    totalQuestions,
    hasMoreQuestions,
    onScroll,
    onAddQuestion,
    assessmentQuestionIds,
    selectedQuestions,
    onRemoveQuestion,
    autoFillRules,
    isAutoFillValid,
    onAddAutoFillRule,
    onRemoveAutoFillRule,
    onUpdateAutoFillRule,
    onAutoFillQuestions,
    categories,
  };
}
