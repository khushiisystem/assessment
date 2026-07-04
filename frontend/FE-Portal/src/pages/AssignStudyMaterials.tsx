import React, { useState, useEffect, useCallback, useMemo, useRef, } from "react";
import { useParams, useNavigate } from "react-router-dom";
// import { Search, CheckCircle, Square, CheckSquare, X, BookOpen, Loader2, ArrowLeft, Info, Users } from "lucide-react";
import { Search, CheckCircle, Square, CheckSquare, X, BookOpen, Loader2, ArrowLeft, Info, Users, Calendar, Edit2, Check } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { BTN_PRIMARY, LABEL_SM_CLASS, SUBSECTION_TITLE } from "@/lib/uiStyles";
import {
  useLazyGetTechnologyByIdQuery,
  useLazyGetCandidateDetailsQuery,
  useGetTechnologiesQuery,
  useCreateAssignmentMutation,
  useLazyGetCandidatesQuery,
  useUpdateAssignmentDueDateMutation,
} from "@/store";

interface User {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  profile: string;
  date_joined: string;
  resume_s3_url: string;
  learning_assignments: LearningAssignment[];
}

interface Technology {
  id: string;
  name: string;
  category: string;
  description: string;
}

interface LearningAssignment {
  assignment_id: number;
  technology_id: string;
  technology_name: string;
  progress: number;
  due_at: string | null;
  notes?: string;
}

interface Candidate {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  phone: string;
  profile: string;
  learning_assignments: LearningAssignment[];
}

const DueDateCell = ({ candidate, technologyId, onSaved }: {
  candidate: Candidate;
  technologyId: string;
  onSaved: (candidateId: number, assignmentId: number, newDueAt: string) => void;
}) => {
  const { toast } = useToast();
  const [updateDueDate] = useUpdateAssignmentDueDateMutation();

  const assignment = candidate.learning_assignments?.find(
    (a) => String(a.technology_id) === String(technologyId)
  );

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    assignment?.due_at ? new Date(assignment.due_at).toISOString().slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  if (!assignment) return null;

  const handleSave = async () => {
    if (!value) {
      toast({ title: "Due date required", variant: "destructive", duration: 2500 });
      return;
    }
    try {
      setSaving(true);
      const result = await updateDueDate({
        assignmentId: assignment.assignment_id,
        due_at: new Date(value).toISOString(),
      }).unwrap();

      onSaved(candidate.id, assignment.assignment_id, result.due_at ?? new Date(value).toISOString());
      setEditing(false);
      toast({ title: "Due date updated", variant: "success", duration: 2000 });
    } catch (e: any) {
      toast({ title: "Error", description: e?.data?.detail || "Failed to update", variant: "destructive", duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
        <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
        <span className="text-[10px] text-slate-500">
          {assignment.due_at
            ? new Date(assignment.due_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
            : "No due date"}
        </span>
        <button onClick={() => setEditing(true)} className="ml-1 text-brand-violet hover:text-brand-purple" title="Edit due date">
          <Edit2 className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="text-[10px] border border-slate-200 rounded-lg bg-white px-1 py-0.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/40"
      />
      {saving ? (
        <Loader2 className="w-3 h-3 animate-spin text-brand-violet" />
      ) : (
        <>
          <button onClick={handleSave} className="text-green-600 hover:text-green-800" title="Save">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setEditing(false)} className="text-red-500 hover:text-red-700" title="Cancel">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
};

const AssignStudyMaterials = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [getTechnologyById] = useLazyGetTechnologyByIdQuery();
  const [getCandidateDetails] = useLazyGetCandidateDetailsQuery();
  // ✅ Declare these FIRST before the query
const [searchTerm, setSearchTerm] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
}, [searchTerm]);

// ✅ Now query can use debouncedSearch safely
  const { data: techQueryData, isLoading: techQueryLoading } = useGetTechnologiesQuery({
      search: debouncedSearch,
      page: 1,
  });
  const [createAssignment] = useCreateAssignmentMutation();
  const [getCandidates] = useLazyGetCandidatesQuery();

  const [user, setUser] = useState<any>(null);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<Technology[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isLoadingTech, setIsLoadingTech] = useState(false);
  const [preSelectedTech, setPreSelectedTech] = useState<Technology | null>(null);

  // For bulk assignment
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const searchTimeoutRef = useRef<number | null>(null);
  const lastScrollPositionRef = useRef(0);
  const [isUpdateMode, setIsUpdateMode] = useState(false);
  const [updateDueDate] = useUpdateAssignmentDueDateMutation();
  const [bulkUpdateDate, setBulkUpdateDate] = useState("");
  const [selectedAssignedUsers, setSelectedAssignedUsers] = useState<Set<number>>(new Set());
  const removedAssignedUsersRef = useRef<Set<number>>(new Set());
  const [selectedAssignedCandidates, setSelectedAssignedCandidates] = useState<Candidate[]>([]);

  const handleDueDateSaved = useCallback(
  (candidateId: number, assignmentId: number, newDueAt: string) => {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== candidateId) return c;
        return {
          ...c,
          learning_assignments: c.learning_assignments.map((a) =>
            a.assignment_id === assignmentId ? { ...a, due_at: newDueAt } : a
          ),
        };
      })
    );
  },
  []
);


