import React from "react";
import { Check, CheckCircle2, Loader2, PlusCircle, Search, Upload, UserMinus, Users, X } from "lucide-react";

export interface WizardCandidate {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
}

export interface WizardCandidateStepProps {
  candidates: WizardCandidate[];
  loading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onAssign: () => void;
  assigning: boolean;
  /** Candidate ids already assigned to this assessment — shown as "Assigned" with an Unassign action. */
  assignedIds?: number[];
  /** Unassign an already-assigned candidate (by candidate id). When omitted, no unassign control is shown. */
  onUnassign?: (candidateId: number) => void;
  unassigning?: boolean;
}

/**
 * Candidate search + checkbox list + Assign action shared by both wizards.
 * Includes a disabled "Upload CSV (coming soon)" affordance.
 */
export const WizardCandidateStep: React.FC<WizardCandidateStepProps> = ({
  candidates,
  loading,
  search,
  onSearchChange,
  selectedIds,
  onToggle,
  onToggleAll,
  onAssign,
  assigning,
  assignedIds = [],
  onUnassign,
  unassigning = false,
}) => {
  // "Select All" and counts must only consider candidates that can still be
  // assigned — already-assigned ones are locked and never selectable.
  const assignable = candidates.filter((c) => !assignedIds.includes(c.id));
  const assignedVisibleCount = candidates.length - assignable.length;
  const allSelected =
    assignable.length > 0 && assignable.every((c) => selectedIds.includes(c.id));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="h-4 w-4 text-brand-violet" />
          Assign Candidates
        </h2>
        <span className="text-xs text-slate-500">
          {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${assignable.length} candidate(s)`}
          {assignedVisibleCount > 0 && (
            <span className="text-slate-400"> · {assignedVisibleCount} assigned</span>
          )}
        </span>
      </div>

      {/* Search + select all + CSV (coming soon) */}
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleAll}
          disabled={loading || assignable.length === 0}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {allSelected ? (
            <>
              <X className="h-3.5 w-3.5" />
              Deselect All
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Select All
            </>
          )}
        </button>

        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload CSV (coming soon)
        </button>
      </div>

      {/* Candidate list — two columns, tall enough to show ~15 at once */}
      <div className="max-h-[30rem] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-violet" />
            <p className="text-xs text-slate-500">Loading candidates…</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="py-8 text-center">
            <Search className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs text-slate-500">No candidates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {candidates.map((candidate) => {
              const fullName = `${candidate.first_name || ""} ${candidate.last_name || ""}`.trim();
              const isAssigned = assignedIds.includes(candidate.id);

              // Already-assigned candidates show an "Assigned" badge plus an
              // Unassign control (when onUnassign is provided).
              if (isAssigned) {
                return (
                  <div
                    key={candidate.id}
                    className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5"
                  >
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">
                        {fullName || candidate.username}
                      </p>
                      <p className="truncate text-xs text-slate-500">{candidate.email}</p>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      Assigned
                    </span>
                    {onUnassign && (
                      <button
                        type="button"
                        onClick={() => onUnassign(candidate.id)}
                        disabled={unassigning}
                        title="Unassign candidate"
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              }

              const isSelected = selectedIds.includes(candidate.id);
              return (
                <label
                  key={candidate.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 transition-colors ${
                    isSelected ? "border-violet-200 bg-violet-50/40" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(candidate.id)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-violet"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {fullName || candidate.username}
                    </p>
                    <p className="truncate text-xs text-slate-500">{candidate.email}</p>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAssign}
        disabled={selectedIds.length === 0 || assigning}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {assigning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Assigning…
          </>
        ) : (
          <>
            <PlusCircle className="h-3.5 w-3.5" />
            Assign Selected ({selectedIds.length})
          </>
        )}
      </button>
      <p className="mt-2 text-xs text-slate-400">
        Assign from the existing candidate pool now. Bulk CSV upload is coming soon.
      </p>
    </div>
  );
};
