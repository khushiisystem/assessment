import React from "react";
import { Info, Calendar, Clock, ListChecks } from "lucide-react";
import { Assessment } from "./AssessmentDetailsTypes";
import { SurfaceCard } from "@/components/common/SurfaceCard";

interface AssessmentOverviewCardProps {
  assessment: Assessment;
  formatDate: (dateString: string) => string;
  formatDuration: (minutes: number) => string;
  getStatusColor: (status: Assessment["status"]) => string;
  getStatusDisplay: (status: Assessment["status"]) => string;
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-brand-violet">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

export const AssessmentOverviewCard: React.FC<AssessmentOverviewCardProps> = ({
  assessment,
  formatDate,
  formatDuration,
  getStatusColor,
  getStatusDisplay,
}) => {
  return (
    <SurfaceCard overflowHidden>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
          <Info className="h-5 w-5" />
        </span>
        <h2 className="text-base font-bold tracking-tight text-slate-900">Assessment Details</h2>
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Description</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">
            {assessment.description || "No description"}
          </p>
        </div>

        <Detail icon={Clock} label="Duration" value={formatDuration(assessment.duration)} />
        <Detail icon={ListChecks} label="Total Questions" value={String(assessment.question_ids.length)} />
        <Detail icon={Calendar} label="Start Date" value={formatDate(assessment.start_date)} />
        <Detail icon={Calendar} label="End Date" value={formatDate(assessment.end_date)} />

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</p>
          <span
            className={`mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(
              assessment.status
            )}`}
          >
            {getStatusDisplay(assessment.status)}
          </span>
        </div>
      </div>
    </SurfaceCard>
  );
};