const handleBulkUpdateDueDate = async () => {
  if (!bulkUpdateDate) {
    toast({ title: "Due date required", variant: "destructive", duration: 2500 });
    return;
  }

  // User mode
  if (isUserMode) {
    if (selectedAssignedCandidates.length === 0) {
      toast({ title: "No courses selected", variant: "destructive", duration: 2500 });
      return;
    }
    try {
      const isoDate = new Date(bulkUpdateDate).toISOString();
      const allAssignments = user?.candidate?.learning_assignments || user?.learning_assignments || [];
      const promises = selectedAssignedCandidates.map(item => {
        // item yahan tech object hai jo humne selectedAssignedCandidates mein store kiya
        const assignment = allAssignments.find(
          (a: any) => String(a.technology_id) === String((item as any).technology_id)
        );
        if (!assignment) return Promise.resolve();
        return updateDueDate({
          assignmentId: assignment.assignment_id,
          due_at: isoDate,
        }).unwrap().then(() => {
          setUser((prev: any) => {
            const updateAssignments = (assignments: any[]) =>
              assignments.map((a: any) =>
                a.assignment_id === assignment.assignment_id ? { ...a, due_at: isoDate } : a
              );
            if (prev?.candidate) {
              return { ...prev, candidate: { ...prev.candidate, learning_assignments: updateAssignments(prev.candidate.learning_assignments || []) } };
            }
            return { ...prev, learning_assignments: updateAssignments(prev.learning_assignments || []) };
          });
        });
      });
      await Promise.all(promises);
      toast({ title: "Success", description: `Due date updated for ${selectedAssignedCandidates.length} course(s)`, variant: "success", duration: 2000 });
      setSelectedAssignedCandidates([]);
      setBulkUpdateDate("");
    } catch (e: any) {
      toast({ title: "Error", description: e?.data?.detail || "Failed to update", variant: "destructive", duration: 3000 });
    }
    return;
  }

  // Technology mode (existing logic)
  if (selectedAssignedUsers.size === 0) {
    toast({ title: "No candidates selected", variant: "destructive", duration: 2500 });
    return;
  }
  try {
    const isoDate = new Date(bulkUpdateDate).toISOString();
    const promises = Array.from(selectedAssignedUsers).map(candidateId => {
      const candidate = candidates.find(c => c.id === candidateId);
      const assignment = candidate?.learning_assignments?.find(
        a => String(a.technology_id) === String(preSelectedTech?.id)
      );
      if (!assignment) return Promise.resolve();
      return updateDueDate({ assignmentId: assignment.assignment_id, due_at: isoDate })
        .unwrap()
        .then(() => handleDueDateSaved(candidateId, assignment.assignment_id, isoDate));
    });
    await Promise.all(promises);
    toast({ title: "Success", description: `Due date updated for ${selectedAssignedUsers.size} candidate(s)`, variant: "success", duration: 2000 });
    setSelectedAssignedUsers(new Set());
    setBulkUpdateDate("");
  } catch (e: any) {
    toast({ title: "Error", description: e?.data?.detail || "Failed to update", variant: "destructive", duration: 3000 });
  }
};

  // Determine if ID is UUID (technology) or numeric (user)
  const isTechnologyMode = useMemo(() => {
    if (!id) return false;
    // UUID pattern check
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id);
  }, [id]);

  // Check if ID is numeric (user)
  const isUserMode = useMemo(() => {
    if (!id) return false;
    return /^\d+$/.test(id);
  }, [id]);

  useEffect(() => {
    if (!isUpdateMode) {
      setSelectedAssignedUsers(new Set());
      setSelectedAssignedCandidates([]);
      removedAssignedUsersRef.current = new Set();
    }
  }, [isUpdateMode]);

  useEffect(() => {
    if (!isUpdateMode || !isTechnologyMode || !preSelectedTech) return;

    const newlyAssigned = candidates
      .filter(c => isAlreadyAssigned(c, preSelectedTech.id))
      .filter(c => !removedAssignedUsersRef.current.has(c.id));

    if (newlyAssigned.length === 0) return;

    setSelectedAssignedUsers(prev => new Set([...prev, ...newlyAssigned.map(c => c.id)]));
    
    // Store full candidate objects so they persist across search changes
    setSelectedAssignedCandidates(prev => {
      const existingIds = new Set(prev.map(c => c.id));
      const toAdd = newlyAssigned.filter(c => !existingIds.has(c.id));
      return [...prev, ...toAdd];
    });
  }, [candidates, isUpdateMode, isTechnologyMode, preSelectedTech]);

  // Fetch technology details if ID is a technology UUID
  const fetchTechnologyDetails = useCallback(async () => {
    if (!id || !isTechnologyMode) return;

    try {
      setIsLoadingTech(true);
      const techData = await getTechnologyById((id)).unwrap();
      setPreSelectedTech(techData);
      // Pre-select this technology
      setSelectedTechnologies([techData]);
    } catch (error: any) {
      console.error("Error fetching technology details:", error);
      toast({
        title: "Failed",
        description: "Failed to load technology details",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsLoadingTech(false);
    }
  }, [id, isTechnologyMode, toast]);

  // Fetch user details (for numeric ID mode)
  const fetchUserDetails = useCallback(async () => {
    if (!id || !isUserMode) return;

    try {
      setIsLoadingUser(true);
      const data = await getCandidateDetails(Number(id)).unwrap();
      setUser(data);
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      toast({
        title: "Failed",
        description: "Failed to load candidate details",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsLoadingUser(false);
    }
  }, [id, isUserMode, toast]);

  // Sync technologies from auto-fetch query
  useEffect(() => {
    if (techQueryData?.results) {
      setTechnologies(techQueryData.results);
    }
  }, [techQueryData]);

  // Fetch candidates for bulk assignment (Technology mode)
  const fetchCandidates = useCallback(async (url?: string, search?: string, isLoadMore: boolean = false) => {
    if (isLoadingRef.current || !isTechnologyMode) return;

    isLoadingRef.current = true;

    if (isLoadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoadingCandidates(true);
    }

    try {
      let endpoint = url || "/my-admin/candidates/";

      if (search !== undefined && !url) {
        endpoint = "/my-admin/candidates/";
        const params = new URLSearchParams();
        params.append('search', search);
        endpoint += `?${params.toString()}`;
      }

      const data = await getCandidates(endpoint).unwrap();

      // If it's a search or initial load, replace the list
      if (!url || search !== undefined) {
        setCandidates(data.results?.candidates || []);
      } else {
        // For load more, append to existing list
        setCandidates(prev => [...prev, ...(data.results?.candidates || [])]);
      }

      setNextPage(data.next);
      setHasMore(!!data.next);
    } catch (error) {
      console.error("Error fetching candidates:", error);
      toast({
        title: "Error",
        description: "Failed to load candidates. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoadingCandidates(false);
      setIsFetchingMore(false);
      isLoadingRef.current = false;
    }
  }, [isTechnologyMode, toast]);

  // Check if candidate already has this technology assigned (for Technology mode)
  const isAlreadyAssigned = useCallback((candidate: Candidate, technologyId: string) => {
    return candidate.learning_assignments?.some(
      (assignment: any) => assignment.technology_id === technologyId
    );
  }, []);

  // Format candidate name
  const formatCandidateName = useCallback((candidate: Candidate) => {
    return `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || candidate.username || 'Unnamed';
  }, []);

  // Calculate overall progress
  const calculateOverallProgress = useCallback((candidate: Candidate) => {
    const assignments = candidate.learning_assignments || [];
    if (assignments.length === 0) return 0;

    const totalProgress = assignments.reduce((sum: number, assignment: any) => {
      return sum + (assignment.progress || 0);
    }, 0);

    return Math.round(totalProgress / assignments.length);
  }, []);

  // Initial data fetch
  useEffect(() => {
    const initData = async () => {
      if (isTechnologyMode) {
        // For technology mode: fetch technology details
        await fetchTechnologyDetails();
        // DO NOT fetch candidates here - it will be handled by the separate useEffect
      } else if (isUserMode) {
        // For user mode: fetch user details (technologies are auto-fetched via useGetTechnologiesQuery)
        await fetchUserDetails();
      }
    };

    initData();
  }, [fetchUserDetails, fetchTechnologyDetails, isTechnologyMode, isUserMode]);

  // Handle scroll for infinite loading (Technology mode)
  useEffect(() => {
    if (!isTechnologyMode) return;

    const container = scrollContainerRef.current;
    if (!container || !hasMore || isLoadingCandidates || isFetchingMore || searchQuery) return;

    const handleScroll = () => {
      if (isLoadingCandidates || isFetchingMore || !hasMore || !nextPage) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const scrollPosition = scrollTop + clientHeight;

      // Load more when user is 80% from the bottom
      if (scrollPosition >= scrollHeight * 0.8) {
        // Save current scroll position
        lastScrollPositionRef.current = scrollTop;

        if (nextPage) {
          fetchCandidates(nextPage, undefined, true);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingCandidates, isFetchingMore, nextPage, fetchCandidates, searchQuery, isTechnologyMode]);

  // Handle search with debouncing (Technology mode)
  useEffect(() => {
    if (!isTechnologyMode) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (searchQuery.trim() === "") {
        setCandidates([]);
        setNextPage(null);
        setHasMore(true);
        fetchCandidates("/my-admin/candidates/");
      } else {
        setCandidates([]);
        setNextPage(null);
        setHasMore(false);
        fetchCandidates(undefined, searchQuery.trim());
      }
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, fetchCandidates, isTechnologyMode]);

  // Handle technology selection (for user mode only)
  const toggleTechnologySelection = useCallback((technology: Technology) => {
    if (!isUserMode) return;

    // Check if already assigned to the user
    if (user?.candidate?.learning_assignments?.some((assignment: any) => String(assignment.technology_id) === String(technology.id))) {
      toast({
        title: "Already Assigned",
        description: "This course is already assigned to the candidate.",
        variant: "default",
        duration: 3000,
      });
      return;
    }

    setSelectedTechnologies(prev => {
      const isSelected = prev.some(t => t.id === technology.id);
      if (isSelected) {
        return prev.filter(t => t.id !== technology.id);
      } else {
        return [...prev, technology];
      }
    });
  }, [user, toast, isUserMode]);

  // Handle user selection (Technology mode only)
  const toggleUserSelection = useCallback((candidateId: number) => {
    if (!isTechnologyMode || !preSelectedTech) return;

    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;

    // Check if candidate already has this technology assigned
    if (isAlreadyAssigned(candidate, preSelectedTech.id)) {
      toast({
        title: "Already Assigned",
        description: "This candidate already has this technology assigned.",
        variant: "default",
        duration: 3000,
      });
      return;
    }

    setSelectedUsers((prev) => {
      const newSelection = new Set(prev);
      if (newSelection.has(candidateId)) {
        newSelection.delete(candidateId);
      } else {
        newSelection.add(candidateId);
      }
      return newSelection;
    });
  }, [candidates, isAlreadyAssigned, toast, isTechnologyMode, preSelectedTech]);

  // Clear selected technologies
  const clearSelection = useCallback(() => {
    setSelectedTechnologies([]);
  }, []);

  // Clear all
  const handleClearAll = () => {
    if (isTechnologyMode) {
      setSelectedUsers(new Set());
    } else {
      setSelectedTechnologies([]);
    }
    setDueDate("");
    setNotes("");
    setSearchQuery("");
  };

  // Assign study materials
  const assignStudyMaterials = async () => {
    // First check: selected technologies (for user mode) or pre-selected tech (for tech mode)
    if ((isUserMode && selectedTechnologies.length === 0) ||
      (isTechnologyMode && !preSelectedTech)) {
      toast({
        title: "Failed",
        description: "Please select at least one course",
        variant: "destructive",
        duration: 3000
      });
      return;
    }

    // Second check: due date
    if (!dueDate) {
      toast({
        title: "Due Date Required",
        description: "Please select a due date before assigning the material.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Third check: for Technology mode, selected users
    if (isTechnologyMode && selectedUsers.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select at least one user to assign the material.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      setIsAssigning(true);

      if (isTechnologyMode && preSelectedTech) {
        // Technology mode: Bulk assign to multiple users
        const currentUser = { id: 1 }; // Replace with actual user from token storage
        const assignedBy = currentUser.id;
        const formattedDate = new Date(dueDate).toISOString();

        const assignmentPromises: Promise<any>[] = [];

        // For each selected user, assign the pre-selected technology
        Array.from(selectedUsers).forEach(userId => {
          const payload = {
            userId: userId,
            technologyId: preSelectedTech.id,
            assignedBy: assignedBy,
            due_at: formattedDate,
            notes: notes || "Assigned complete course"
          };

          assignmentPromises.push(createAssignment(payload).unwrap());
        });

        await Promise.all(assignmentPromises);

        toast({
          title: "Success",
          description: `${preSelectedTech.name} assigned to ${selectedUsers.size} user(s) successfully!`,
          duration: 1000,
          variant: "success"
        });

      } else if (isUserMode) {
        // User mode: Assign selected technologies to single user
        if (!user) return;

        const assignmentPromises = selectedTechnologies.map(tech =>
          createAssignment({
            userId: user.id || user.candidate?.id,
            technologyId: tech.id,
            assignedBy: 1,
            due_at: new Date(dueDate).toISOString(),
            notes: notes || "Assigned complete course"
          }).unwrap()
        );

        await Promise.all(assignmentPromises);

        toast({
          title: "Success",
          description: `${selectedTechnologies.length} course(s) assigned successfully!`,
          duration: 1000,
          variant: "success"
        });
      }

      // Navigate back
      setTimeout(() => {
        // @ts-ignore
        navigate(-1, { state: { refresh: true } });
      }, 1005);

    } catch (e: any) {
      console.error("Assignment error:", e.data || e.message);

      let errorMessage = "Failed to assign study materials";
      if (e.data && Array.isArray(e.data)) {
        const firstError = e.data[0];
        if (firstError === "This course is already assigned to the user.") {
          errorMessage = "This course is already assigned to the user";
        } else {
          errorMessage = firstError;
        }
      } else if (e.data && typeof e.data === 'string') {
        errorMessage = e.data;
      } else if (e.data && typeof e.data === 'object') {
        const errorValues = Object.values(e.data).flat();
        errorMessage = String(errorValues[0] || errorMessage);
      }

      toast({
        title: "Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsAssigning(false);
    }
  };

 const filteredTechnologies = isUserMode ? technologies : [];


  // Filter candidates based on search query (Technology mode)
  const filteredCandidates = useMemo(() => {
    if (!isTechnologyMode) return [];

    return candidates.filter((candidate) => {
      if (!searchQuery.trim()) return true;

      const query = searchQuery.toLowerCase();
      return (
        formatCandidateName(candidate).toLowerCase().includes(query) ||
        candidate.email.toLowerCase().includes(query) ||
        candidate.profile?.toLowerCase().includes(query) ||
        candidate.phone?.includes(query)
      );
    });
  }, [candidates, searchQuery, formatCandidateName, isTechnologyMode]);

  // Format date for minimum attribute
  const getMinDate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  // Get page title based on mode
  const getPageTitle = () => {
    if (isTechnologyMode && preSelectedTech) {
      return `Assign ${preSelectedTech.name} to Candidates`;
    } else if (isUserMode && user) {
      const userName = user?.candidate?.first_name
        ? `${user.candidate.first_name} ${user.candidate.last_name}`
        : `${user?.first_name} ${user?.last_name}`;
      return `Assign Course to ${userName}`;
    }
    return "Course Assignment";
  };

  const getSubtitle = () => {
    if (isTechnologyMode) {
      if (preSelectedTech) {
        return `Select candidates to assign ${preSelectedTech.name}`;
      }
      return "Technology Assignment";
    } else if (isUserMode) {
      const userName = user?.candidate?.first_name
        ? `${user.candidate.first_name} ${user.candidate.last_name}`
        : `${user?.first_name} ${user?.last_name}`;
      return `Assign Course to ${userName}`;
    }
    return "Course Assignment";
  };

  if (isLoadingUser && isUserMode) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet mx-auto mb-4"></div>
            <p className="text-sm text-slate-600">Loading candidate details...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (isLoadingTech && isTechnologyMode) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-violet mx-auto mb-4"></div>
            <p className="text-sm text-slate-600">Loading technology details...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if ((isUserMode && !user) || (isTechnologyMode && !preSelectedTech)) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-slate-800 mb-2">
              {isUserMode ? "Candidate" : "Technology"} not found
            </p>
            <button
              onClick={() =>
                // @ts-ignore
                navigate(-1, { state: { refresh: true } })}
              className={BTN_PRIMARY}
            >
              Back
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-9xl mx-auto">
          <PageHeader
            title={getPageTitle()}
            description={getSubtitle()}
            className="mb-6"
            actions={
              <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                title="Back"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Selection */}
            <div className="lg:col-span-2 space-y-8">
              {/* Technology Selection Card (User mode only) */}
              {isUserMode && (
                <Card className="text-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          Select Courses
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Choose course to assign for learning
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input
                            placeholder="Search courses..."
                            className="pl-8 w-56 text-xs h-7"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-2">
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
                      {isLoading ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-6 h-6 text-brand-violet animate-spin mx-auto mb-2" />
                          <p className="text-xs text-slate-600">Loading technologies...</p>
                        </div>
                      ) : filteredTechnologies.length === 0 ? (
                        <div className="text-center py-6">
                          {searchTerm.trim() ? (
                            <>
                              <Search className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                              <h3 className="text-sm font-medium text-slate-900 mb-1">
                                No technologies found for "{searchTerm}"
                              </h3>
                              <p className="text-xs text-slate-500">Try a different search term</p>
                            </>
                          ) : (
                            <>
                              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                              <h3 className="text-sm font-medium text-slate-900 mb-1">
                                No technologies available
                              </h3>
                              <p className="text-xs text-slate-500">Add technologies to get started</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredTechnologies.map((tech) => {
                            const isAlreadyAssignedToUser = user?.candidate?.learning_assignments?.some(
                              (assignment: any) => String(assignment.technology_id) === String(tech.id)
                            );
                            const isSelected = selectedTechnologies.some(t => t.id === tech.id);

                            return (
                              <div
                                key={tech.id}
                                className={`border rounded-lg p-2 mb-1 transition-all ${
                                  isUpdateMode
                                    ? isAlreadyAssignedToUser
                                      ? "border-green-200 bg-green-50 cursor-pointer hover:border-green-400"
                                      : "border-slate-100 bg-slate-50 opacity-30 cursor-not-allowed pointer-events-none"
                                    : isSelected
                                      ? "border-brand-violet bg-violet-50 cursor-pointer"
                                      : isAlreadyAssignedToUser
                                        ? "border-green-200 bg-green-50 opacity-80 cursor-not-allowed"
                                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                                }`}
                                onClick={() => {
                                  if (isUpdateMode) {
                                    if (!isAlreadyAssignedToUser) return;
                                    const allAssignments = user?.candidate?.learning_assignments || user?.learning_assignments || [];
                                    const assignment = allAssignments.find((a: any) => String(a.technology_id) === String(tech.id));
                                    if (!assignment) return;
                                    setSelectedAssignedCandidates(prev => {
                                      const exists = prev.some((c: any) => String(c.technology_id) === String(tech.id));
                                      if (exists) return prev.filter((c: any) => String(c.technology_id) !== String(tech.id));
                                      return [...prev, assignment];
                                    });
                                    return;
                                  }
                                  if (!isAlreadyAssignedToUser) toggleTechnologySelection(tech);
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 mt-px">
                                    {isAlreadyAssignedToUser && isUpdateMode ? (
                                      selectedAssignedCandidates.some((c: any) => String(c.technology_id) === String(tech.id))
                                        ? <CheckSquare className="w-4 h-4 text-brand-violet" />
                                        : <Square className="w-4 h-4 text-green-500" />
                                    ) : isAlreadyAssignedToUser ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-brand-violet" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                      <TechnologyIcon name={tech.name} size={14} />
                                      <h4 className="text-xs font-medium text-slate-800">
                                        {tech.name}
                                      </h4>
                                      {isAlreadyAssignedToUser && (
                                        <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded-full">
                                          Assigned
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">
                                      {tech.category}
                                    </p>
                                    
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t px-4 py-2 text-xs">
                    <div className="flex items-center justify-between w-full">
                      <div className="text-slate-600">
                        {selectedTechnologies.length} course(s) selected out of {technologies.length} total
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              )}

              {/* Candidate Selection Card (Technology mode only) */}
              {isTechnologyMode && (
                <Card className="text-xs">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <Users className="w-4 h-4" />
                          Select Candidates
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                          Choose candidates to assign the selected course
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                          <Input
                            placeholder="Search by name or email..."
                            className="pl-8 w-60 text-xs h-7"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery("")}
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-2">
                    <div
                      ref={scrollContainerRef}
                      className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto"
                    >
                      {isLoadingCandidates && !isFetchingMore ? (
                        <div className="text-center py-4">
                          <Loader2 className="w-6 h-6 text-brand-violet animate-spin mx-auto mb-2" />
                          <p className="text-xs text-slate-600">Loading candidates...</p>
                        </div>
                      ) : filteredCandidates.length === 0 ? (
                        <div className="text-center py-6">
                          {searchQuery.trim() ? (
                            <>
                              <Search className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                              <h3 className="text-sm font-medium text-slate-900 mb-1">
                                No candidates found for "{searchQuery}"
                              </h3>
                              <p className="text-xs text-slate-500">Try a different search term</p>
                            </>
                          ) : (
                            <>
                              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                              <h3 className="text-sm font-medium text-slate-900 mb-1">
                                No candidates available
                              </h3>
                              <p className="text-xs text-slate-500">No candidates found</p>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredCandidates.map((candidate) => {
                            const selected = selectedUsers.has(candidate.id);
                            const alreadyAssigned = preSelectedTech ? isAlreadyAssigned(candidate, preSelectedTech.id) : false;

                            return (
                              <div
                                key={candidate.id}
                                className={`border rounded-lg p-2 mb-1 transition-all ${
                                  isUpdateMode && !alreadyAssigned
                                    ? "border-slate-100 bg-slate-50 opacity-30 cursor-not-allowed"
                                    : selected
                                      ? "border-brand-violet bg-violet-50 cursor-pointer"
                                      : alreadyAssigned && isUpdateMode && removedAssignedUsersRef.current.has(candidate.id)
                                        ? "border-slate-200 bg-slate-50 opacity-50 cursor-pointer"
                                        : alreadyAssigned && isUpdateMode
                                          ? "border-green-200 bg-green-50 cursor-pointer hover:border-green-400"
                                          : alreadyAssigned
                                            ? "border-green-200 bg-green-50 opacity-80 cursor-not-allowed"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                                }`}
                                onClick={() => {
                                  if (isUpdateMode && alreadyAssigned) {
                                    if (removedAssignedUsersRef.current.has(candidate.id)) {
                                      // Add back
                                      removedAssignedUsersRef.current = new Set(
                                        [...removedAssignedUsersRef.current].filter(id => id !== candidate.id)
                                      );
                                      setSelectedAssignedUsers(prev => new Set([...prev, candidate.id]));
                                      setSelectedAssignedCandidates(prev => {
                                        if (prev.some(c => c.id === candidate.id)) return prev;
                                        return [...prev, candidate];
                                      });
                                    } else {
                                      // Remove
                                      removedAssignedUsersRef.current = new Set([...removedAssignedUsersRef.current, candidate.id]);
                                      setSelectedAssignedUsers(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(candidate.id);
                                        return newSet;
                                      });
                                      setSelectedAssignedCandidates(prev => prev.filter(c => c.id !== candidate.id));
                                    }
                                    return;
                                  }
                                  // Block non-assigned in update mode
                                  if (isUpdateMode && !alreadyAssigned) return;
                                  if (!alreadyAssigned) toggleUserSelection(candidate.id);
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="flex-shrink-0 mt-px">
                                    {alreadyAssigned ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : selected ? (
                                      <CheckSquare className="w-4 h-4 text-brand-violet" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1">
                                      <h4 className="text-xs font-medium text-slate-800">
                                        {formatCandidateName(candidate)}
                                      </h4>
                                      {alreadyAssigned && (
                                        <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded-full">
                                          Already Assigned
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                      {candidate.email}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[10px] text-slate-600">
                                        Progress: {calculateOverallProgress(candidate)}%
                                      </span>
                                      <span className="text-[10px] text-slate-600">
                                        • {candidate.learning_assignments?.length || 0} assignments
                                      </span>
                                    </div>
                                
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {isFetchingMore && (
                            <div className="text-center py-2">
                              <Loader2 className="w-4 h-4 text-brand-violet animate-spin mx-auto" />
                            </div>
                          )}
                          {hasMore && !isFetchingMore && (
                            <div className="text-center py-2 text-xs text-slate-500">
                              Scroll down to load more candidates
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="border-t px-4 py-2 text-xs">
                    <div className="flex items-center justify-between w-full">
                      <div className="text-slate-600">
                        {selectedUsers.size} candidate(s) selected
                      </div>
                    </div>
                  </CardFooter>
                </Card>
              )}
            </div>

            {/* Right Column - Assignment Details */}
            <div className="space-y-2">

              {/* Action Buttons */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
                <div className="flex flex-row items-center justify-end gap-2">
                  {/* Update button - DONO modes ke liye */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsUpdateMode(!isUpdateMode);
                      setSelectedAssignedUsers(new Set());
                      setSelectedAssignedCandidates([]);
                      setBulkUpdateDate("");
                      removedAssignedUsersRef.current = new Set();
                    }}
                    className={`text-xs px-2.5 h-8 font-semibold border rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap ${
                      isUpdateMode
                        ? "border-brand-violet bg-violet-50 text-brand-violet"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{isUpdateMode ? "Back" : "Update"}</span>
                  </button>
                  {!isUpdateMode && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-xs px-2.5 h-8 font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 shadow-sm hover:bg-slate-50 transition-all duration-200 flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <X className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Clear All</span>
                    </button>
                  )}
                  {!isUpdateMode && (
                    <button
                      type="button"
                      onClick={assignStudyMaterials}
                      disabled={
                        isAssigning ||
                        (isTechnologyMode && selectedUsers.size === 0) ||
                        (isUserMode && selectedTechnologies.length === 0)
                      }
                      className="text-xs px-2.5 h-8 font-semibold transition-all duration-300 bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg shadow-sm hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      {isAssigning ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          <span>Assigning...</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>
                            {isTechnologyMode ? `Assign (${selectedUsers.size})` : `Assign (${selectedTechnologies.length})`}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                  {isUpdateMode && (
                    <button
                      type="button"
                      onClick={handleBulkUpdateDueDate}
                      disabled={
                        isTechnologyMode
                          ? selectedAssignedUsers.size === 0
                          : selectedAssignedCandidates.length === 0
                      }
                      className="text-xs px-2.5 h-8 font-semibold transition-all duration-300 bg-gradient-to-r from-brand-purple to-brand-violet text-white rounded-lg shadow-sm hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-1 whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Update ({isTechnologyMode ? selectedAssignedUsers.size : selectedAssignedCandidates.length})
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
                <div className="p-4">
                  <div className="space-y-3">
                    <h2 className={`${SUBSECTION_TITLE} mb-3 flex items-center gap-1`}>
                      <Info className="w-3.5 h-3.5 text-green-600" />
                      {isUpdateMode ? "Update course due date" : "Assignment Details"}
                    </h2>

                    <div className="space-y-4">
                      {/* Course display - always show in technology mode */}
                      {isTechnologyMode && preSelectedTech && (
                        <div>
                          <Label className={LABEL_SM_CLASS}>
                            Course to Assign
                          </Label>
                          <div className="border border-violet-200 bg-violet-50 rounded-lg p-2">
                            <div className="flex items-center gap-2">
                              <TechnologyIcon name={preSelectedTech.name} size={14} />
                              <span className="text-xs font-medium">{preSelectedTech.name}</span>
                              <span className="text-[10px] bg-violet-100 text-brand-violet px-1.5 py-0.5 rounded">
                                {preSelectedTech.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Due Date - shared for both modes */}
                      <div>
                        <Label className={LABEL_SM_CLASS}>
                          Due Date <span className="text-red-500">*</span>
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">
                            {isUpdateMode ? "(for selected candidates)" : "(for new assignments)"}
                          </span>
                        </Label>
                        <Input
                          type="datetime-local"
                          value={isUpdateMode ? bulkUpdateDate : dueDate}
                          onChange={(e) => isUpdateMode ? setBulkUpdateDate(e.target.value) : setDueDate(e.target.value)}
                          min={getMinDate()}
                          className="w-full text-xs h-8"
                          required
                        />
                        {!isUpdateMode && !dueDate && (
                          <p className="text-xs text-red-500 mt-1">Please select a due date</p>
                        )}
                      </div>

                      {/* UPDATE MODE — Already assigned candidates list */}
                      {isUpdateMode && isTechnologyMode && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="block text-xs font-semibold text-slate-700">
                              Selected Candidates ({selectedAssignedCandidates.length})
                            </Label>
                            {selectedAssignedCandidates.length > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedAssignedUsers(new Set());
                                  setSelectedAssignedCandidates([]);
                                  removedAssignedUsersRef.current = new Set(
                                    [...removedAssignedUsersRef.current, 
                                    ...selectedAssignedCandidates.map(c => c.id)]
                                  );
                                }}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Clear selection
                              </button>
                            )}
                          </div>

                          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                            {selectedAssignedCandidates.length === 0 ? (
                              <p className="text-xs text-slate-500 text-center py-2">No candidates assigned yet</p>
                            ) : (
                              selectedAssignedCandidates.map(candidate => {
                                const assignment = candidate.learning_assignments?.find(
                                  a => String(a.technology_id) === String(preSelectedTech?.id)
                                );
                                return (
                                  <div
                                    key={candidate.id}
                                    className="flex items-center justify-between py-1 px-1.5 rounded-lg text-xs"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate font-medium">{formatCandidateName(candidate)}</p>
                                      {assignment?.due_at && (
                                        <p className="text-[10px] text-slate-400 truncate">
                                          Current: {new Date(assignment.due_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removedAssignedUsersRef.current = new Set([...removedAssignedUsersRef.current, candidate.id]);
                                        setSelectedAssignedUsers(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(candidate.id);
                                          return newSet;
                                        });
                                        setSelectedAssignedCandidates(prev => prev.filter(c => c.id !== candidate.id));
                                      }}
                                      className="text-red-600 hover:text-red-800 flex-shrink-0 ml-2 text-xs"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}

                      {/* UPDATE MODE — User mode assigned courses list */}
                      {isUpdateMode && isUserMode && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="block text-xs font-semibold text-slate-700">
                              Selected Courses ({selectedAssignedCandidates.length})
                            </Label>
                            {selectedAssignedCandidates.length > 0 && (
                              <button
                                onClick={() => setSelectedAssignedCandidates([])}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Clear selection
                              </button>
                            )}
                          </div>
                          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                            {(() => {
                              const allAssignments = user?.candidate?.learning_assignments || user?.learning_assignments || [];
                              return selectedAssignedCandidates.length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-2">
                                  No courses selected
                                </p>
                              ) : (
                                selectedAssignedCandidates.map((assignment: any) => {
                                  return (
                                    <div
                                      key={assignment.assignment_id}
                                      className="flex items-center justify-between py-1 px-1.5 rounded-lg text-xs border border-slate-200 mb-1"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-slate-700">
                                          {assignment.technology_name}
                                        </p>
                                        {assignment.due_at && (
                                          <p className="text-[10px] text-slate-400 truncate">
                                            Current: {new Date(assignment.due_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                                          </p>
                                        )}
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAssignedCandidates(prev =>
                                            prev.filter((c: any) => String(c.technology_id) !== String(assignment.technology_id))
                                          );
                                        }}
                                        className="text-red-600 hover:text-red-800 flex-shrink-0 ml-2 text-xs"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  );
                                })
                              );

                            })()}
                          </div>
                        </div>
                      )}

                      {/* ASSIGN MODE — Selected new candidates */}
                      {!isUpdateMode && isTechnologyMode && selectedUsers.size > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="block text-xs font-semibold text-slate-700">
                              Selected Candidates ({selectedUsers.size})
                            </Label>
                            {selectedUsers.size > 0 && (
                              <button
                                onClick={() => setSelectedUsers(new Set())}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Clear selection
                              </button>
                            )}
                          </div>
                          <div className="max-h-24 overflow-y-auto border border-slate-200 rounded-lg p-2">
                            {Array.from(selectedUsers).map(userId => {
                              const candidate = candidates.find(c => c.id === userId);
                              if (!candidate) return null;
                              return (
                                <div key={userId} className="flex items-center justify-between py-1 text-xs">
                                  <span className="truncate">{formatCandidateName(candidate)}</span>
                                  <button
                                    onClick={() => setSelectedUsers(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(userId);
                                      return newSet;
                                    })}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selected Technologies (User mode) */}
                      {isUserMode && !isUpdateMode && selectedTechnologies.length > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <Label className="block text-xs font-semibold text-slate-700">
                              Selected Courses ({selectedTechnologies.length})
                            </Label>
                            {selectedTechnologies.length > 0 && (
                              <button
                                onClick={clearSelection}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                          <div className="max-h-24 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
                            {selectedTechnologies.map((tech) => (
                              <div key={tech.id} className="flex items-center justify-between py-1 text-xs">
                                <span className="text-slate-700 truncate">{tech.name}</span>
                                <button
                                  onClick={() => toggleTechnologySelection(tech)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isUpdateMode && (
                        <div>
                          <Label className={LABEL_SM_CLASS}>
                            Notes (Optional)
                          </Label>
                          <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add instructions or notes for the candidate..."
                            className="w-full text-xs min-h-[80px]"
                          />
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AssignStudyMaterials;
