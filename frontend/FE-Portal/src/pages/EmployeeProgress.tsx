import { useState, useMemo, useEffect } from "react";

import {
  BookOpen,
  Play,
  ArrowRight,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";
import ModuleView from "@/pages/userpages/ModuleView";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useGetProfileQuery } from "@/store/api/authApi";
import { useGetProgressQuery, useGetTechnologiesQuery } from "@/store/api/technologiesApi";
import { formatAssignedDate } from "@/utils/commonFunctions";
import { tokenStorage } from "@/lib/tokenStorage";

interface TechnologyProgress {
  technologyId: string;
  name: string;
  progress: number;
  completed: number;
  total: number;
}

interface LearningAssignment {
  assignment_id: number;
  technology_id: string;
  technology_name: string;
  assigned_at: string;
  due_at: string | null;
  notes: string | null;
  is_self_unlocked?: boolean;
  progress?: number;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_individual: boolean;
  learning_assignments: LearningAssignment[];
}

interface Technology {
  id: string;
  name: string;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface EmployeeTechnology {
  id: string;
  name: string;
  progress: number;
  completed: number;
  total: number;
  assigned_at: string;
  due_at: string | null;
  isLocked?: boolean;
}

const EmployeeProgress = () => {

  const [currentSubscription, setCurrentSubscription] = useState<{ plan_name: string; plan_type: string; is_active: boolean; end_date: string | null } | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();       
const selectedTech = searchParams.get("course"); 
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useGetProfileQuery();
  const { data: progressRaw, isLoading: progressLoading, refetch: refetchProgress } = useGetProgressQuery();
  const { data: techData, isLoading: techLoading } = useGetTechnologiesQuery({ page_size: 100 });
  

  

  // Fetch subscription status for individual users
    useEffect(() => {

    setCurrentSubscription({
      plan_name: 'Free Tier',
      plan_type: 'free',
      is_active: true,
      end_date: null
    });
  }, []);

    // Auto-refresh when user comes back to tab (after admin unassign)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetchProfile();
        refetchProgress();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refetchProfile, refetchProgress]);

  

  const isLoading = profileLoading || progressLoading || techLoading;
  const userProfile = (profileData as UserProfile) || null;
  const isPaid = currentSubscription && currentSubscription.plan_type !== 'free' && currentSubscription.is_active;
  const FREE_UNLOCK_LIMIT = 5;

  // Only count incomplete self-unlocked courses (progress < 100)
  const unlockedCount = userProfile?.learning_assignments?.filter(a => {
    const progress = a.progress || 0;
    return a.is_self_unlocked && progress < 100;
}).length || 0;

  const [unlockingId, setUnlockingId] = useState<string | null>(null);
  const technologyProgress = useMemo<TechnologyProgress[]>(
    () => progressRaw?.results || [],
    [progressRaw]
  );
  const allTechnologies = useMemo<Technology[]>(() => techData?.results || [], [techData]);

  /** Merge assignments + progress into a single tech list. */
  const techs = useMemo<EmployeeTechnology[]>(() => {
  if (!userProfile) return [];

  // INDIVIDUAL CANDIDATE
  if (userProfile.is_individual) {
    // Get assigned technology IDs from learning_assignments
    const assignedIds = new Set(
      (userProfile.learning_assignments || []).map(a => a.technology_id)
    );
    
    return allTechnologies.map((tech) => {
      const p = technologyProgress.find((t) => t.technologyId === tech.id);
      return {
        id: tech.id,
        name: tech.name,
        progress: p?.progress ?? 0,
        completed: p?.completed ?? 0,
        total: p?.total ?? 0,
        assigned_at: tech.created_at,
        due_at: null,
        isLocked: isPaid ? false : !assignedIds.has(tech.id),
      };
    });
  }

  // ORG CANDIDATE: existing behavior (unchanged)
  return (userProfile.learning_assignments || []).map((assignment) => {
    const p = technologyProgress.find(
      (t) => t.technologyId === assignment.technology_id
    );
    return {
      id: assignment.technology_id,
      name: assignment.technology_name,
      progress: p?.progress ?? 0,
      completed: p?.completed ?? 0,
      total: p?.total ?? 0,
      assigned_at: assignment.assigned_at,
      due_at: assignment.due_at,
      isLocked: false,
    };
  });
}, [userProfile, technologyProgress, allTechnologies, isPaid]);

  /** "Pick up where you left off" — highest in-progress tech. */
  const topInProgress = useMemo(() => {
    const inProgress = techs.filter((t) => t.progress > 0 && t.progress < 100);
    if (!inProgress.length) return null;
    return inProgress.reduce((a, b) => (a.progress >= b.progress ? a : b));
  }, [techs]);

  /** Paths due within the next 7 days. */
  const daysUntil = (iso: string | null) => {
    if (!iso) return null;
    return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  };
  const urgentDeadlines = useMemo(() => {
    return techs
      .map((t) => ({ tech: t, days: daysUntil(t.due_at) }))
      .filter((x): x is { tech: EmployeeTechnology; days: number } => 
  x.days !== null && x.days <= 7 && x.tech.progress < 100
)
      .sort((a, b) => a.days - b.days);
  }, [techs]);

  const handleUnlock = async (techId: string) => {
    if (unlockingId) return;
    setUnlockingId(techId);
    try {
      const token = tokenStorage.getAccessToken();
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}api/technologies/unlock/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ technology_id: techId }),
      });
      if (res.ok) {
        await refetchProfile();
        await refetchProgress();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not unlock this technology.");
      }
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setUnlockingId(null);
    }
  };
  const handleTechClick = (techId: string) => {
  const tech = techs.find((t) => t.id === techId);
  if (tech?.isLocked) return;
  navigate(`/candidate/my-learning?course=${techId}`);
};

  const handleLock = async (techId: string) => {
  try {
    const token = tokenStorage.getAccessToken();
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}api/technologies/lock/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ technology_id: techId }),
    });
    if (res.ok) {
      await refetchProfile();
      await refetchProgress();
    }
  } catch {
    alert("Something went wrong.");
  }
};

  /* ----------------------------- Early returns ----------------------------- */

  if (selectedTech) {
    const tech = techs.find((t) => t.id === selectedTech);
    return (
      <ModuleView
        technologyId={selectedTech}
        technologyName={tech?.name || ""}
        onBack={() => {
          navigate("/candidate/my-learning");
          refetchProfile();
          refetchProgress();
          }}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-brand-violet" />
          <p className="text-sm text-slate-600">Loading your paths…</p>
        </div>
      </div>
    );
  }

  /* --------------------------------- Render --------------------------------- */

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <PageHeader
        icon={BookOpen}
        title="My Learning"
        description={
          techs.length === 0
            ? "No paths assigned yet"
            : `${techs.length} path${techs.length !== 1 ? "s" : ""} assigned`
        }
      />

      {userProfile?.is_individual && !isPaid && (
        <SurfaceCard className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              🔓 You can unlock up to <span className="font-bold text-brand-violet">{FREE_UNLOCK_LIMIT} courses</span> for learning
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2">
              <span className="text-lg font-bold text-brand-violet">{unlockedCount}</span>
              <span className="text-sm text-slate-500">/ {FREE_UNLOCK_LIMIT} unlocked</span>
            </div>
          </div>
        </SurfaceCard>
      )}

        {/* Urgent deadlines — only when something is actually due soon */}
        {urgentDeadlines.length > 0 && (
          <SurfaceCard className="p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <Clock className="h-4 w-4" />
              </span>
              <p className="text-xs font-semibold text-slate-700">
                {urgentDeadlines.length === 1 ? "Due soon" : `${urgentDeadlines.length} due soon`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {urgentDeadlines.slice(0, 4).map(({ tech, days }) => (
                  <button
                    key={tech.id}
                    type="button"
                    onClick={() => handleTechClick(tech.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                      days <= 2
                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    )}
                  >
                    {days <= 0 ? "Today" : `${days}d`} · {tech.name}
                  </button>
                ))}
              </div>
            </div>
          </SurfaceCard>
        )}

        {/* Pick up where you left off — single clear next action */}
        {topInProgress && (
          <SurfaceCard className="p-5">
            <button
              type="button"
              onClick={() => handleTechClick(topInProgress.id)}
              className="group flex w-full items-center gap-4 text-left"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-brand-violet">
                <TechnologyIcon name={topInProgress.name} className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-violet">
                  Pick up where you left off
                </p>
                <p className="mt-0.5 truncate text-lg font-bold text-slate-900">
                  {topInProgress.name}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-gradient-to-r from-brand-purple to-brand-violet"
                      style={{ width: `${Math.round(topInProgress.progress)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-slate-700">
                    {Math.round(topInProgress.progress)}%
                  </span>
                  <span className="text-xs text-slate-500">
                    · {topInProgress.completed}/{topInProgress.total} questions
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all group-hover:shadow-md group-hover:brightness-110">
                <Play className="h-4 w-4" />
                Continue
              </span>
            </button>
          </SurfaceCard>
        )}

        {/* All paths — the centerpiece */}
        <SurfaceCard className="p-5">
          {techs.length === 0 ? (
            <div className="py-12 text-center">
              <BookOpen className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">
                No paths assigned yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Contact your administrator to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
  {techs.map((tech) => {
    const progress = Math.round(tech.progress);
    const d = daysUntil(tech.due_at);
    const isDone = tech.progress >= 100;
    const dueChip = isDone
      ? { cls: "bg-emerald-50 text-emerald-700", text: "Completed" }
      : tech.due_at
        ? d !== null && d < 0
          ? { cls: "bg-rose-50 text-rose-700", text: "Expired" }
          : { cls: "bg-slate-100 text-slate-600", text: formatAssignedDate(tech.due_at) }
        : null;

    return (
      <div
        key={tech.id}
        onClick={() => !tech.isLocked && handleTechClick(tech.id)}
        className={cn(
          "group rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-brand-violet/40 hover:shadow-sm",
          tech.isLocked && "opacity-70",
          !tech.isLocked && "cursor-pointer"
        )}
      >
        {/* Header — Course Name + Action Button */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-brand-violet overflow-hidden">
              {tech.isLocked ? (
                <Lock className="h-4 w-4" />
              ) : (
                <div className="h-6 w-6 flex items-center justify-center">
                  <TechnologyIcon name={tech.name} className="h-5 w-5" />
                </div>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {tech.name}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {tech.isLocked
                  ? "Locked"
                  : `${tech.completed}/${tech.total} questions`}
              </p>
            </div>
          </div>

          {/* Action Button — Right side, next to course name */}
          {tech.isLocked ? (
            isPaid ? (
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                Pro required
              </span>
            ) : unlockedCount < FREE_UNLOCK_LIMIT ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnlock(tech.id);
                }}
                disabled={unlockingId === tech.id}
                className="shrink-0 rounded-lg bg-brand-violet px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-50"
              >
                {unlockingId === tech.id ? "..." : `Unlock (${unlockedCount}/${FREE_UNLOCK_LIMIT})`}
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                Limit reached
              </span>
            )
          ) : (
            // Unlocked — show due chip + unassign button
            <div className="flex items-center gap-2 shrink-0">
              {dueChip && (
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", dueChip.cls)}>
                  {dueChip.text}
                </span>
              )}
              {userProfile?.is_individual && !isPaid && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLock(tech.id);
                  }}
                  className="shrink-0 rounded-md bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-600 transition-colors hover:bg-rose-100"
                >
                  Unassign
                </button>
              )}
            </div>
          )}
        </div>

        {/* Progress Bar (only for unlocked courses) */}
        {!tech.isLocked && (
          <>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">{progress}%</span>
                <span className="text-slate-500">
                  {isDone
                    ? "Mastered"
                    : tech.progress > 0
                      ? "In progress"
                      : "Not started"}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    isDone
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-brand-purple to-brand-violet"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Footer: Assigned date + Continue link */}
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span>Assigned {formatAssignedDate(tech.assigned_at)}</span>
              <span className="inline-flex items-center gap-1 text-brand-violet opacity-0 transition-opacity group-hover:opacity-100">
                {tech.progress > 0 && tech.progress < 100
                  ? "Continue"
                  : tech.progress >= 100
                    ? "Review"
                    : "Start"}
                <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </>
        )}
      </div>
    );
  })}
</div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
};

export default EmployeeProgress;
