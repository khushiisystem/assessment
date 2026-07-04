import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  ShieldCheck,
  ShieldOff,
  Users,
  Plus,
  Search,
  Pencil,
  Trash2,
  Crown,
  AlertTriangle,
  Loader2,
  UserPlus,
  Copy,
  Check,
} from "lucide-react";

import AdminLayout from "@/components/AdminLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useGetOrganizationsQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
  useInviteOrgAdminMutation,
  type Organization,
} from "@/store/api/organizationsApi";
import { cn } from "@/lib/utils";
import {
  CARD_SHADOW,
  BTN_PRIMARY,
  BTN_OUTLINE,
  BTN_DANGER,
  PAGE_TITLE,
  INPUT_CLASS,
  SELECT_CLASS,
  TEXTAREA_CLASS,
  LABEL_SM_CLASS,
} from "@/lib/uiStyles";

/* ════════════════════════════════════════════════════════════════════════
 * Organizations management — Super Admin (LIVE)
 * Backed by organizationsApi: list / register / enable-disable / set
 * candidate-invite-limit / delete. Billing/expiry are intentionally NOT here
 * (not required, and not backed by the API).
 * ══════════════════════════════════════════════════════════════════════ */

const ORG_TYPES = ["Company", "Institute", "Other"]; // matches BE ORGANIZATION_TYPE_CHOICES

const STATUS_BADGE = (active: boolean) =>
  active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600";

