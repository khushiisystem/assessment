import { sanitizeHtml } from "@/lib/sanitize";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  Circle,
  ArrowLeft,
  BookOpen,
  Loader2,
  Download,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Trash2,
  Plus,
  Video,
  Music,
  FileText,
  Github,
  Code as CodeIcon,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import {
  addNote,
  deleteNote,
  getNotes,
  toEmbeddableUrl,
  LearningNote,
} from "@/lib/notes";
import { generateCertificatePDF } from "@/lib/generateCertificate";
import { tokenStorage } from "@/lib/tokenStorage";
import { useToast } from "@/components/ui/use-toast";
import {
  useLazyGetProgressQuery,
  useLazyGetTechnologyQuestionsQuery,
  useCreateCompletionMutation,
  useCompleteModuleMutation,
  useLazyGetCompletionsQuery,
  useSendCourseCompleteEmailMutation, 
} from "@/store";

interface Question {
  id: number;
  question: string;
  answer: string;
  difficulty: string;
  is_active: boolean;
  reference_link: string | null;
  task_description: string | null;
  task_file: string | null;
  module_level: string;
  completed?: boolean;
  technology: {
    id: string;
    name: string;
    category: string;
    description: string;
    created_at: string;
    updated_at: string;
  };
}

interface StudyMaterial {
  id: string;
  title: string;
  type: "video" | "audio" | "document" | "github" | "api" | "link";
  url: string;
  description?: string;
}

interface Module {
  id: string;
  name: string;
  level: string;
  questionCount: number;
  completedCount: number;
  questions: Question[];
  studyMaterials?: StudyMaterial[];
}

interface ModuleViewProps {
  technologyId: string;
  technologyName: string;
  onBack?: () => void;
}

interface CompletionResponse {
  id: number;
  userId: number;
  questionId: number;
  completed_at: string;
}

