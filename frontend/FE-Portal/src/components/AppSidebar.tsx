import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, ShieldCheck, Building2, BadgeCheck, Bell } from "lucide-react";
import { tokenStorage } from "@/lib/tokenStorage";
import { useGetProfileQuery } from "@/store";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import logo from "../zeclogo.png";

export type SidebarNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
  badge?: number;
};

interface AppSidebarBaseProps {
  navItems: SidebarNavItem[];
  /** Route considered "home"; skipped from the startsWith active-detection check. */
  homeRoute: string;
  /** Where the identity row click navigates. Empty string = not clickable. */
  profileRoute: string;
  onLogout: () => void;
  /** Used when no auth name/email is available. */
  fallbackUserName?: string;
  /** Overrides default react-router navigate (e.g. to add side effects). */
  onNavigate?: (to: string) => void;
  notifications?: {
    id: string;
    title: string;
    message: string;
    type: 'assessment' | 'learning';
    link: string;
  }[];
  onMarkAsRead?: () => void;
}

interface AppMobileNavProps extends AppSidebarBaseProps {
  /** Label shown next to the favicon in the mobile header. */
  mobileTitle?: string;
}

type StoredUser = {
  role?: string;
  name?: string;
  first_name?: string;
  email?: string;
  organization_name?: string;
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  manager: "Manager",
  candidate: "Candidate",
};

const useSidebarIdentity = (fallbackUserName: string) => {
  const user = tokenStorage.getUser<StoredUser>();
  const { data: profile } = useGetProfileQuery();
  const orgName = profile?.organization_name || user?.organization_name || "";
  const role = user?.role || profile?.role || "";
  const isSuperAdmin = role === "super_admin";
  // Human-readable access label for the logged-in user's role (shown for every role)
  const roleLabel = ROLE_LABELS[role] || role || "";
  // Prefer the first name; if there's no first name, fall back to the email,
  // then the role label (e.g. "Super Admin") rather than the layout's generic
  // placeholder ("Candidate").
  const userName =
    profile?.first_name ||
    user?.first_name ||
    user?.email ||
    profile?.email ||
    roleLabel ||
    fallbackUserName;
  const initial = (userName.trim()[0] || fallbackUserName[0] || "U").toUpperCase();
  // Profile picture (presigned URL); IdentityAvatar falls back to the initial.
  const avatarUrl = profile?.avatar || "";
  // Avoid showing the same text twice (name + identical role badge)
  const showRoleBadge = roleLabel.length > 0 && roleLabel !== userName;
  return { userName, orgName, roleLabel, isSuperAdmin, showRoleBadge, initial, avatarUrl };
};

const isItemActive = (pathname: string, to: string, homeRoute: string) =>
  pathname === to || (to !== homeRoute && pathname.startsWith(to));

/**
 * Desktop sidebar — must be rendered as a flex sibling of the main content column.
 * Hidden below md; on mobile the chrome lives in AppMobileNav.
 */