/* ── inline toggle (no Switch primitive in the kit) ─────────────────────── */
const Toggle = ({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-violet/40 disabled:opacity-50",
      checked ? "bg-emerald-500" : "bg-slate-300"
    )}
  >
    <span className={cn("absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
  </button>
);

const emptyForm = {
  name: "",
  organization_type: ORG_TYPES[0],
  primary_email: "",
  phone: "",
  website: "",
  description: "",
  candidate_limit: "" as string, // "" = unlimited
  enabled: true,
};
type FormState = typeof emptyForm;

import { getErrorMessage as errMessage } from "@/lib/errors";

const OrganizationsManagement = () => {
  const { data: orgs = [], isLoading, isError, refetch } = useGetOrganizationsQuery();
  const [createOrg, { isLoading: creating }] = useCreateOrganizationMutation();
  const [updateOrg, { isLoading: updating }] = useUpdateOrganizationMutation();
  const [deleteOrg, { isLoading: deleting }] = useDeleteOrganizationMutation();
  const [inviteAdmin, { isLoading: inviting }] = useInviteOrgAdminMutation();

  // Invite-admin dialog state
  const [inviteFor, setInviteFor] = useState<Organization | null>(null);
  const [inviteForm, setInviteForm] = useState({ email: "", first_name: "", last_name: "" });
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "atlimit">("all");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);

  /* ── derived ── */
  const atLimit = (o: Organization) =>
    o.candidate_limit != null && (o.candidates_count ?? 0) >= o.candidate_limit;

  const stats = useMemo(
    () => ({
      total: orgs.length,
      active: orgs.filter((o) => o.is_active).length,
      inactive: orgs.filter((o) => !o.is_active).length,
      atLimit: orgs.filter(atLimit).length,
    }),
    [orgs]
  );

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    return orgs.filter((o) => {
      const matchesText =
        !t ||
        o.name.toLowerCase().includes(t) ||
        (o.organization_type || "").toLowerCase().includes(t) ||
        (o.primary_email || "").toLowerCase().includes(t);
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && o.is_active) ||
        (filter === "inactive" && !o.is_active) ||
        (filter === "atlimit" && atLimit(o));
      return matchesText && matchesFilter;
    });
  }, [orgs, search, filter]);

  /* ── actions ── */
  const openRegister = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setError(null);
    setOpen(true);
  };

  const openEdit = (o: Organization) => {
    setEditingId(o.id);
    setForm({
      name: o.name || "",
      organization_type: o.organization_type || ORG_TYPES[0],
      primary_email: o.primary_email || "",
      phone: o.phone || "",
      website: o.website || "",
      description: o.description || "",
      candidate_limit: o.candidate_limit == null ? "" : String(o.candidate_limit),
      enabled: o.is_active,
    });
    setError(null);
    setOpen(true);
  };

  const toggleEnabled = async (o: Organization) => {
    setTogglingId(o.id);
    try {
      await updateOrg({ id: o.id, data: { status: o.is_active ? "Inactive" : "Active" } }).unwrap();
    } catch {
      /* surfaced via refetch; keep silent inline */
    } finally {
      setTogglingId(null);
    }
  };

  const submit = async () => {
    if (!form.name.trim()) return setError("Organization name is required.");
    if (form.candidate_limit !== "" && (!/^\d+$/.test(form.candidate_limit) || Number(form.candidate_limit) < 1))
      return setError("Candidate limit must be a positive number (or empty for unlimited).");

    const payload: Partial<Organization> = {
      name: form.name.trim(),
      organization_type: form.organization_type,
      primary_email: form.primary_email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
      status: form.enabled ? "Active" : "Inactive",
      candidate_limit: form.candidate_limit === "" ? null : Number(form.candidate_limit),
    };

    try {
      if (editingId == null) await createOrg(payload).unwrap();
      else await updateOrg({ id: editingId, data: payload }).unwrap();
      setOpen(false);
    } catch (e) {
      setError(errMessage(e));
    }
  };

  const onDelete = async () => {
    if (editingId == null) return;
    try {
      await deleteOrg(editingId).unwrap();
      setOpen(false);
    } catch (e) {
      setError(errMessage(e));
    }
  };

  const openInvite = (o: Organization) => {
    setInviteFor(o);
    setInviteForm({ email: "", first_name: "", last_name: "" });
    setInviteLink(null);
    setInviteSent(false);
    setInviteError(null);
    setCopied(false);
  };

  const submitInvite = async () => {
    if (!inviteFor) return;
    if (!inviteForm.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(inviteForm.email))
      return setInviteError("A valid email is required.");
    try {
      const res = await inviteAdmin({ id: inviteFor.id, data: inviteForm }).unwrap();
      setInviteLink(res.invite_link);
      setInviteSent(!!res.email_sent);
      setInviteError(null);
    } catch (e) {
      setInviteError(errMessage(e));
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  };

  const setField = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const FILTERS: { value: typeof filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "atlimit", label: "At limit" },
  ];

  return (
    <AdminLayout>
      <div className="w-full">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 pb-10 md:px-8">
          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn("flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white p-5 sm:flex-row sm:items-center sm:justify-between", CARD_SHADOW)}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-md">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={PAGE_TITLE}>Organizations</h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-purple to-brand-violet px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Crown className="h-3 w-3" /> Super Admin
                  </span>
                </div>
                <p className="text-sm text-slate-500">Register tenants, toggle access, and set candidate invite limits.</p>
              </div>
            </div>
            <button className={BTN_PRIMARY} onClick={openRegister}>
              <Plus className="h-4 w-4" /> Register Organization
            </button>
          </motion.div>

          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard index={0} label="Total Organizations" value={stats.total} icon={Building2} gradient="from-brand-purple to-brand-violet" tone="violet" onClick={() => setFilter("all")}/>
            <StatCard index={1} label="Active" value={stats.active} icon={ShieldCheck} gradient="from-[#0e9f6e] to-[#23c366]" tone="emerald" onClick={() => setFilter("active")} />
            <StatCard index={2} label="Inactive" value={stats.inactive} icon={ShieldOff} gradient="from-[#4338ca] to-[#6366f1]" tone="indigo" onClick={() => setFilter("inactive")} />
            <StatCard index={3} label="At Invite Limit" value={stats.atLimit} icon={AlertTriangle} gradient="from-[#ff5a1f] to-[#ff8a4c]" tone="orange" onClick={() => setFilter("atlimit")} />
          </div>

          {/* ── Toolbar + table ── */}
          <SurfaceCard shadow="deep" className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 text-sm">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 font-medium transition-colors",
                      filter === f.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, type, email…"
                  className={cn(INPUT_CLASS, "h-9 w-full pl-9 lg:w-72")}
                />
              </div>
            </div>

            {/* states */}
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading organizations…
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-16 text-sm text-slate-500">
                Couldn’t load organizations.
                <button className={cn(BTN_OUTLINE, "h-9")} onClick={() => refetch()}>Retry</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 font-semibold">Organization</th>
                      <th className="px-3 py-3 font-semibold">Type</th>
                      <th className="px-3 py-3 font-semibold">Invite Limit</th>
                      <th className="px-3 py-3 font-semibold">Status</th>
                      <th className="px-3 py-3 text-center font-semibold">Enabled</th>
                      <th className="px-5 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => {
                      const used = o.candidates_count ?? 0;
                      const unlimited = o.candidate_limit == null;
                      const usage = unlimited || o.candidate_limit === 0 ? 0 : Math.min(100, Math.round((used / o.candidate_limit!) * 100));
                      const near = !unlimited && usage >= 90;
                      return (
                        <tr key={o.id} className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-xs font-bold text-white">
                                {o.name.slice(0, 2).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">{o.name}</p>
                                <p className="truncate text-xs text-slate-400">{o.primary_email || `/${o.slug}`}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{o.organization_type}</td>
                          <td className="px-3 py-3">
                            {unlimited ? (
                              <span className="text-xs font-medium text-slate-400">Unlimited</span>
                            ) : (
                              <div className="w-36">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={cn("font-semibold tabular-nums", near ? "text-rose-600" : "text-slate-700")}>
                                    {used.toLocaleString()} / {o.candidate_limit!.toLocaleString()}
                                  </span>
                                  {near && <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />}
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <span className={cn("block h-full rounded-full", near ? "bg-rose-500" : "bg-gradient-to-r from-brand-purple to-brand-violet")} style={{ width: `${usage}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_BADGE(o.is_active))}>
                              {o.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex justify-center">
                              <Toggle
                                checked={o.is_active}
                                disabled={togglingId === o.id}
                                onChange={() => toggleEnabled(o)}
                                label={`Toggle ${o.name}`}
                              />
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openInvite(o)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-brand-violet transition-colors hover:bg-violet-100"
                              >
                                <UserPlus className="h-3.5 w-3.5" /> Invite admin
                              </button>
                              <button
                                onClick={() => openEdit(o)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Manage
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                          {orgs.length === 0 ? "No organizations yet — register your first one." : "No organizations match your filters."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>

      {/* ── Register / Manage dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId == null ? "Register Organization" : "Manage Organization"}</DialogTitle>
            <DialogDescription>
              {editingId == null
                ? "Create a new tenant and set its candidate invite limit."
                : "Update details, candidate invite limit, and enable/disable access."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL_SM_CLASS}>Organization name *</label>
              <input className={INPUT_CLASS} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Acme Technologies" />
            </div>
            <div>
              <label className={LABEL_SM_CLASS}>Type</label>
              <select className={SELECT_CLASS} value={form.organization_type} onChange={(e) => setField("organization_type", e.target.value)}>
                {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL_SM_CLASS}>Primary email</label>
              <input className={INPUT_CLASS} value={form.primary_email} onChange={(e) => setField("primary_email", e.target.value)} placeholder="admin@acme.io" />
            </div>
            <div>
              <label className={LABEL_SM_CLASS}>Phone</label>
              <input className={INPUT_CLASS} value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+1 415 555 0100" />
            </div>
            <div>
              <label className={LABEL_SM_CLASS}>Website</label>
              <input className={INPUT_CLASS} value={form.website} onChange={(e) => setField("website", e.target.value)} placeholder="https://acme.io" />
            </div>

            {/* Candidate invite limit — the key control */}
            <div className="sm:col-span-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3">
              <label className={cn(LABEL_SM_CLASS, "flex items-center gap-1.5")}>
                <Users className="h-3.5 w-3.5 text-brand-violet" /> Candidate invite limit
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  min={1}
                  className={cn(INPUT_CLASS, "w-32")}
                  value={form.candidate_limit}
                  onChange={(e) => setField("candidate_limit", e.target.value)}
                  placeholder="Unlimited"
                />
                <span className="text-xs text-slate-500">Leave empty for unlimited.</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_SM_CLASS}>Description</label>
              <textarea className={cn(TEXTAREA_CLASS, "min-h-[64px]")} value={form.description} onChange={(e) => setField("description", e.target.value)} placeholder="Short description…" />
            </div>

            {/* Access toggle */}
            <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-slate-700">Access</p>
                <p className="text-xs text-slate-500">{form.enabled ? "Enabled — candidates can be invited and assessed." : "Disabled — no access."}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_BADGE(form.enabled))}>{form.enabled ? "Active" : "Inactive"}</span>
                <Toggle checked={form.enabled} onChange={(v) => setField("enabled", v)} label="Enable organization" />
              </div>
            </div>
          </div>

          {error && <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}

          <DialogFooter className="mt-2 flex items-center gap-2 sm:justify-between">
            {editingId != null ? (
              <button className={cn(BTN_DANGER, "mr-auto")} onClick={onDelete} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button className={BTN_OUTLINE} onClick={() => setOpen(false)}>Cancel</button>
              <button className={BTN_PRIMARY} onClick={submit} disabled={creating || updating}>
                {(creating || updating) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId == null ? "Register" : "Save changes"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite admin dialog ── */}
      <Dialog open={inviteFor != null} onOpenChange={(v) => !v && setInviteFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite administrator</DialogTitle>
            <DialogDescription>
              {inviteFor ? <>Create the admin for <b>{inviteFor.name}</b>. They'll set their own password via the link.</> : null}
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <div className={cn("flex items-start gap-2 rounded-xl border p-3 text-sm", inviteSent ? "border-emerald-200 bg-emerald-50/70 text-emerald-700" : "border-amber-200 bg-amber-50/70 text-amber-700")}>
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Invite created for <b>{inviteForm.email}</b>.{" "}
                  {inviteSent ? "We emailed them the link — you can also share it directly:" : "Email couldn't be sent from this server, so share this link directly:"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteLink} className={cn(INPUT_CLASS, "flex-1 text-xs")} onFocus={(e) => e.currentTarget.select()} />
                <button className={cn(BTN_OUTLINE, "h-10 shrink-0")} onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-400">Link expires in 7 days.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={LABEL_SM_CLASS}>Admin email *</label>
                <input className={INPUT_CLASS} value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@acme.io" />
              </div>
              <div>
                <label className={LABEL_SM_CLASS}>First name</label>
                <input className={INPUT_CLASS} value={inviteForm.first_name} onChange={(e) => setInviteForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Jane" />
              </div>
              <div>
                <label className={LABEL_SM_CLASS}>Last name</label>
                <input className={INPUT_CLASS} value={inviteForm.last_name} onChange={(e) => setInviteForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Doe" />
              </div>
            </div>
          )}

          {inviteError && <p className="mt-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{inviteError}</p>}

          <DialogFooter className="mt-2 flex gap-2">
            <button className={BTN_OUTLINE} onClick={() => setInviteFor(null)}>{inviteLink ? "Done" : "Cancel"}</button>
            {!inviteLink && (
              <button className={BTN_PRIMARY} onClick={submitInvite} disabled={inviting}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />} Send invite
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default OrganizationsManagement;
