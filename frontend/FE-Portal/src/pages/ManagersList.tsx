import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, Search, UserCog, UserPlus } from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { tokenStorage } from "@/lib/tokenStorage";
import { cn } from "@/lib/utils";
import { BTN_PRIMARY } from "@/lib/uiStyles";

interface ManagerRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
}

const fullName = (m: ManagerRow) =>
  `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email || `User #${m.id}`;

const joined = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const ManagersList: React.FC = () => {
  const navigate = useNavigate();
  const [managers, setManagers] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // Org admins manage managers; a manager hitting this directly is bounced.
  const role = tokenStorage.getUser<{ role?: string }>()?.role;
  useEffect(() => {
    if (role && role !== "org_admin" && role !== "super_admin") navigate("/admin", { replace: true });
  }, [role, navigate]);

  const fetchManagers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = tokenStorage.getAccessToken();
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "/v1/").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/org/users/?role=manager&page=1&page_size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setManagers((data.results || []) as ManagerRow[]);
      } else {
        setError(data.error || data.detail || "Failed to load managers.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchManagers();
  }, [fetchManagers]);

  const filtered = managers.filter((m) => {
    const q = search.toLowerCase();
    return !q || fullName(m).toLowerCase().includes(q) || (m.email || "").toLowerCase().includes(q);
  });

  return (
    <AdminLayout>
      <div className="w-full font-sans antialiased text-slate-900">
        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-10 md:px-8">
          <PageHeader
            icon={UserCog}
            title="Managers"
            description="People who create assessments and invite candidates in your organization."
            actions={
              <button
                type="button"
                onClick={() => navigate("/admin/org/users/create")}
                className={cn(BTN_PRIMARY, "gap-1.5 px-3.5 py-2 text-xs")}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite Manager
              </button>
            }
          />

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search managers…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-violet" />
                <span className="text-sm text-slate-500">Loading managers…</span>
              </div>
            ) : error ? (
              <div className="py-16 text-center text-sm text-rose-600">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <UserCog className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-600">No managers yet</p>
                <p className="mt-1 text-xs text-slate-400">Invite a manager to help create assessments and manage candidates.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Manager</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-brand-violet">
                            {fullName(m).slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-800">{fullName(m)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {m.email}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                            m.is_active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-slate-200"
                          }`}
                        >
                          {m.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{joined(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && !error && filtered.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              {filtered.length} manager{filtered.length === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ManagersList;
