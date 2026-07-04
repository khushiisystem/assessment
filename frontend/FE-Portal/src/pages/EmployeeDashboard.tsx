import React, { useState, useMemo, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Flame,
  Sparkles,
  Layers,
  Trophy,
  Star,
  Target,
  TrendingUp,
  Clock,
  BookOpen,
  Zap,
  ArrowRight,
  Play,
  CheckCircle2,
  Crown,
  Rocket,
  FileText,
  BarChart3,
  Calendar,
  Award,
  Loader2,
  ChevronRight,
  ClipboardList,
  Lock,
} from "lucide-react";
import ModuleView from "@/pages/userpages/ModuleView";
import { TechnologyIcon } from "@/components/TechnologyIcon";
import { StatCard, type StatTone } from "@/components/dashboard/StatCard";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CARD_SHADOW } from "@/lib/uiStyles";
import { useGetProfileQuery } from "@/store/api/authApi";
import { useGetTechnologiesQuery, useGetProgressQuery } from "@/store/api/technologiesApi";
import { useGetAssessmentsQuery } from "@/store/api/assessmentsApi";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { formatAssignedDate, formatDate } from "@/utils/commonFunctions";
import {
  getBgColorForCategory,
  getBorderColorForCategory,
  getGradientForCategory,
  getIconForCategory,
  getLevelForCategory,
  getTextColorForCategory,
} from "@/utils/techUi";

interface Technology {
  id: string;
  name: string;
  category: string;
  description: string;
  created_at: string;
  updated_at: string;
}

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
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  profile: string;
  role: string;
  date_joined: string;
  resume_s3_url: string;
  is_individual: boolean;
  name: string;
  learning_assignments: LearningAssignment[];
}

interface DashboardStats {
  assigned: number;
  in_progress: number;
  completed: number;
  average_score: number;
  upcoming_assessments: any[];
  ai_summary: {
    assigned: number;
    in_progress: number;
    completed: number;
    average_score: number;
  };
}

interface EmployeeTechnology {
  id: string;
  name: string;
  progress: number;
  icon: any;
  level: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  questionCount: number;
  assigned_at: string;
  due_at: string | null;
  notes: string | null;
  category: string;
  completed: number;
  total: number;
isLocked?: boolean;
}

import { tokenStorage } from "@/lib/tokenStorage";

