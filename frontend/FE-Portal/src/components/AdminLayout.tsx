import { ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Database,
  ClipboardList,
  CircleCheckBig,
  Monitor,
  Upload,
  GraduationCap,
  CreditCard,
  Building2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearSession } from "@/lib/clearSession";
import { tokenStorage } from "@/lib/tokenStorage";
import { AppSidebar, AppMobileNav, type SidebarNavItem } from "./AppSidebar";

type AdminLayoutProps = {
  children: ReactNode;
};

const getNavItems = (): SidebarNavItem[] => {
  const user = tokenStorage.getUser<{ role: string }>();
  const isSuper = user?.role === "super_admin";
  const items: SidebarNavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, to: "/admin" },
    { label: "Candidate", icon: Users, to: "/admin/candidates" },
    { label: "Course", icon: GraduationCap, to: "/admin/technologies" },
    { label: "Mock Interviews", icon: Monitor, to: "/admin/mock-interview" },
    { label: "Assessments", icon: ClipboardList, to: "/admin/assessments" },
    { label: "Question Bank", icon: Database, to: "/admin/questions" },
    { label: "Results", icon: CircleCheckBig, to: "/admin/results" },
  ];
  // Bulk Upload (candidates/questions/courses) is Super-Admin only.
  if (isSuper) {
    items.push({ label: "Bulk Upload", icon: Upload, to: "/admin/bulk-upload" });
    // Platform-owner surface: manage tenant organizations. Sits right under Dashboard.
    items.splice(1, 0, { label: "Organizations", icon: Building2, to: "/admin/organizations" });
  }
  if (user?.role === "org_admin") {
    // Managers list sits right after Candidate, mirroring how super admins
    // manage Organizations.
    items.splice(2, 0, { label: "Managers", icon: UserCog, to: "/admin/managers" });
    items.push({ label: "Subscription", icon: CreditCard, to: "/admin/subscription" });
  }
  return items;
};

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const items = getNavItems();

  const handleLogout = () => {
    navigate("/", { replace: true });
    clearSession();
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar
        navItems={items}
        homeRoute="/admin"
        profileRoute="/admin/profile"
        onLogout={handleLogout}
        fallbackUserName="Admin"
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <AppMobileNav
          navItems={items}
          homeRoute="/admin"
          profileRoute="/admin/profile"
          onLogout={handleLogout}
          fallbackUserName="Admin"
          mobileTitle="Admin Panel"
        />

        <main className="flex-1 overflow-y-auto bg-slate-50/70 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
