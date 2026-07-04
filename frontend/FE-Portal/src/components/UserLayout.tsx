import React, { ReactNode, Suspense, createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  CheckCircle,
  BookOpenIcon,
  Video,
  Bell,
  AlertTriangle,
  CreditCard,
  Sparkles,
  Bot,
} from "lucide-react";
import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { tokenStorage } from "@/lib/tokenStorage";
import { clearSession } from "@/lib/clearSession";
import { useLazyGetCandidateMockInterviewsQuery, useGetProfileQuery, useLazyGetAssessmentsQuery, useGetProgressQuery } from "@/store";
import RouteLoader from "./RouteLoader";
import { AppSidebar, AppMobileNav, type SidebarNavItem } from "./AppSidebar";

const SNOOZE_KEY = "notifications_snoozed_until";
const SNOOZE_DURATION = 2 * 60 * 1000; // 6 hours

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'assessment' | 'learning' | 'mock_interview';
  link: string;
}
// TYPES
interface UserLayoutProps {
  children?: ReactNode;
}

interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatar?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  profile?: string;
  is_individual?: boolean;
}

interface ProfileCompletion {
  strength: number;
  isIncomplete: boolean;
}

interface ProfileMessage {
  title: string;
  description: string;
  variant: "low" | "medium" | "high";
}

// ============================================================================
// CONSTANTS
// ============================================================================
const PROFILE_THRESHOLDS = {
  LOW: 50,
  MEDIUM: 80,
  HIGH: 100,
} as const;

// Show the prompt only when the profile is materially incomplete (≤60%).
// Earlier this was 100, which kept nagging every candidate who hadn't
// uploaded an avatar even though their profile was otherwise filled.
const PROFILE_COMPLETION_THRESHOLD = 60;
const POPUP_DISPLAY_DELAY = 5000;
// How long "Maybe Later" suppresses the popup, in days.
const POPUP_SNOOZE_DAYS = 7;
const POPUP_SNOOZE_KEY = "profile_popup_snoozed_until";


// CONTEXT
const UserLayoutContext = createContext(false);

// CUSTOM HOOKS
// Hook: Profile Messages
const useProfileMessages = (strength: number): ProfileMessage => {
  return useMemo(() => {
    if (strength < PROFILE_THRESHOLDS.LOW) {
      return {
        title: "Profile Incomplete",
        description: "Your profile needs more information to stand out to employers.",
        variant: "low",
      };
    }

    if (strength < PROFILE_THRESHOLDS.MEDIUM) {
      return {
        title: "Profile Almost Complete",
        description: "You're almost there! Add a few more details to complete your profile.",
        variant: "medium",
      };
    }

    return {
      title: "Profile Nearly Complete",
      description: "Great job! Your profile is nearly complete.",
      variant: "high",
    };
  }, [strength]);
};

// Hook: Profile Completion
const useProfileCompletion = (profileData: any): ProfileCompletion => {
  return useMemo(() => {
    if (!profileData) return { strength: 0, isIncomplete: true };

    const completionScore = [
      profileData.first_name,
      profileData.last_name,
      profileData.phone && profileData.phone.trim().length >= 10,
      profileData.profile,
      profileData.avatar,
    ].filter(Boolean).length * 20;

    return {
      strength: completionScore,
      isIncomplete: completionScore < PROFILE_COMPLETION_THRESHOLD,
    };
  }, [profileData]);
};