const ModuleView = ({
  technologyId,
  technologyName,
  onBack,
}: ModuleViewProps) => {
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [organizedModules, setOrganizedModules] = useState<Module[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingComplete, setIsMarkingComplete] = useState<number | null>(
    null
  );
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [newLink, setNewLink] = useState<string>("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(
    new Set()
  );
  const [userId, setUserId] = useState<number | null>(null);
  const [progressData, setProgressData] = useState<{
    completed: number;
    total: number;
  } | null>(null);
  
  const isInitialMount = useRef(true);
  const pendingCompletionRef = useRef<number | null>(null);
  const emailSentRef = useRef(false);

  const { toast } = useToast();
  const [getProgress] = useLazyGetProgressQuery();
  const [getTechnologyQuestions] = useLazyGetTechnologyQuestionsQuery();
  const [createCompletion] = useCreateCompletionMutation();
  const [completeModule] = useCompleteModuleMutation();
  const [sendCourseCompleteEmail] = useSendCourseCompleteEmailMutation(); 
  const [getCompletions] = useLazyGetCompletionsQuery();
  // Cache for completions to avoid refetching
  const completionsCache = useRef<Map<number, Set<number>>>(new Map());

  const fetchAllTechnologyQuestions = async (initialUrl: string): Promise<Question[]> => {
    const accumulated: Question[] = [];
    let url: string | null = initialUrl;

    while (url) {
      const pageData = await getTechnologyQuestions(url).unwrap();
      const pageResults: Question[] = pageData.results || [];
      accumulated.push(...pageResults);
      url = pageData.next || null;
    }

    return accumulated;
  };

  // Get user ID from tokenStorage
  useEffect(() => {
    const user = tokenStorage.getUser();
    // @ts-ignore
    if (user?.id) {
      // @ts-ignore
      setUserId(user.id);
    }
  }, []);

  // Function to fetch completions for the user (only once)
  const fetchCompletions = useCallback(async (userIdNum: number): Promise<Set<number>> => {
    // Check cache first
    if (completionsCache.current.has(userIdNum)) {
      return completionsCache.current.get(userIdNum)!;
    }
    
    try {
      const completionsData = await getCompletions(
        `/api/completions/?user=${userIdNum}&page_size=1000`
      ).unwrap();
      const completions: CompletionResponse[] = completionsData.results || [];
      
      // Also fetch next pages if any
      let nextUrl = completionsData.next;
      let allCompletions = [...completions];
      
      while (nextUrl) {
        const nextData = await getCompletions(nextUrl).unwrap();
        allCompletions.push(...(nextData.results || []));
        nextUrl = nextData.next;
      }
      
      const completedSet = new Set(allCompletions.map((c) => c.questionId));
      // Cache the result
      completionsCache.current.set(userIdNum, completedSet);
      return completedSet;
    } catch (error) {
      console.error("Error fetching completions:", error);
      return new Set();
    }
  }, [getCompletions]);

  // Function to fetch progress data
const fetchProgressData = useCallback(async () => {
      if (!technologyId) return null; 
      try {
        const progressData = await getProgress().unwrap();
        const progressResults = progressData.results || [];
        const techProgress = progressResults.find(
          (p: any) => p.technologyId === technologyId
        );

        if (techProgress) {
          return {
            completed: techProgress.completed,
            total: techProgress.total,
          };
        }
      } catch (error) {
        console.error("Error fetching progress data:", error);
      }
      return null;
  }, [technologyId, getProgress]);

  // Main data fetching function (only on initial load)
const fetchAllData = useCallback(async () => {
      if (!technologyId) return;

      setIsLoading(true);
      try {
        // Fetch questions
        const questions = await fetchAllTechnologyQuestions(
          `api/technologies/${technologyId}/questions/?page_size=100`
        );

        // Filter ONLY active questions for the current technology
      // This is critical - we should only show active questions
        const activeQuestions = questions.filter((q) => q.is_active);

        // Fetch completed questions for this user
        let completedIds = new Set<number>();
        let progressInfo = null;
      
        if (userId) {
        completedIds = await fetchCompletions(userId);
        progressInfo = await fetchProgressData();
        
        // IMPORTANT: Filter completions to only include active question IDs
        // This prevents showing completed questions that no longer exist or are inactive
        const activeQuestionIds = new Set(activeQuestions.map(q => q.id));
        const filteredCompletedIds = new Set(
          Array.from(completedIds).filter(id => activeQuestionIds.has(id))
        );
        completedIds = filteredCompletedIds;
      }
      
      // Mark questions as completed (only for active questions)
        const questionsWithCompletion = activeQuestions.map((q) => ({
          ...q,
          completed: completedIds.has(q.id),
        }));

        // Sort questions by ID to maintain consistent order
        questionsWithCompletion.sort((a, b) => a.id - b.id);

        setAllQuestions(questionsWithCompletion);
      setCompletedQuestions(completedIds);
      
      // Calculate progress based ONLY on active questions
      const total = activeQuestions.length;
      const completed = questionsWithCompletion.filter(q => q.completed).length;
      
      // Use progress info from API if available and consistent
      if (progressInfo && progressInfo.total === total) {
        setProgressData(progressInfo);
      } else {
        // Otherwise use our calculated values
        setProgressData({ completed, total });
      }
      
        // Organize questions by module_level
        organizeModules(questionsWithCompletion, completedIds);
      } catch (error) {
        console.error("Error fetching data:", error);
        setOrganizedModules([]);
      toast({
        title: "Error Loading Data",
        description: "Failed to load questions. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      } finally {
        setIsLoading(false);
      }
    }, [technologyId, userId, fetchCompletions, fetchProgressData, toast]);

  // Initial data fetch only
  useEffect(() => {
    if (isInitialMount.current && userId) {
      isInitialMount.current = false;
      fetchAllData();
    }
  }, [userId, fetchAllData]);

  // Function to organize modules
  const organizeModules = useCallback((
    questions: Question[],
    completedIds: Set<number>
  ) => {
    const levels = Array.from(new Set(questions.map((q) => q.module_level)))
      .filter((level) => level)
      .sort((a, b) => {
        const order = { beginner: 1, basic: 2, intermediate: 3, advanced: 4 };
        return (
          (order[a.toLowerCase() as keyof typeof order] || 99) -
          (order[b.toLowerCase() as keyof typeof order] || 99)
        );
      });

    const newModules: Module[] = levels.map((level, index) => {
      const levelQuestions = questions.filter((q) => q.module_level === level);
      const completedCount = levelQuestions.filter((q) =>
        completedIds.has(q.id)
      ).length;

      return {
        id: `module-${index + 1}`,
        name: `${level.charAt(0).toUpperCase() + level.slice(1)} Level`,
        level: level,
        questionCount: levelQuestions.length,
        completedCount: completedCount,
        questions: levelQuestions.map((q) => ({
          ...q,
          completed: completedIds.has(q.id),
        })),
      };
    });

    // Add a "All Questions" module
    const allCompletedCount = questions.filter((q) =>
      completedIds.has(q.id)
    ).length;

    newModules.unshift({
      id: "all-questions",
      name: "All Questions",
      level: "all",
      questionCount: questions.length,
      completedCount: allCompletedCount,
      questions: questions.map((q) => ({
        ...q,
        completed: completedIds.has(q.id),
      })),
    });

    setOrganizedModules(newModules);
    if (!selectedModule && newModules.length > 0) {
      setSelectedModule(newModules[0].id);
    }
  }, [selectedModule]);

  // Load notes when module changes
  useEffect(() => {
    const loadNotes = async () => {
      if (selectedModule && technologyName && userId) {
        try {
          // First check if we have notes in the database
          const progressResponseData = await getProgress().unwrap();
          const progressResults = progressResponseData.results || [];
          const techProgress = progressResults.find(
            (p: any) => p.technologyId === technologyId
          );

          let notesToLoad: LearningNote[] = [];

          if (techProgress?.user_notes) {
            try {
              // Try to parse as JSON first
              const parsedNotes = JSON.parse(techProgress.user_notes);

              if (Array.isArray(parsedNotes)) {
                // It's a JSON array of notes
                const moduleNotes = parsedNotes.filter(
                  (note: LearningNote) =>
                    note.moduleId === selectedModule &&
                    note.technologyId === technologyName.toLowerCase()
                );

                if (moduleNotes.length > 0) {
                  notesToLoad = moduleNotes;
                }
              } else {
                // It might be a single URL string (legacy format)
                // Convert it to a LearningNote object
                const legacyNote: LearningNote = {
                  id: 'legacy-' + Date.now(),
                  userId: userId,
                  technologyId: technologyName.toLowerCase(),
                  moduleId: selectedModule,
                  url: techProgress.user_notes,
                  title: 'Legacy Google Doc',
                  addedAt: new Date().toISOString(),
                  type: 'document'
                };

                notesToLoad = [legacyNote];
              }
            } catch (parseError) {

              const legacyNote: LearningNote = {
                id: 'legacy-' + Date.now(),
                userId: userId,
                technologyId: technologyName.toLowerCase(),
                moduleId: selectedModule,
                url: techProgress.user_notes,
                title: 'Google Doc from Database',
                addedAt: new Date().toISOString(),
                type: 'document'
              };

              notesToLoad = [legacyNote];
            }
          }

          // If no notes from database, check local storage
          if (notesToLoad.length === 0) {
            notesToLoad = getNotes(userId, technologyName.toLowerCase(), selectedModule);
          }

          setNotes(notesToLoad);
          setSelectedNoteId(notesToLoad[0]?.id ?? null);

        } catch (error) {
          console.error("Error loading notes:", error);
          const loaded = getNotes(userId, technologyName.toLowerCase(), selectedModule);
          setNotes(loaded);
          setSelectedNoteId(loaded[0]?.id ?? null);
        }
      }
    };

    loadNotes();
  }, [selectedModule, technologyName, userId, technologyId, getProgress]);

  const currentModule = organizedModules.find((m) => m.id === selectedModule);

  // Calculate progress based ONLY on current active questions
  // This ensures we never show more completed than total questions
  const totalQuestions = progressData?.total || organizedModules.reduce((acc, m) => acc + m.questionCount, 0);
  const totalCompleted = Math.min(
    progressData?.completed || organizedModules.reduce((acc, m) => acc + m.completedCount, 0),
    totalQuestions // Cap completed at total questions
  );
  const overallProgress = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

const triggerCompletionEmail = async (latestProgress: { completed: number; total: number }) => {
  const emailKey = `email_sent_${technologyId}`;
  try {
    const user = tokenStorage.getUser<{ name?: string }>();
    const candidateName = user?.name || "Candidate";

    const pdfBlob = await generateCertificatePDF({
      candidateName,
      assessmentTitle: technologyName,
      scoreDisplay: `${latestProgress.completed}/${latestProgress.total}`,
      percentageValue: 100,
      completionDate: new Date().toLocaleDateString(),
      assessmentType: "normal",
      totalQuestions: latestProgress.total,
      returnBlob: true,
    });

    if (!(pdfBlob instanceof Blob)) {
      emailSentRef.current = false;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      try {
        await sendCourseCompleteEmail({
          technology_name: technologyName,
          score_display: `${latestProgress.completed}/${latestProgress.total}`,
          percentage: 100,
          completion_date: new Date().toLocaleDateString(),
          pdf_base64: base64data,
        }).unwrap();

        localStorage.setItem(emailKey, "true");
        toast({
          title: "🎉 Course Completed!",
          description: "Certificate has been emailed to you.",
          variant: "success",
          duration: 5000,
        });
      } catch (err) {
        console.error("Email send failed:", err);
        emailSentRef.current = false;
        localStorage.removeItem(emailKey);
      }
    };
    reader.readAsDataURL(pdfBlob);
  } catch (err) {
    console.error("PDF generation failed:", err);
    emailSentRef.current = false;
  }
};

  const downloadCertificate = async () => {
  const user = tokenStorage.getUser<{ name?: string }>();
  const candidateName = user?.name || "Candidate";

  // PDF generate (existing logic)
  const pdfBlob = await generateCertificatePDF({
    candidateName,
    assessmentTitle: technologyName,
    scoreDisplay: `${totalCompleted}/${totalQuestions}`,
    percentageValue: overallProgress,
    completionDate: new Date().toLocaleDateString(),
    assessmentType: "normal",
    totalQuestions,
    returnBlob: true, // Ensure we get a Blob back
  });

  // Local download (existing behavior)
  if (!(pdfBlob instanceof Blob)) return;{
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Certificate_${technologyName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  
  }
};
  const handleAddLink = async () => {
    if (!newLink.trim() || !selectedModule || !technologyName || !userId) return;

    // Add to local storage first
    const created: LearningNote = {
      id: `note-${Date.now()}`,
      userId: userId,
      technologyId: technologyName.toLowerCase(),
      moduleId: selectedModule,
      url: newLink.trim(),
      title: 'Google Doc',
      addedAt: new Date().toISOString(),
      type: 'document'
    };

    // Update local state
    const updatedNotes = [...notes, created];
    setNotes(updatedNotes);

    // Prepare ALL notes for this technology
    const allTechNotes: LearningNote[] = [...updatedNotes];

    // Prepare payload - stringify the array of notes
    const payload = {
      user_notes: JSON.stringify(allTechNotes)
    };

    // API call to update database
    try {
      await completeModule({
        url: `/api/progress/${technologyId}/submit-notes/`,
        data: payload,
      }).unwrap();

      toast({
        title: "Note Added",
        description: "Your note has been saved to the database",
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error submitting notes to database:", error);

      toast({
        title: "Saving Note Failed",
        description: "Note saved locally but failed to sync with server",
        variant: "destructive",
        duration: 3000,
      });
    }

    setNewLink("");
    setSelectedNoteId(created.id);
  };
  const handleDeleteLink = async (id: string) => {
    deleteNote(id);
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    if (selectedNoteId === id) setSelectedNoteId(updated[0]?.id ?? null);
    try {
      const progressResponseData = await getProgress().unwrap();
      const progressResults = progressResponseData.results || [];
      const techProgress = progressResults.find(
        (p: any) => p.technologyId === technologyId
      );

      if (techProgress?.user_notes) {
        const existingNotes = JSON.parse(techProgress.user_notes);
        // Remove the deleted note
        const filteredNotes = existingNotes.filter(
          (note: LearningNote) =>
            !(note.id === id &&
              note.moduleId === selectedModule &&
              note.technologyId === technologyName.toLowerCase())
        );

        const payload = {
          user_notes: JSON.stringify(filteredNotes)
        };

        await completeModule({
          url: `/api/progress/${technologyId}/submit-notes/`,
          data: payload,
        }).unwrap();
      }
    } catch (error) {
      console.error("Error syncing deletion with database:", error);
    }
  };

  // Function to mark question as completed
  const handleMarkComplete = async (questionId: string) => {
    if (!userId) {
      toast({
        title: "Authentication Required",
        description: "Please login to mark questions as completed",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const questionIdNum = parseInt(questionId);
    
    if (pendingCompletionRef.current === questionIdNum) {
      return;
    }
    
    if (completedQuestions.has(questionIdNum)) {
      toast({
        title: "Already Completed",
        description: "This question has already been marked as completed.",
        variant: "default",
        duration: 2000,
      });
      return;
    }
    
    setIsMarkingComplete(questionIdNum);
    pendingCompletionRef.current = questionIdNum;

    try {
      await createCompletion({
        questionId: questionIdNum,
        userID: userId,
      }).unwrap();

        const newCompleted = new Set(completedQuestions);
        newCompleted.add(questionIdNum);
        setCompletedQuestions(newCompleted);

        if (userId && completionsCache.current.has(userId)) {
        const cachedSet = completionsCache.current.get(userId)!;
        cachedSet.add(questionIdNum);
      }
        const updatedAllQuestions = allQuestions.map((q) =>
          q.id === questionIdNum ? { ...q, completed: true } : q
        );
        setAllQuestions(updatedAllQuestions);

        // Update progress data, ensuring we don't exceed total
        if (progressData) {
            const newCompletedCount = Math.min(progressData.completed + 1, progressData.total);
            const newProgressData = {          // ✅ pehle variable banao
              ...progressData,
              completed: newCompletedCount,
            };
            setProgressData(newProgressData);  // ✅ sirf ek baar

            if (newCompletedCount === progressData.total) {
              const emailKey = `email_sent_${technologyId}`;
              if (!emailSentRef.current && !localStorage.getItem(emailKey)) {
                emailSentRef.current = true;
                triggerCompletionEmail(newProgressData);  // ✅ ab exist karta hai
              }
            }
      } else {
        const total = totalQuestions;
        const completed = Math.min(totalCompleted + 1, total);
        setProgressData({ completed, total });
        }

        // Reorganize modules with updated completion status
        organizeModules(updatedAllQuestions, newCompleted);

        toast({
          title: "Question Marked as Completed",
          description: "Great job! Keep learning!",
          variant: "success",
          duration: 2000,
        });
    } catch (error: any) {
      console.error("Error marking question as completed:", error);

      if (error.status === 409) {
        const newCompleted = new Set(completedQuestions);
        newCompleted.add(questionIdNum);
        setCompletedQuestions(newCompleted);
        if (userId && completionsCache.current.has(userId)) {
          const cachedSet = completionsCache.current.get(userId)!;
          cachedSet.add(questionIdNum);
        }

        const updatedAllQuestions = allQuestions.map((q) =>
          q.id === questionIdNum ? { ...q, completed: true } : q
        );
        setAllQuestions(updatedAllQuestions);
        organizeModules(updatedAllQuestions, newCompleted);
        
        if (progressData) {
          const newCompletedCount = Math.min(progressData.completed + 1, progressData.total);
          setProgressData({
            ...progressData,
            completed: newCompletedCount,
          });
        }

        toast({
          title: "Question Already Completed",
          description: "This question was already marked as completed.",
          variant: "default",
          duration: 2000,
        });
      } else {
        toast({
          title: "Failed to Mark Question",
          description: error.data?.message || "Please try again",
          variant: "destructive",
          duration: 3000,
        });
      }
    } finally {
      setIsMarkingComplete(null);
      setTimeout(() => {
        pendingCompletionRef.current = null;
      }, 500);
    }
  };

  // Function to check if question is completed
  const isQuestionCompleted = (questionId: number) => {
    return completedQuestions.has(questionId);
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case "video":
        return Video;
      case "audio":
        return Music;
      case "document":
        return FileText;
      case "github":
        return Github;
      case "api":
        return CodeIcon;
      default:
        return LinkIcon;
    }
  };

  const getMaterialColor = (type: string) => {
    switch (type) {
      case "video":
        return "text-red-500";
      case "audio":
        return "text-purple-500";
      case "document":
        return "text-blue-500";
      case "github":
        return "text-gray-700";
      case "api":
        return "text-green-500";
      default:
        return "text-orange-500";
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy":
        return "bg-green-100 text-green-800 border-green-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "hard":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "beginner":
        return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100";
      case "basic":
        return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100";
      case "advanced":
        return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100";
      case "unknown":
        return "bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100";
      default:
        return "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-100";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1600px] mx-auto p-8">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-slate-600">
                Loading questions for {technologyName}...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!technologyId || organizedModules.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-[1600px] mx-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 mb-1">
                {technologyName}
              </h1>
              <p className="text-xs text-slate-600">No questions available</p>
            </div>
            {onBack && (
              <Button
                variant="ghost"
                onClick={onBack}
                className="flex items-center gap-1.5 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Progress
              </Button>
            )}
          </div>
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-8 text-center">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-800 mb-2">
                No Questions Found
              </h3>
              <p className="text-slate-600 mb-4">
                There are no questions available for {technologyName} yet.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-xl font-semibold text-slate-800 mb-1">
                {technologyName}
              </h1>
              <p className="text-xs text-slate-600">
                Complete modules, practice skills, and advance your career
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={downloadCertificate}
                disabled={overallProgress !== 100}
                className="flex items-center gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Download Certificate
              </Button>
              {onBack && (
                <button
                  title="Back to progress"
                  onClick={onBack}
                  className="flex items-center justify-center w-7 h-7 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
          {/* Module Sidebar */}
          <Card className="lg:col-span-1 h-fit sticky top-4 bg-white border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Course Modules
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 p-4 pt-0">
                  {organizedModules.map((module, index) => {
                    const progress =
                      module.questionCount > 0
                        ? Math.round(
                          (module.completedCount / module.questionCount) * 100
                        )
                        : 0;
                    const isSelected = selectedModule === module.id;

                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModule(module.id)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${isSelected
                          ? "bg-blue-50 border border-blue-200 shadow-sm"
                          : "bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-0.5">
                            {progress === 100 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                                {module.id === "all-questions"
                                  ? "ALL"
                                  : `LEVEL ${index}`}
                              </span>
                              <Badge
                                className={`text-[10px] h-4 ${getLevelColor(
                                  module.level
                                )}`}
                              >
                                {module.level}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-sm mb-2 text-slate-800 leading-tight">
                              {module.name}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                              <span>
                                {module.completedCount}/{module.questionCount}{" "}
                                questions
                              </span>
                            </div>
                            <Progress
                              value={progress}
                              className="h-1.5 bg-slate-200"
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Questions + Study Materials + Notes Content */}
          <Card className="lg:col-span-3 sticky top-4 bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {currentModule?.name}
                  </CardTitle>
                  <p className="text-xs text-slate-600">
                    Click on any question to reveal the answer
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-4">
                  <div className="flex items-center gap-2 w-48">
                    <Progress
                      value={overallProgress}
                      className="h-2 flex-1 bg-slate-200"
                    />
                    <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                      {overallProgress}% Complete
                    </span>
                  </div>

                  <Badge
                    variant="secondary"
                    className="text-xs bg-blue-100 text-blue-800"
                  >
                    {totalCompleted}/{totalQuestions} Questions
                  </Badge>
                </div>

              </div>
            </CardHeader>
            <CardContent>
              {currentModule?.questions.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-slate-800 mb-1">
                    No Questions Available
                  </h3>
                  <p className="text-xs text-slate-500">
                    There are no questions in this module yet.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[600px] border-t border-blue-200 pt-4">
                  <Accordion type="single" collapsible className="space-y-3">
                    {currentModule?.questions.map((q, index) => {
                      const isCompleted = isQuestionCompleted(q.id);

                      return (
                        <AccordionItem
                          key={q.id}
                          value={q.id.toString()}
                          className="border border-slate-200 rounded-lg bg-white hover:shadow-sm transition-all"
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-slate-50/50 text-sm">
                            <div className="flex items-center gap-3 w-full">
                              <div className="flex-shrink-0">
                                {isCompleted ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Circle className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                              <div className="text-left flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                                    QUESTION {index + 1}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-4 ${getDifficultyColor(
                                      q.difficulty
                                    )}`}
                                  >
                                    {q.difficulty}
                                  </Badge>
                                  {!q.is_active && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-4 bg-gray-100 text-gray-700 border-gray-200"
                                    >
                                      Inactive
                                    </Badge>
                                  )}
                                </div>
                                <div
                                   className="font-medium text-slate-800 text-sm leading-relaxed prose max-w-none"
                                   dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.question) }}
                                />
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-3">
                              {/* Answer Section */}
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                <p className="text-xs font-semibold text-blue-600 mb-2">
                                  Answer:
                                </p>
                                <div
                                  className="text-sm text-slate-700 leading-relaxed prose max-w-none"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.answer) }}
                               />
                              </div>

                              {/* Additional Information */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {q.reference_link && (
                                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                    <p className="text-xs font-semibold text-blue-600 mb-1">
                                      Reference Link:
                                    </p>
                                    <a
                                      href={q.reference_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Open Reference
                                    </a>
                                  </div>
                                )}

                                {q.task_description && (
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                    <p className="text-xs font-semibold text-green-600 mb-1">
                                      Task Description:
                                    </p>
                                    <div
                                      className="text-xs text-slate-700 prose max-w-none"
                                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(q.task_description) }}
                                   />
                                  </div>
                                )}
                              </div>

                              {!isCompleted ? (
                                <Button
                                  onClick={() =>
                                    handleMarkComplete(q.id.toString())
                                  }
                                  disabled={
                                    isMarkingComplete === q.id || !q.is_active
                                  }
                                  className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 h-auto text-xs"
                                  size="sm"
                                >
                                  {isMarkingComplete === q.id ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                      Marking...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                      {q.is_active
                                        ? "Mark as Completed"
                                        : "Inactive Question"}
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <div className="mt-2 flex items-center gap-1.5 text-green-700 text-xs">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>You have completed this question</span>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>
              )}

              {/* Study Materials Section */}
              {currentModule?.studyMaterials &&
                currentModule.studyMaterials.length > 0 && (
                  <div className="mt-6 border-t border-slate-200 pt-6">
                    <h2 className="flex items-center text-sm font-semibold mb-3 text-slate-800">
                      <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
                      Study Material
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {currentModule.studyMaterials.map((material) => {
                        const Icon = getMaterialIcon(material.type);
                        const colorClass = getMaterialColor(material.type);

                        return (
                          <a
                            key={material.id}
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-blue-300 transition-all group"
                          >
                            <div
                              className={`flex-shrink-0 p-1.5 rounded bg-slate-100 ${colorClass}`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-medium text-sm text-slate-800 truncate">
                                  {material.title}
                                </h4>
                                <ExternalLink className="h-3 w-3 text-slate-500 group-hover:text-blue-600 flex-shrink-0" />
                              </div>
                              {material.description && (
                                <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                                  {material.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] capitalize bg-slate-100 text-slate-700"
                                >
                                  {material.type}
                                </Badge>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Learning Notes Section */}
              <div className="mt-6 border-t border-slate-200 pt-6">
                <h3 className="text-sm font-semibold mb-3 text-slate-800">
                  My Learning Notes
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <div className="space-y-3">
                      <div>
                        <Label
                          htmlFor="noteLink"
                          className="text-xs font-medium text-slate-700"
                        >
                          Add Google Docs/Drive link
                        </Label>
                        <div
                          className={`flex gap-1.5 mt-1 ${overallProgress !== 100 ? "cursor-not-allowed" : ""
                            }`}
                        >
                          <Input
                            id="noteLink"
                            placeholder="Paste share link"
                            value={newLink}
                            onChange={(e) => setNewLink(e.target.value)}
                            className="text-sm h-8"
                          />
                          <Button
                            type="button"
                            onClick={handleAddLink}
                            disabled={overallProgress !== 100}
                            className={`shrink-0 h-8 px-2.5 text-white
                                ${overallProgress === 100
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-gray-700"}
                              `}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                          </Button>

                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Use a shareable link with Anyone with the link →
                          Viewer.
                        </p>
                      </div>

                      <div className="border border-slate-200 rounded-md p-2 max-h-60 overflow-auto bg-white">
                        {notes.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-4">
                            No notes yet.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {notes.map((n) => (
                              <li
                                key={n.id}
                                className={`p-2 rounded border text-sm cursor-pointer transition-all ${selectedNoteId === n.id
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-white border-slate-200 hover:bg-slate-50"
                                  }`}
                                onClick={() => setSelectedNoteId(n.id)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-slate-800 text-xs">
                                    {n.title || n.url}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 hover:bg-red-50 hover:text-red-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteLink(n.id);
                                    }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">
                                  {new Date(n.addedAt).toLocaleString()}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    {selectedNoteId ? (
                      <div className="aspect-video w-full border border-slate-200 rounded-md overflow-hidden bg-slate-50">
                        <iframe
                          key={selectedNoteId}
                          src={toEmbeddableUrl(
                            notes.find((n) => n.id === selectedNoteId)!.url
                          )}
                          className="w-full h-full"
                          allow="autoplay; clipboard-write; encrypted-media;"
                          title="Learning Notes"
                        />
                      </div>
                    ) : (
                      <div className="h-48 flex items-center justify-center border border-slate-200 rounded-md bg-slate-50/50">
                        <p className="text-xs text-slate-500">
                          Select a note to preview here
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ModuleView;