const EmployeeDashboard = () => {
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{ plan_name: string; plan_type: string; is_active: boolean; end_date: string | null } | null>(null);
  const [subUsage, setSubUsage] = useState<{ assessments_used: number; ai_interviews_used: number; assessments_limit: number; ai_interviews_limit: number } | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setSelectedTech(null);
  }, [location.key]);

  // Fetch subscription status for individual users
  useEffect(() => {
    const fetchSub = async () => {
      try {
        const token = tokenStorage.getAccessToken();
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}api/subscription/me/`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setCurrentSubscription(data.subscription);
          setSubUsage(data.usage);
        }
      } catch { /* silent */ }
    };
    fetchSub();
  }, []);

  // Auto-fetch queries — ALL hooks must be here, before any early returns
  const { data: profileData, isLoading: profileLoading } = useGetProfileQuery();
  const { data: techData, isLoading: techLoading } = useGetTechnologiesQuery({});
  const { data: progressRaw, isLoading: progressLoading } = useGetProgressQuery();
  // Derive data from query results early so we can use it in hook args
  const userProfile = (profileData as UserProfile) || null;
  const isPaid = currentSubscription && currentSubscription.plan_type !== 'free' && currentSubscription.is_active;
  // skipToken prevents the query from running until we know the user is individual.
  // This avoids a 401 → failed refresh → forceLogout() crash for org/admin users.
  const assessmentsArg = userProfile?.is_individual ? "/candidate/my-assessments/" : skipToken;
  const { data: assessmentsData, isLoading: assessmentsLoading } = useGetAssessmentsQuery(assessmentsArg as string);

  const isLoading = profileLoading || techLoading || progressLoading;

  // Derive data from query results
  const allTechnologies = useMemo<Technology[]>(() => techData?.results || [], [techData]);
  const technologyProgress = useMemo<TechnologyProgress[]>(() => progressRaw?.results || [], [progressRaw]);
  const assessments = useMemo<any[]>(() => {
    if (!assessmentsData) return [];
    const regular = (assessmentsData.assigned_assessments || []).map((a: any) => ({...a, is_ai: false}));
    const ai = (assessmentsData.ai_assigned_assessments || []).map((a: any) => ({...a, is_ai: true}));
    return [...regular, ...ai];
  }, [assessmentsData]);

  // Get user data from sessionStorage (fallback to location.state for backward compatibility)
  const userFromStorage = JSON.parse(sessionStorage.getItem("user") || "{}");
  const user = location.state?.user || userFromStorage;


// Derive employee technologies from profile + technologies + progress
  const employeeTechnologies = useMemo<EmployeeTechnology[]>(() => {
    if (!userProfile || !allTechnologies.length) return [];

    // INDIVIDUAL CANDIDATE: show ALL technologies, lock beyond free limit
    if (userProfile.is_individual) {
      const FREE_UNLOCK_LIMIT = 5;
      return allTechnologies.map((tech, index) => {
        const techProgress = technologyProgress.find((p) => p.technologyId === tech.id);
        const progress = techProgress ? techProgress.progress : 0;
        const completed = techProgress ? techProgress.completed : 0;
        const total = techProgress ? techProgress.total : 0;

        return {
          id: tech.id,
          name: tech.name,
          progress,
          icon: getIconForCategory(tech.category),
          level: getLevelForCategory(tech.category),
          color: getGradientForCategory(tech.category),
          bgColor: getBgColorForCategory(tech.category),
          textColor: getTextColorForCategory(tech.category),
          borderColor: getBorderColorForCategory(tech.category),
          questionCount: total,
          assigned_at: tech.created_at,
          due_at: null,
          notes: null,
          category: tech.category,
          completed,
          total,
          isLocked: isPaid ? false : index >= FREE_UNLOCK_LIMIT,
        };
      });
    }

    
    const mappedTechnologies: EmployeeTechnology[] = [];

    userProfile.learning_assignments?.forEach((assignment) => {
      const tech = allTechnologies.find(
        (t) => t.id === assignment.technology_id
      );
      const techProgress = technologyProgress.find(
        (p) => p.technologyId === assignment.technology_id
      );

      if (tech) {
        const progress = techProgress ? techProgress.progress : 0;
        const completed = techProgress ? techProgress.completed : 0;
        const total = techProgress ? techProgress.total : 0;

        const employeeTech: EmployeeTechnology = {
          id: tech.id,
          name: assignment.technology_name || tech.name,
          progress: progress,
          icon: getIconForCategory(tech.category),
          level: getLevelForCategory(tech.category),
          color: getGradientForCategory(tech.category),
          bgColor: getBgColorForCategory(tech.category),
          textColor: getTextColorForCategory(tech.category),
          borderColor: getBorderColorForCategory(tech.category),
          questionCount: total,
          assigned_at: assignment.assigned_at,
          due_at: assignment.due_at,
          notes: assignment.notes,
          category: tech.category,
          completed: completed,
          total: total,
          isLocked: false,
        };
        mappedTechnologies.push(employeeTech);
      }
    });

    return mappedTechnologies;
  }, [userProfile, allTechnologies, technologyProgress, isPaid]);

  // Derive dashboard stats
  const dashboardStats = useMemo<DashboardStats>(() => {
    const totalAssigned = userProfile?.learning_assignments?.length || 0;
    const totalCompleted = technologyProgress.reduce(
      (sum, tech) => sum + (tech.progress === 100 ? 1 : 0),
      0
    );
    const totalInProgress = technologyProgress.reduce(
      (sum, tech) =>
        sum + (tech.progress > 0 && tech.progress < 100 ? 1 : 0),
      0
    );
    const averageProgress =
      technologyProgress.length > 0
        ? technologyProgress.reduce((sum, tech) => sum + tech.progress, 0) /
        technologyProgress.length
        : 0;

    return {
      assigned: totalAssigned,
      in_progress: totalInProgress,
      completed: totalCompleted,
      average_score: Math.round(averageProgress),
      upcoming_assessments: [],
      ai_summary: {
        assigned: totalAssigned,
        in_progress: totalInProgress,
        completed: totalCompleted,
        average_score: Math.round(averageProgress),
      },
    };
  }, [userProfile, technologyProgress]);

  

  const filterProgress = (progress: number) => { return progress.toFixed(2) }

  // KPI cards — same shape Admin uses, so the candidate dashboard reads identically.
  const stats: Array<{
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    tone: StatTone;
    footnote?: string;
    suffix?: string;
    share?: number;
  }> = [
    {
      label: "Technologies",
      value: employeeTechnologies.length,
      icon: Layers,
      gradient: "from-brand-purple to-brand-violet",
      tone: "violet",
      footnote: employeeTechnologies.length > 0 ? "Assigned to you" : undefined,
    },
    {
      label: "In Progress",
      value: dashboardStats.in_progress,
      icon: BarChart3,
      gradient: "from-[#4338ca] to-[#6366f1]",
      tone: "indigo",
      footnote: dashboardStats.in_progress > 0 ? "Active assessments" : undefined,
    },
    {
      label: "Completed",
      value: dashboardStats.completed,
      icon: CheckCircle2,
      gradient: "from-[#0e9f6e] to-[#23c366]",
      tone: "emerald",
      footnote: dashboardStats.completed > 0 ? "Great progress" : undefined,
    },
    {
      label: "Avg Score",
      value: dashboardStats.average_score,
      suffix: "%",
      icon: Star,
      gradient: "from-[#c2790b] to-[#eab40b]",
      tone: "amber",
      share: dashboardStats.average_score,
    },
  ];

  const userName =
    user?.first_name || userProfile?.first_name || user?.name || "Candidate";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /* -------------------- Derived UX signals -------------------- */

  /** In-progress technologies sorted by progress (desc) — drives Up Next + Insights. */
  const activeTechnologies = useMemo(
    () => employeeTechnologies.filter((t) => t.progress > 0 && t.progress < 100),
    [employeeTechnologies]
  );

  /** Best & weakest in-progress paths — surfaces strengths and focus areas. */
  const topTech = useMemo(
    () =>
      activeTechnologies.length === 0
        ? null
        : activeTechnologies.reduce((a, b) => (a.progress >= b.progress ? a : b)),
    [activeTechnologies]
  );
  const focusTech = useMemo(
    () =>
      activeTechnologies.length === 0
        ? null
        : activeTechnologies.reduce((a, b) => (a.progress <= b.progress ? a : b)),
    [activeTechnologies]
  );

  /** Mastered (100%) paths — feeds the achievements panel. */
  const masteredTechs = useMemo(
    () => employeeTechnologies.filter((t) => t.progress >= 100),
    [employeeTechnologies]
  );

  /** Next assessment to action — first upcoming if any. */
  const nextAssessment = useMemo(() => {
    const list = dashboardStats.upcoming_assessments || [];
    return list.length > 0 ? list[0] : null;
  }, [dashboardStats]);

  /** Completion rate — % of assigned paths fully completed. */
  const completionRate = useMemo(() => {
    if (!employeeTechnologies.length) return 0;
    return Math.round((masteredTechs.length / employeeTechnologies.length) * 100);
  }, [masteredTechs, employeeTechnologies]);

  /** Derived achievements list — surfaces real milestones (not placeholder data). */
  const achievements = useMemo(() => {
    const list: {
      icon: React.ComponentType<{ className?: string }>;
      title: string;
      subtitle: string;
      tone: "violet" | "emerald" | "amber" | "indigo";
    }[] = [];
    if (dashboardStats.completed > 0) {
      list.push({
        icon: CheckCircle2,
        title: `${dashboardStats.completed} Assessment${dashboardStats.completed > 1 ? "s" : ""} Completed`,
        subtitle: "Consistent progress",
        tone: "emerald",
      });
    }
    if (masteredTechs.length > 0) {
      list.push({
        icon: Crown,
        title: `${masteredTechs.length} Path${masteredTechs.length > 1 ? "s" : ""} Mastered`,
        subtitle: masteredTechs.slice(0, 2).map((t) => t.name).join(", ") + (masteredTechs.length > 2 ? "…" : ""),
        tone: "violet",
      });
    }
    if (dashboardStats.average_score >= 90) {
      list.push({
        icon: Trophy,
        title: "Top Performer",
        subtitle: `${dashboardStats.average_score}% avg score`,
        tone: "amber",
      });
    } else if (dashboardStats.average_score >= 75) {
      list.push({
        icon: Star,
        title: "High Achiever",
        subtitle: `${dashboardStats.average_score}% avg score`,
        tone: "amber",
      });
    }
    if (employeeTechnologies.length >= 5) {
      list.push({
        icon: Layers,
        title: "Multi-Tracker",
        subtitle: `Learning ${employeeTechnologies.length} paths in parallel`,
        tone: "indigo",
      });
    }
    return list;
  }, [dashboardStats, employeeTechnologies, masteredTechs]);

  /** "Days remaining" helper for the assessments timeline. */
  const daysUntil = (iso: string | null) => {
    if (!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    return Math.ceil(ms / 86400000);
  };

  /** Composite Readiness Score — avg score (50%) + completion rate (30%) + engagement (20%). */
  const readinessScore = useMemo(() => {
    const scoreComponent = Math.min(dashboardStats.average_score || 0, 100);
    const completionComponent = completionRate;
    const engagementComponent =
      employeeTechnologies.length === 0
        ? 0
        : Math.round((activeTechnologies.length / employeeTechnologies.length) * 100);
    return Math.round(
      scoreComponent * 0.5 + completionComponent * 0.3 + engagementComponent * 0.2
    );
  }, [
    dashboardStats.average_score,
    completionRate,
    activeTechnologies.length,
    employeeTechnologies.length,
  ]);

  const readinessLabel =
    readinessScore >= 80
      ? "Interview Ready"
      : readinessScore >= 60
        ? "Building Momentum"
        : readinessScore >= 30
          ? "Foundation Stage"
          : "Just Getting Started";

  /** Skill proficiency buckets — drives the Skills Intelligence panel. */
  const skillGroups = useMemo(
    () => ({
      mastered: employeeTechnologies.filter((t) => t.progress >= 90),
      proficient: employeeTechnologies.filter((t) => t.progress >= 60 && t.progress < 90),
      developing: employeeTechnologies.filter((t) => t.progress >= 20 && t.progress < 60),
      beginner: employeeTechnologies.filter((t) => t.progress > 0 && t.progress < 20),
      notStarted: employeeTechnologies.filter((t) => t.progress === 0),
    }),
    [employeeTechnologies]
  );

  /** Learning Journey milestones — feeds the horizontal timeline. */
  const milestones = useMemo(() => {
    const startedCount = activeTechnologies.length + masteredTechs.length;
    const masteredCount = masteredTechs.length;
    const totalPaths = employeeTechnologies.length;
    return [
      {
        label: "Path Started",
        hint: startedCount > 0 ? `${startedCount} active` : "Begin a learning path",
        icon: Sparkles,
        done: startedCount > 0,
        current: startedCount === 0 && totalPaths > 0,
      },
      {
        label: "First Completion",
        hint:
          dashboardStats.completed > 0
            ? `${dashboardStats.completed} assessment${dashboardStats.completed !== 1 ? "s" : ""}`
            : "Complete your first assessment",
        icon: CheckCircle2,
        done: dashboardStats.completed > 0,
        current: startedCount > 0 && dashboardStats.completed === 0,
      },
      {
        label: "3 Paths Mastered",
        hint: masteredCount >= 3 ? "Achieved" : `${masteredCount}/3 mastered`,
        icon: Crown,
        done: masteredCount >= 3,
        current: dashboardStats.completed > 0 && masteredCount < 3,
      },
      {
        label: "Interview Ready",
        hint: readinessScore >= 80 ? "Ready" : `${readinessScore}/80`,
        icon: Trophy,
        done: readinessScore >= 80,
        current: masteredCount >= 3 && readinessScore < 80,
      },
    ];
  }, [
    activeTechnologies.length,
    masteredTechs,
    employeeTechnologies.length,
    dashboardStats.completed,
    readinessScore,
  ]);

  /** Closest deadline across paths + assessments. */
  const nearestDeadline = useMemo(() => {
    const items: { title: string; end_date: string; kind: "path" | "assessment" }[] = [];
    employeeTechnologies.forEach((t) => {
      if (t.due_at) items.push({ title: t.name, end_date: t.due_at, kind: "path" });
    });
    (dashboardStats.upcoming_assessments || []).forEach((a: any) => {
      if (a.end_date) items.push({ title: a.title, end_date: a.end_date, kind: "assessment" });
    });
    if (!items.length) return null;
    items.sort(
      (a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()
    );
    return items[0];
  }, [employeeTechnologies, dashboardStats.upcoming_assessments]);

  /** Estimated hours invested — proxy from completed questions × 5 min. */
  const estimatedHours = useMemo(() => {
    const totalCompletedQs = employeeTechnologies.reduce(
      (sum, t) => sum + (t.completed || 0),
      0
    );
    return Math.max(1, Math.round((totalCompletedQs * 5) / 60));
  }, [employeeTechnologies]);

  /** Success rate — completed / (completed + in_progress). */
  const successRate = useMemo(() => {
    const denom = dashboardStats.completed + dashboardStats.in_progress;
    if (denom === 0) return 0;
    return Math.round((dashboardStats.completed / denom) * 100);
  }, [dashboardStats.completed, dashboardStats.in_progress]);

  // Generate recommendations based on progress
  const recommendations = employeeTechnologies
    .filter((tech) => tech.progress < 100)
    .slice(0, 2)
    .map((tech) => ({
      tech: tech.name,
      module: `${tech.name} - Continue Learning`,
      reason: `You've completed ${tech.completed}/${tech.total} questions (${filterProgress(tech.progress)}%)`,
      priority: tech.progress > 50 ? "medium" : "high",
      estimatedTime: `${Math.ceil((tech.total - tech.completed) * 10)} min`,
    }));

  const handleTechClick = (techId: string) => {
    const tech = employeeTechnologies.find((t) => t.id === techId);
    if (tech?.isLocked) {
      navigate("/candidate/subscription");
      return;
    }
    setSelectedTech(techId);
  };

  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="max-w-9xl mx-auto p-4">
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-slate-600">Loading your dashboard...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (selectedTech) {
    const tech = employeeTechnologies.find((t) => t.id === selectedTech);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <>
          <ModuleView
            technologyId={selectedTech}
            technologyName={tech?.name || ""}
            onBack={() => setSelectedTech(null)}
          />
        </>
      </div>
    );
  }

  const overallProgress =
    employeeTechnologies.length > 0
      ? Math.round(
        employeeTechnologies.reduce((acc, tech) => acc + tech.progress, 0) /
        employeeTechnologies.length
      )
      : 0;

  const totalQuestionsCompleted = employeeTechnologies.reduce(
    (sum, tech) => sum + tech.completed,
    0
  );
  const totalQuestions = employeeTechnologies.reduce(
    (sum, tech) => sum + tech.total,
    0
  );



  if (userProfile?.is_individual) {
    const planLabel = currentSubscription?.plan_name || 'Free Tier Plan';
    const planBadgeClass = isPaid
      ? 'bg-green-50 border-green-100 text-green-700'
      : 'bg-blue-50 border-blue-100 text-blue-700';

    return (
      <>
        <div className="min-h-screen bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className={`inline-flex items-center gap-2 ${planBadgeClass} border text-xs font-bold px-2.5 py-1 rounded-full mb-3 uppercase tracking-wider`}>
                    <Crown className="w-3 h-3" />
                    {planLabel}
                  </div>
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    Welcome, {userProfile?.name || "Candidate"}!
                  </h1>
                  <p className="mt-2 text-slate-500 text-sm max-w-xl">
                    {isPaid
                      ? `You're on the ${planLabel}. Enjoy unlimited access to assessments and AI features.`
                      : "Track your weekly assessments and progress here. Upgrade to Pro for unlimited access and AI features."}
                  </p>
                </div>
                {!isPaid ? (
                  <Button 
                    onClick={() => navigate("/candidate/subscription")}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-6 rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                  >
                    Upgrade to Pro <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    onClick={() => navigate("/candidate/subscription")}
                    variant="outline"
                    className="border-green-200 text-green-700 font-bold py-5 px-6 rounded-xl"
                  >
                    Manage Plan
                  </Button>
                )}
              </div>
              {/* Usage bar for paid plans */}
              {isPaid && subUsage && (
                <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Assessments Used</p>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min((subUsage.assessments_used / subUsage.assessments_limit) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{subUsage.assessments_used} / {subUsage.assessments_limit} this month</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">AI Interviews Used</p>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full transition-all"
                        style={{ width: `${Math.min((subUsage.ai_interviews_used / subUsage.ai_interviews_limit) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{subUsage.ai_interviews_used} / {subUsage.ai_interviews_limit} this month</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  <h2 className="font-bold text-slate-900">Active Assessments</h2>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 px-3">
                  {assessments.length} Assigned
                </Badge>
              </div>

              {/* Table Header - Matching the style of the user's expected image */}
              <div className="hidden md:grid grid-cols-[2fr,1fr,1fr,1.2fr,0.8fr] text-[11px] font-bold border-b px-6 py-3 bg-slate-100/50 uppercase tracking-wider text-slate-500">
                <span>Assessment</span>
                <span className="text-center">Questions</span>
                <span className="text-center">Status</span>
                <span className="text-center">Duration / Deadline</span>
                <span className="text-right">Action</span>
              </div>

              {assessmentsLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="mt-2 text-slate-500 text-sm">Loading assessments...</p>
                </div>
              ) : assessments.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Calendar className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">No active assessments</h3>
                  <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                    New assessments are assigned weekly. We'll notify you when one is ready!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {assessments.map((assessment: any) => (
                    <div 
                      key={assessment.candidate_assessment_id || assessment.candidate_ai_assessment_id}
                      className="grid grid-cols-1 md:grid-cols-[2fr,1fr,1fr,1.2fr,0.8fr] items-center px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${assessment.assessment_type === 'ai' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                          {assessment.assessment_type === 'ai' ? <Zap className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{assessment.title}</p>
                          <p className="text-[10px] text-slate-500">{assessment.assessment_type === 'ai' ? 'AI Interview' : 'Technical Quiz'}</p>
                        </div>
                      </div>

                      <div className="text-center">
                        <span className="text-xs font-medium text-slate-700">{assessment.total_questions || 'N/A'} Qs</span>
                      </div>

                      <div className="text-center">
                        <Badge className="capitalize text-[10px] bg-amber-50 text-amber-700 border-amber-100">
                          {assessment.status}
                        </Badge>
                      </div>

                      <div className="text-center flex flex-col items-center">
                        <div className="flex items-center gap-1 text-[10px] text-slate-600">
                          <Clock className="w-3 h-3" />
                          {assessment.duration_minutes || 30} mins
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          Due: {formatDate(assessment.end_date)}
                        </div>
                      </div>

                      <div className="text-right">
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (assessment.assessment_type === "ai" || assessment.is_ai) {
                              navigate(`/candidate/ai-assessment/${assessment.assessment_id}/introduction`);
                            } else {
                              navigate(`/candidate/my-assessment/${assessment.candidate_assessment_id}/running`);
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700 h-8 px-4 text-xs font-bold rounded-lg shadow-sm"
                        >
                          <Play className="w-3 h-3 mr-1.5" /> Start
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
                      <Star className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Learning Path</h3>
                      <p className="text-xs text-slate-500">Based on your tech stack</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Complete your weekly assessments to unlock personalized course recommendations.
                  </p>
                  <Button variant="ghost" onClick={() => navigate("/candidate/my-learning")} className="text-blue-600 hover:text-blue-700 p-0 h-auto font-semibold">
                    Explore My Learning <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                      <Zap className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Skill Insights</h3>
                      <p className="text-xs text-slate-500">AI-powered analysis</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    {isPaid
                      ? "View detailed AI feedback on your answers and code quality."
                      : "Upgrade to Pro to get detailed feedback on your answers and code quality."}
                  </p>
                  <Button variant="ghost" onClick={() => navigate(isPaid ? "/candidate/my-learning" : "/candidate/subscription")} className="text-purple-600 hover:text-purple-700 p-0 h-auto font-semibold">
                    {isPaid ? "View Insights" : "View Pro Features"} <ArrowRight className="ml-1 w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* 1. HERO — welcome + readiness ring + quick actions */}
        <motion.section
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-7",
            CARD_SHADOW
          )}
        >
          <span aria-hidden className="pointer-events-none absolute -right-12 -top-20 h-52 w-52 rounded-full bg-violet-300/25 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-24 right-1/4 h-44 w-44 rounded-full bg-[#ff5a1f]/10 blur-3xl" />

          <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px] lg:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
                  <GraduationCap className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-violet">
                    Learning Center
                  </p>
                  <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Welcome back, {userName}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">{today}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <span className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                  <Flame className="h-3.5 w-3.5" />
                  {activeTechnologies.length} active path{activeTechnologies.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-brand-violet">
                  <Layers className="h-3.5 w-3.5" />
                  {employeeTechnologies.length} learning paths
                </span>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {dashboardStats.completed} completed
                </span>
                {nearestDeadline && (() => {
                  const d = daysUntil(nearestDeadline.end_date);
                  const tone = d !== null && d <= 2 ? "rose" : d !== null && d <= 7 ? "amber" : "slate";
                  const toneCls = tone === "rose" ? "bg-rose-50 text-rose-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700";
                  return (
                    <span className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold", toneCls)}>
                      <Clock className="h-3.5 w-3.5" />
                      {d !== null ? (d <= 0 ? "Due today" : `${d}d to ${nearestDeadline.title}`) : nearestDeadline.title}
                    </span>
                  );
                })()}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                {topTech && (
                  <button
                    type="button"
                    onClick={() => handleTechClick(topTech.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
                  >
                    <Play className="h-4 w-4" />
                    Continue {topTech.name}
                  </button>
                )}
                {nextAssessment && (
                  <button
                    type="button"
                    onClick={() => navigate("/candidate/my-assessments")}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Take assessment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/candidate/my-learning")}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
                >
                  <BookOpen className="h-4 w-4" />
                  All paths
                </button>
              </div>
            </div>

            {/* Readiness Ring */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative h-40 w-40">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
                  <defs>
                    <linearGradient id="ringGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
                      <stop offset="0%" stopColor="#3d075f" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                  </defs>
                  <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="none" />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    stroke="url(#ringGrad)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - Math.max(0, Math.min(readinessScore, 100)) / 100)}`}
                    className="transition-[stroke-dashoffset] duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold tracking-tight text-slate-900">{readinessScore}</div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">/ 100</div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-700">{readinessLabel}</p>
              <p className="text-[11px] text-slate-500">Readiness score</p>
            </div>
          </div>
        </motion.section>

        {/* 2. PERFORMANCE COMMAND CENTER */}
        <SurfaceCard className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm">
              <Target className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Performance Command Center</h2>
              <p className="text-xs text-slate-500">Your scores, strengths and focus areas at a glance</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-amber-50/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                <Star className="h-3 w-3" /> Avg Score
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{dashboardStats.average_score}</span>
                <span className="text-sm text-slate-400">%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: `${Math.min(dashboardStats.average_score, 100)}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-emerald-50/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Completion
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{completionRate}</span>
                <span className="text-sm text-slate-400">%</span>
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${completionRate}%` }} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-indigo-50/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700">
                <BarChart3 className="h-3 w-3" /> In Progress
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{dashboardStats.in_progress}</span>
                <span className="text-xs text-slate-400">paths</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{activeTechnologies.length} actively learning</p>
            </div>

            <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-br from-white to-violet-50/70 p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-violet">
                <Crown className="h-3 w-3" /> Mastered
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900">{masteredTechs.length}</span>
                <span className="text-xs text-slate-400">of {employeeTechnologies.length}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">100% completion</p>
            </div>
          </div>

          {(topTech || focusTech) && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {topTech && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Strongest</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{topTech.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {filterProgress(topTech.progress)}%
                  </span>
                </div>
              )}
              {focusTech && focusTech.id !== topTech?.id && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Target className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Focus area</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{focusTech.name}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                    {filterProgress(focusTech.progress)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </SurfaceCard>

        {/* 3. LEARNING JOURNEY TIMELINE */}
        <SurfaceCard className="p-5">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
              <BarChart3 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Learning Journey</h2>
              <p className="text-xs text-slate-500">Your roadmap from start to interview-ready</p>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[640px] grid-cols-7 items-center gap-0 px-1">
              {milestones.map((m, i) => {
                const Icon = m.icon;
                const dotCls = m.done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : m.current
                    ? "border-brand-violet bg-violet-50 text-brand-violet ring-4 ring-violet-100"
                    : "border-slate-200 bg-white text-slate-400";
                const labelCls = m.done
                  ? "text-emerald-700"
                  : m.current
                    ? "text-brand-violet"
                    : "text-slate-500";
                return (
                  <React.Fragment key={m.label}>
                    <div className="col-span-1 flex flex-col items-center text-center">
                      <span className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 transition-all", dotCls)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className={cn("mt-2 text-xs font-semibold leading-tight", labelCls)}>{m.label}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{m.hint}</p>
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="col-span-1 -mt-7 flex items-center px-1">
                        <div className={cn("h-0.5 w-full rounded-full", milestones[i + 1].done || m.done ? "bg-emerald-200" : "bg-slate-200")} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </SurfaceCard>

        {/* 4. SKILLS INTELLIGENCE */}
        <SurfaceCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm">
                <Layers className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-slate-900">Skills Intelligence</h2>
                <p className="text-xs text-slate-500">Proficiency across your stack — click any tech to continue</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {employeeTechnologies.length} total
            </span>
          </div>

          {employeeTechnologies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <Layers className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No paths assigned yet</p>
              <p className="mt-1 text-xs text-slate-500">Contact your administrator to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { key: "mastered", label: "Mastered", tone: "emerald", desc: "90% and above", items: skillGroups.mastered },
                { key: "proficient", label: "Proficient", tone: "violet", desc: "60-89% complete", items: skillGroups.proficient },
                { key: "developing", label: "Developing", tone: "amber", desc: "20-59% complete", items: skillGroups.developing },
                { key: "beginner", label: "Just Started", tone: "slate", desc: "Below 20%", items: skillGroups.beginner },
                { key: "notStarted", label: "Not Started", tone: "rose", desc: "Ready to begin", items: skillGroups.notStarted },
              ].filter((g) => g.items.length > 0).map((group) => {
                const toneCls =
                  group.tone === "emerald" ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : group.tone === "violet" ? "bg-violet-50 text-brand-violet ring-violet-100"
                  : group.tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-100"
                  : group.tone === "rose" ? "bg-rose-50 text-rose-700 ring-rose-100"
                  : "bg-slate-100 text-slate-700 ring-slate-200";
                const barCls =
                  group.tone === "emerald" ? "from-emerald-400 to-emerald-600"
                  : group.tone === "violet" ? "from-brand-purple to-brand-violet"
                  : group.tone === "amber" ? "from-amber-400 to-amber-600"
                  : group.tone === "rose" ? "from-rose-300 to-rose-500"
                  : "from-slate-300 to-slate-400";
                return (
                  <div key={group.key} className="rounded-2xl border border-slate-200/70 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset", toneCls)}>
                          {group.label}
                        </span>
                        <span className="text-[11px] text-slate-500">{group.desc}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {group.items.length} path{group.items.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((tech) => {
                        const progress = Number(filterProgress(tech.progress));
                        return (
                          <button
                            key={tech.id}
                            type="button"
                            onClick={() => handleTechClick(tech.id)}
                            className={cn(
                              "group flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-brand-violet/40 hover:shadow-sm",
                              tech.isLocked && "opacity-60"
                            )}
                          >
                            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tech.bgColor || "bg-violet-50", tech.textColor || "text-brand-violet")}>
                              {tech.isLocked ? <Lock className="h-4 w-4" /> : <TechnologyIcon name={tech.name} className="h-4 w-4" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-900">{tech.name}</p>
                              {tech.isLocked ? (
                                <p className="mt-1 text-[10px] font-semibold text-amber-600">Upgrade to unlock</p>
                              ) : (
                                <div className="mt-1 flex items-center gap-1.5">
                                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                                    <div className={cn("h-full bg-gradient-to-r", barCls)} style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className="text-[10px] font-semibold tabular-nums text-slate-600">{progress}%</span>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        {/* 5. ACTION CENTER + 6. ACHIEVEMENT HUB */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Action Center */}
          <SurfaceCard className="lg:col-span-3 p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-sm">
                <Rocket className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-tight text-slate-900">Action Center</h2>
                <p className="text-xs text-slate-500">High-priority next steps</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {(dashboardStats.upcoming_assessments || []).slice(0, 3).map((a: any, i: number) => {
                const d = daysUntil(a.end_date);
                const urgent = d !== null && d <= 2;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => navigate("/candidate/my-assessments")}
                    className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-brand-violet/40 hover:shadow-sm"
                  >
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", urgent ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600")}>
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.end_date ? `Due ${formatDate(a.end_date)}` : "Pending"}</p>
                    </div>
                    {d !== null && (
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", urgent ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}>
                        {d <= 0 ? "Today" : `${d}d`}
                      </span>
                    )}
                  </button>
                );
              })}

              {topTech && (dashboardStats.upcoming_assessments || []).length === 0 && (
                <button
                  type="button"
                  onClick={() => handleTechClick(topTech.id)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-brand-violet/40 hover:shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-brand-violet">
                    <Play className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">Continue learning {topTech.name}</p>
                    <p className="text-xs text-slate-500">{filterProgress(topTech.progress)}% done — keep the momentum</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-brand-violet" />
                </button>
              )}

              {userProfile && !userProfile.resume_s3_url && (
                <button
                  type="button"
                  onClick={() => navigate("/candidate/profile")}
                  className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-indigo-300 hover:shadow-sm"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">Upload your resume</p>
                    <p className="text-xs text-slate-500">Boost your profile and unlock recommendations</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-600" />
                </button>
              )}

              {(dashboardStats.upcoming_assessments || []).length === 0 && !topTech && (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <Rocket className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">All clear</p>
                  <p className="mt-0.5 text-xs text-slate-500">No urgent actions right now. Explore new paths to keep growing.</p>
                </div>
              )}
            </div>
          </SurfaceCard>

          {/* Achievement Hub */}
          <SurfaceCard className="lg:col-span-2 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm">
                  <Trophy className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-bold tracking-tight text-slate-900">Achievement Hub</h2>
                  <p className="text-xs text-slate-500">{achievements.length} earned</p>
                </div>
              </div>
            </div>

            {achievements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                <Trophy className="mx-auto mb-2 h-10 w-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No badges yet</p>
                <p className="mt-1 text-xs text-slate-500">Complete your first module to unlock badges.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {achievements.map((ach, i) => {
                  const Icon = ach.icon;
                  const tile =
                    ach.tone === "violet" ? "from-violet-50 to-white text-brand-violet ring-violet-100"
                    : ach.tone === "emerald" ? "from-emerald-50 to-white text-emerald-700 ring-emerald-100"
                    : ach.tone === "amber" ? "from-amber-50 to-white text-amber-700 ring-amber-100"
                    : "from-indigo-50 to-white text-indigo-700 ring-indigo-100";
                  return (
                    <div key={i} className={cn("flex flex-col items-center rounded-2xl border bg-gradient-to-br p-3 text-center ring-1 ring-inset", tile)}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-2 text-[11px] font-bold leading-tight text-slate-900">{ach.title}</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-slate-500">{ach.subtitle}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>
        </div>

        {/* 7. ACTIVITY & GROWTH ANALYTICS */}
        <SurfaceCard className="p-5">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-sm">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Activity & Growth</h2>
              <p className="text-xs text-slate-500">Your learning momentum across the platform</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Clock className="h-3 w-3" /> Hours invested
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{estimatedHours}<span className="ml-1 text-sm font-medium text-slate-400">h</span></p>
              <p className="mt-1 text-[11px] text-slate-500">Estimated practice time</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <Zap className="h-3 w-3" /> Modules done
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{employeeTechnologies.reduce((s, t) => s + (t.completed || 0), 0)}</p>
              <p className="mt-1 text-[11px] text-slate-500">Across {employeeTechnologies.length} path{employeeTechnologies.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <ClipboardList className="h-3 w-3" /> Assessments
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{dashboardStats.completed + dashboardStats.in_progress}</p>
              <p className="mt-1 text-[11px] text-slate-500">{dashboardStats.completed} completed, {dashboardStats.in_progress} active</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <TrendingUp className="h-3 w-3" /> Success rate
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{successRate}<span className="ml-0.5 text-sm font-medium text-slate-400">%</span></p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500" style={{ width: `${successRate}%` }} />
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