// Hook: Profile Popup
//
// Triggers only when the popup actually has value to the candidate:
//   1. Profile must be materially incomplete (≤60% — see threshold).
//   2. We must NOT be on the profile page itself — the candidate is
//      already editing, nudging them again is noise. Previously the
//      page-detection path bypassed the shown-flag and re-fired the
//      popup on every profile refetch (save → refetch → re-popup).
//   3. "Maybe Later" persists a snooze for 7 days via localStorage so
//      the prompt doesn't reappear on every reload.
//
// The in-memory `popupShownFlag` is kept as a per-session belt-and-
// braces guard on top of the persisted snooze.
let popupShownFlag = false;
const useProfilePopup = (isIncomplete: boolean, isLoading: boolean, isProfilePage: boolean = false) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !isIncomplete) return;
    if (isProfilePage) return; // user is already editing — no nudge
    if (popupShownFlag) return; // shown once this session, that's enough

    try {
      const snoozedUntil = Number(window.localStorage.getItem(POPUP_SNOOZE_KEY) || 0);
      if (snoozedUntil && Date.now() < snoozedUntil) return;
    } catch {
      /* localStorage blocked — fall through and show */
    }

    const timer = setTimeout(() => {
      setIsOpen(true);
      popupShownFlag = true;
    }, POPUP_DISPLAY_DELAY);

    return () => clearTimeout(timer);
  }, [isIncomplete, isLoading, isProfilePage]);

  // Maybe Later → snooze for POPUP_SNOOZE_DAYS.
  const handleClose = useCallback(() => {
    setIsOpen(false);
    try {
      const until = Date.now() + POPUP_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      window.localStorage.setItem(POPUP_SNOOZE_KEY, String(until));
    } catch {
      /* ignore storage errors */
    }
  }, []);

  // Complete Profile → clear snooze (candidate is engaging), let popup
  // come back later if they bail without finishing.
  const handleComplete = useCallback(() => {
    setIsOpen(false);
    try {
      window.localStorage.removeItem(POPUP_SNOOZE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const resetPopupState = useCallback(() => {
    setIsOpen(false);
    popupShownFlag = false;
  }, []);

  return { isOpen, handleClose, handleComplete, resetPopupState };
};

// Hook: Popup Handlers
const usePopupHandlers = (
  onClose: () => void,
  onCompleteProfile: () => void,
  navigate: ReturnType<typeof useNavigate>
) => {
  const handleCompleteProfile = useCallback(() => {
    onCompleteProfile();
    navigate("/candidate/profile");
  }, [onCompleteProfile, navigate]);

  const handleMaybeLater = useCallback(() => {
    onClose();
  }, [onClose]);

  return { handleCompleteProfile, handleMaybeLater };
};

// Hook: User Data
const useUserData = (): UserProfile | null => {
  const [userData, setUserData] = useState<UserProfile | null>(null);

  useEffect(() => {
    const user = tokenStorage.getUser<UserProfile>();
    if (user) {
      sessionStorage.setItem("userName", user.name || "");
      sessionStorage.setItem("candidateEmail", user.email || "");
      setUserData(user);
    }
  }, []);

  return userData;
};

// Hook: Mock Sessions
const usePendingMockInterviews = () => {
  const [pendingItems, setPendingItems] = useState<NotificationItem[]>([]);
  const [getCandidateMockInterviews] = useLazyGetCandidateMockInterviewsQuery();

  useEffect(() => {
    const fetchMockSessions = async () => {
      try {
        const data = await getCandidateMockInterviews(
          "/api/mock-interview/interviewer-mock-sessions/"
        ).unwrap();
        const results = data?.results ?? data;
        const sessions = Array.isArray(results) ? results : [];

        const pending = sessions.filter((s: any) => s.status !== "completed");

        const items = pending.map((s: any) => {
          return {
            id: `mock-${s.id || Math.random()}`,
            title: `Mock Interview: ${s.stack || 'General'}`,
            message: `A Mock Interview with ${s.candidate_interviewer_name || 'an interviewer'} is pending!`,
            type: 'mock_interview',
            link: '/candidate/mock-interviews'
          } as NotificationItem;
        });

        setPendingItems(items);
      } catch (err) {
        console.error("Failed to load mock interviews for notification badge", err);
      }
    };

    fetchMockSessions();
  }, [getCandidateMockInterviews]);

  return pendingItems;
};

// Hook: Navigation
const useNavigation = (resetPopupState?: () => void) => {
  const navigate = useNavigate();

  const handleNavigate = useCallback((path: string) => {
    navigate(path, { replace: false });
  }, [navigate]);

  const handleLogout = useCallback(() => {
    navigate("/", { replace: true });
    clearSession();
  }, [navigate]);

  return { handleNavigate, handleLogout };
};

// Hook: Pending Assessments
const usePendingAssessments = () => {
  const [pendingItems, setPendingItems] = useState<NotificationItem[]>([]);
  const [getAssessments] = useLazyGetAssessmentsQuery();

  useEffect(() => {
    const fetchAssignedAssessments = async () => {
      try {
        const data = await getAssessments("/candidate/assessments/assigned/", true).unwrap();
        const merged = [...(data.assigned_assessments || []), ...(data.ai_assigned_assessments || [])];
        const pending = merged.filter((a: any) => {
          const expired = a.end_date ? new Date(a.end_date).getTime() < Date.now() : false;
          return a.status === "assigned" && !expired;
        });

        const items = pending.map((a: any) => {
          const assignedStr = new Date(a.assigned_date).toLocaleDateString();
          const expireStr = a.end_date ? new Date(a.end_date).toLocaleDateString() : null;
          const message = expireStr
            ? `${a.title} assigned to you on ${assignedStr} is pending! Complete it before ${expireStr}.`
            : `${a.title} assigned to you on ${assignedStr} is pending!`;

          return {
            id: `assessment-${a.assessment_id || a.candidate_assessment_id || Math.random()}`,
            title: a.title,
            message,
            type: 'assessment',
            link: '/candidate/my-assessments'
          } as NotificationItem;
        });

        setPendingItems(items);
      } catch (err) {
        console.error("Failed to load assessments for notification badge", err);
      }
    };
    fetchAssignedAssessments();
  }, [getAssessments]);

  return pendingItems;
};

// Hook: Pending Learning
const usePendingLearning = (profileData: any) => {
  const { data: progressRaw } = useGetProgressQuery(undefined, { skip: !profileData });

  return useMemo(() => {
    if (!profileData?.learning_assignments) return [];
    const assignments = profileData.learning_assignments;
    const technologyProgress = progressRaw?.results || [];

    const items: NotificationItem[] = [];
    for (const assignment of assignments) {
      const p = technologyProgress.find((t: any) => t.technologyId === assignment.technology_id);
      const progress = p?.progress ?? 0;
      if (progress < 100) {
        const assignedStr = new Date(assignment.assigned_at).toLocaleDateString();
        const expireStr = assignment.due_at ? new Date(assignment.due_at).toLocaleDateString() : null;
        const message = expireStr
          ? `${assignment.technology_name} assigned to you on ${assignedStr} is pending! Complete it before ${expireStr}.`
          : `${assignment.technology_name} assigned to you on ${assignedStr} is pending!`;

        items.push({
          id: `learning-${assignment.assignment_id || assignment.technology_id || Math.random()}`,
          title: assignment.technology_name,
          message,
          type: 'learning',
          link: `/candidate/my-learning?course=${assignment.technology_id}`
        });
      }
    }
    return items;
  }, [profileData, progressRaw]);
};

// Hook: Notifications Snooze
const useNotificationsSnooze = () => {
  const [isSnoozed, setIsSnoozed] = useState(false);

  useEffect(() => {
    const snoozedUntil = parseInt(localStorage.getItem(SNOOZE_KEY) || "0", 10);

    // Failsafe: if the user previously saved a 6-hour timestamp and then changed
    // the code to 2 minutes, the timestamp will be too far in the future.
    if (snoozedUntil > Date.now() + SNOOZE_DURATION) {
      localStorage.removeItem(SNOOZE_KEY);
      setIsSnoozed(false);
      return;
    }

    if (snoozedUntil > Date.now()) {
      setIsSnoozed(true);

      const timer = setTimeout(() => {
        setIsSnoozed(false);
      }, snoozedUntil - Date.now());

      return () => clearTimeout(timer);
    } else {
      setIsSnoozed(false);
    }
  }, []);

  const markAsRead = useCallback(() => {
    const until = Date.now() + SNOOZE_DURATION;
    localStorage.setItem(SNOOZE_KEY, until.toString());
    setIsSnoozed(true);

    setTimeout(() => {
      setIsSnoozed(false);
    }, SNOOZE_DURATION);
  }, []);

  return { isSnoozed, markAsRead };
};

// Component: Notification Icon
const NotificationIcon: React.FC = () => (
  <div className="relative">
    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
      <Bell className="w-6 h-6 text-blue-600" />
    </div>
    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
      <AlertTriangle className="w-2.5 h-2.5 text-white" />
    </div>
  </div>
);

// Component: Profile Strength Indicator
const ProfileStrengthIndicator: React.FC<{ strength: number }> = ({ strength }) => {
  const message = useProfileMessages(strength);

  const getProgressColor = (value: number) => {
    if (value < PROFILE_THRESHOLDS.LOW) return "bg-red-500";
    if (value < PROFILE_THRESHOLDS.MEDIUM) return "bg-amber-500";
    return "bg-green-500";
  };

  const getBadgeVariant = (variant: ProfileMessage["variant"]) => {
    switch (variant) {
      case "low":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-amber-100 text-amber-800";
      case "high":
        return "bg-green-100 text-green-800";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700">Profile Strength</span>
        <span className="text-sm font-bold text-blue-600">{strength}%</span>
      </div>

      <div className="relative">
        <Progress value={strength} className="h-2" />
        <div
          className={`absolute top-0 left-0 h-full rounded-full ${getProgressColor(strength)} opacity-30`}
          style={{ width: `${strength}%` }}
        />
      </div>

      <p className="text-xs text-slate-500">{message.description}</p>

      <Badge
        variant="secondary"
        className={`${getBadgeVariant(message.variant)} border-0`}
      >
        {strength}% Complete
      </Badge>
    </div>
  );
};

// Component: Profile Completion Popup (No Close/X Button)
const ProfileCompletionPopup: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  profileStrength: number;
  onCompleteProfile: () => void;
}> = ({ isOpen, onClose, profileStrength, onCompleteProfile }) => {
  const navigate = useNavigate();
  const message = useProfileMessages(profileStrength);
  const { handleCompleteProfile, handleMaybeLater } = usePopupHandlers(
    onClose,
    onCompleteProfile,
    navigate
  );

  // Close popup on escape key (still works for accessibility)
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        handleMaybeLater();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleMaybeLater]);

  // Prevent body scroll when popup is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <Card className="w-full max-w-md bg-white shadow-2xl border-0 animate-in slide-in-from-bottom duration-300">
        <CardContent className="p-6">
          {/* Header - No Close Button */}
          <div className="flex items-center justify-center mb-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <NotificationIcon />
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{message.title}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Please complete your profile.
                </p>
              </div>
            </div>
          </div>

          {/* Profile Strength Indicator */}
          <div className="mb-6">
            <ProfileStrengthIndicator strength={profileStrength} />
          </div>

          {/* Action Buttons - Only these two buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleCompleteProfile}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              size="sm"
            >
              Complete Your Profile
            </Button>
            <Button
              variant="outline"
              onClick={handleMaybeLater}
              className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              size="sm"
            >
              Maybe Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// MAIN COMPONENT - UserLayout
const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
  const isNestedInsideUserLayout = useContext(UserLayoutContext);

  // Side effect: stash auth identity into sessionStorage for consumers elsewhere.
  useUserData();

  const { data: profileData, isLoading: isProfileLoading } = useGetProfileQuery();
  const pendingMockInterviews = usePendingMockInterviews();
  const hasMockSessions = pendingMockInterviews.length > 0;

  const profileCompletion = useProfileCompletion(profileData);
  const isProfilePage = location.pathname === "/candidate/profile";
  const { isOpen: isPopupOpen, handleClose: handlePopupClose, handleComplete: handlePopupComplete, resetPopupState } = useProfilePopup(
    profileCompletion.isIncomplete, isProfileLoading || !profileData, isProfilePage
  );

  const { handleNavigate, handleLogout } = useNavigation(resetPopupState);
  const pendingAssessments = usePendingAssessments();
  const pendingLearning = usePendingLearning(profileData);
  const pendingCount = pendingAssessments.length;
  const pendingLearningCount = pendingLearning.length;
  const allNotifications = useMemo(() => [
    ...pendingAssessments,
    ...pendingLearning,
    ...pendingMockInterviews
  ], [pendingAssessments, pendingLearning, pendingMockInterviews]);

  const { isSnoozed, markAsRead } = useNotificationsSnooze();
  const bellNotifications = isSnoozed ? [] : allNotifications;

  const navItems = useMemo((): SidebarNavItem[] => {
    const items: SidebarNavItem[] = [
      { label: "Dashboard", icon: LayoutDashboard, to: "/candidate/dashboard" },
      { label: "My Learning", icon: BookOpenIcon, to: "/candidate/my-learning", badge: pendingLearningCount },
      { label: "My Assessments", icon: ClipboardList, to: "/candidate/my-assessments", badge: pendingCount },
      { label: "Completed", icon: CheckCircle, to: "/candidate/completed-assessments", badge: 0 },
      { label: "Premium AI Interview", icon: Sparkles, to: "/candidate/AiInterviewSetup", badge: 0 },
      //{ label: "AI Interview Room", icon: Bot, to: "/candidate/ai-interview/preview/room?variant=premium", badge: 0 },
      ...(profileData?.is_individual ? [{ label: "Subscription", icon: CreditCard, to: "/candidate/subscription" }] : []),
    ];

    if (!profileData?.is_individual && hasMockSessions) {
      items.push({ label: "Mock Interviews", icon: Video, to: "/candidate/mock-interviews", badge: pendingMockInterviews.length });
    }

    return items;
  }, [hasMockSessions, profileData?.is_individual, pendingCount, pendingLearningCount, pendingMockInterviews.length]);

  const content = children ?? <Outlet />;

  if (isNestedInsideUserLayout) {
    return <>{content}</>;
  }

  return (
    <UserLayoutContext.Provider value={true}>
      <div className="min-h-screen flex bg-background">
        <AppSidebar
          navItems={navItems}
          homeRoute="/candidate/dashboard"
          profileRoute="/candidate/profile"
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          fallbackUserName="Candidate"
          notifications={bellNotifications}
          onMarkAsRead={markAsRead}
        />

        <div className="flex-1 min-w-0 flex flex-col w-full">
          <AppMobileNav
            navItems={navItems}
            homeRoute="/candidate/dashboard"
            profileRoute="/candidate/profile"
            onLogout={handleLogout}
            onNavigate={handleNavigate}
            fallbackUserName="Candidate"
            mobileTitle="Dashboard"
            notifications={bellNotifications}
            onMarkAsRead={markAsRead}
          />

          <main className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <Suspense fallback={<RouteLoader />}>
              {content}
            </Suspense>
          </main>
        </div>
      </div>

      <ProfileCompletionPopup
        isOpen={isPopupOpen}
        onClose={handlePopupClose}
        profileStrength={profileCompletion.strength}
        onCompleteProfile={handlePopupComplete}
      />
    </UserLayoutContext.Provider>
  );
};

export default UserLayout;