export const AppSidebar: React.FC<AppSidebarBaseProps> = ({
  navItems,
  homeRoute,
  profileRoute,
  onLogout,
  fallbackUserName = "User",
  onNavigate,
  notifications = [],
  onMarkAsRead,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, orgName, roleLabel, isSuperAdmin, showRoleBadge, initial, avatarUrl } =
    useSidebarIdentity(fallbackUserName);

  // Mirror admin's behavior: auto-collapse on narrow widths.
  useEffect(() => {
    const check = () => {
      if (window.innerWidth < 768) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const go = (to: string) => (onNavigate ? onNavigate(to) : navigate(to));
  const identityClickable = profileRoute.length > 0;

  return (
    <aside
      className={`hidden md:flex h-screen sticky top-0 left-0 bg-gradient-to-b from-brand-purple via-brand-deep to-black
        border-r border-white/10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]
        transition-[width] duration-300 ease-in-out
        ${collapsed ? "w-[68px]" : "w-[256px]"}`}
    >
      <div className="flex flex-col h-full w-full">
        {/* Logo / collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((p) => !p)}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className={`flex w-full items-center border-b border-white/10 transition-colors hover:bg-white/5 ${
            collapsed ? "justify-center px-0 py-4" : "justify-between px-4 py-4"
          }`}
        >
          {collapsed ? (
            <img src="/SkilTechyFavicon.png" alt="logo" className="h-8 w-8 rounded-lg" />
          ) : (
            <img src={logo} alt="logo" className="h-8 w-auto" />
          )}
          {!collapsed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div 
                  className="relative cursor-pointer hover:bg-white/10 p-1.5 rounded-full transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 text-white/80" />
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white -translate-y-1/4 translate-x-1/4">
                      {notifications.length}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
                {notifications.length > 0 ? (
                  <>
                    {notifications.map(n => (
                      <DropdownMenuItem 
                        key={n.id} 
                        className="flex flex-col items-start p-3 cursor-pointer"
                        onClick={() => go(n.link)}
                      >
                        <div className="font-semibold text-sm mb-1">{n.title}</div>
                        <div className="text-xs text-slate-500 whitespace-normal leading-relaxed">{n.message}</div>
                      </DropdownMenuItem>
                    ))}
                    <div className="p-2 border-t border-slate-100">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onMarkAsRead) onMarkAsRead();
                        }}
                        className="w-full text-center text-xs font-semibold text-brand-violet hover:text-brand-purple p-2 transition-colors rounded hover:bg-slate-50"
                      >
                        Mark all as read
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-4 text-sm text-center text-slate-500">No new notifications</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </button>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(location.pathname, item.to, homeRoute);
            return (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                title={collapsed ? item.label : undefined}
                className={`group relative flex w-full items-center rounded-lg transition-all duration-200 ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "bg-white/15 font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10"
                    : "font-medium text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                {active && !collapsed && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-fuchsia-300 to-violet-400" />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <span className="text-sm leading-none whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {!collapsed && item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Identity + Logout footer */}
        <div className="space-y-1 border-t border-white/10 p-2.5">
          {identityClickable ? (
            <button
              type="button"
              onClick={() => go(profileRoute)}
              title={collapsed ? `${userName}${orgName ? ` — ${orgName}` : ""}` : undefined}
              className={`group flex w-full items-center rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] ring-1 ring-white/10 transition-all duration-200 hover:from-white/[0.12] hover:ring-white/20 ${
                collapsed ? "justify-center px-0 py-2" : "gap-3 px-2.5 py-2.5"
              }`}
            >
              <IdentityAvatar initial={initial} isSuperAdmin={isSuperAdmin} avatarUrl={avatarUrl} />
              {!collapsed && (
                <IdentityText
                  userName={userName}
                  roleLabel={roleLabel}
                  orgName={orgName}
                  isSuperAdmin={isSuperAdmin}
                  showRoleBadge={showRoleBadge}
                />
              )}
            </button>
          ) : (
            <div
              title={collapsed ? `${userName}${orgName ? ` — ${orgName}` : ""}` : undefined}
              className={`flex items-center rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] ring-1 ring-white/10 ${
                collapsed ? "justify-center px-0 py-2" : "gap-3 px-2.5 py-2.5"
              }`}
            >
              <IdentityAvatar initial={initial} isSuperAdmin={isSuperAdmin} avatarUrl={avatarUrl} />
              {!collapsed && (
                <IdentityText
                  userName={userName}
                  roleLabel={roleLabel}
                  orgName={orgName}
                  isSuperAdmin={isSuperAdmin}
                  showRoleBadge={showRoleBadge}
                />
              )}
            </div>
          )}

          <button
            onClick={onLogout}
            title={collapsed ? "Logout" : undefined}
            className={`flex w-full items-center rounded-lg font-medium text-white/75 transition-all duration-200 hover:bg-red-500/20 hover:text-white ${
              collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="text-sm leading-none">Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

/**
 * Mobile chrome (header + drawer menu) — must be rendered inside the main content column,
 * above {children}. Hidden at md+.
 */
export const AppMobileNav: React.FC<AppMobileNavProps> = ({
  navItems,
  homeRoute,
  profileRoute,
  onLogout,
  fallbackUserName = "User",
  onNavigate,
  mobileTitle = "Dashboard",
  notifications = [],
  onMarkAsRead,
}) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { userName, orgName, roleLabel, isSuperAdmin, showRoleBadge, initial, avatarUrl } =
    useSidebarIdentity(fallbackUserName);

  const go = (to: string) => {
    setOpen(false);
    if (onNavigate) onNavigate(to);
    else navigate(to);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between bg-gradient-to-b from-brand-purple via-brand-deep to-black px-4 py-3 shadow-lg md:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/SkilTechyFavicon.png" alt="logo" className="h-7 w-7 rounded-lg" />
          <h2 className="text-base font-semibold leading-none text-white">{mobileTitle}</h2>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button 
                 className="relative text-white/85 transition-colors hover:text-white"
                 title="Notifications"
              >
                <Bell className="h-6 w-6" />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white -translate-y-1/4 translate-x-1/4">
                    {notifications.length}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              {notifications.length > 0 ? (
                <>
                  {notifications.map(n => (
                    <DropdownMenuItem 
                      key={n.id} 
                      className="flex flex-col items-start p-3 cursor-pointer"
                      onClick={() => go(n.link)}
                    >
                      <div className="font-semibold text-sm mb-1">{n.title}</div>
                      <div className="text-xs text-slate-500 whitespace-normal leading-relaxed">{n.message}</div>
                    </DropdownMenuItem>
                  ))}
                  <div className="p-2 border-t border-slate-100">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onMarkAsRead) onMarkAsRead();
                      }}
                      className="w-full text-center text-xs font-semibold text-brand-violet hover:text-brand-purple p-2 transition-colors rounded hover:bg-slate-50"
                    >
                      Mark all as read
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-4 text-sm text-center text-slate-500">No new notifications</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <button
            onClick={() => setOpen((p) => !p)}
            className="text-white/85 transition-colors hover:text-white"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="space-y-1 bg-gradient-to-b from-brand-purple via-brand-deep to-black px-3 py-3 md:hidden animate-in slide-in-from-top">
          {/* Identity card */}
          <button
            type="button"
            onClick={() => (profileRoute ? go(profileRoute) : setOpen(false))}
            className="mb-2 flex w-full items-center gap-3 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-3 py-2.5 text-left ring-1 ring-white/10"
            disabled={!profileRoute}
          >
            <IdentityAvatar initial={initial} isSuperAdmin={isSuperAdmin} avatarUrl={avatarUrl} />
            <div className="min-w-0 flex-1">
              <IdentityText
                userName={userName}
                roleLabel={roleLabel}
                orgName={orgName}
                isSuperAdmin={isSuperAdmin}
                showRoleBadge={showRoleBadge}
              />
            </div>
          </button>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(location.pathname, item.to, homeRoute);
            return (
              <button
                key={item.to}
                onClick={() => go(item.to)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  active
                    ? "bg-white/15 font-semibold text-white shadow-sm ring-1 ring-inset ring-white/10"
                    : "font-medium text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-sm leading-none">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-white/75 transition-colors hover:bg-red-500/20 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span className="text-sm leading-none">Logout</span>
          </button>
        </div>
      )}
    </>
  );
};

const IdentityAvatar: React.FC<{ initial: string; isSuperAdmin?: boolean; avatarUrl?: string }> = ({
  initial,
  isSuperAdmin,
  avatarUrl,
}) => {
  // Fall back to the initial if there's no pic or it fails to load (e.g. an
  // expired presigned URL).
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(avatarUrl) && !imgFailed;
  return (
    <span className="relative shrink-0">
      {showImage ? (
        <img
          src={avatarUrl}
          alt={initial}
          onError={() => setImgFailed(true)}
          className="h-10 w-10 rounded-xl object-cover shadow-lg ring-2 ring-white/15"
        />
      ) : (
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg ring-2 ring-white/15 ${
            isSuperAdmin
              ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-orange-500/25"
              : "bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-violet-500/30"
          }`}
        >
          {initial}
        </span>
      )}
      {/* online status dot */}
      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#1a0730] bg-emerald-400 shadow-sm" />
    </span>
  );
};

const IdentityText: React.FC<{
  userName: string;
  roleLabel: string;
  orgName: string;
  isSuperAdmin: boolean;
  showRoleBadge: boolean;
}> = ({ userName, roleLabel, orgName, isSuperAdmin, showRoleBadge }) => (
  <div className="min-w-0 flex-1 text-left">
    <p className="truncate text-sm font-semibold leading-tight text-white" title={userName}>
      {userName}
    </p>
    {showRoleBadge && (
      <span
        className={`mt-1.5 inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
          isSuperAdmin
            ? "bg-gradient-to-r from-amber-400/25 to-orange-500/25 text-amber-200 ring-1 ring-amber-300/40"
            : "bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/30"
        }`}
        title={roleLabel}
      >
        {isSuperAdmin ? (
          <ShieldCheck className="h-3 w-3 shrink-0" />
        ) : (
          <BadgeCheck className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{roleLabel}</span>
      </span>
    )}
    {orgName && (
      <p
        className="mt-1 flex items-center gap-1 text-xs leading-tight text-white/55"
        title={orgName}
      >
        <Building2 className="h-3 w-3 shrink-0 text-white/40" />
        <span className="truncate">{orgName}</span>
      </p>
    )}
  </div>
);
