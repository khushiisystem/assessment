import React from "react";
import { ArrowLeft, Users, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

interface AssessmentHeaderProps {
  title: string;
  onBack: () => void;
  onAssign: () => void;
}

export const AssessmentHeader: React.FC<AssessmentHeaderProps> = ({
  title,
  onBack,
  onAssign,
}) => {
  return (
    <PageHeader
      className="mb-6"
      icon={ClipboardList}
      title={title}
      description="Manage assessment questions, candidates and settings"
      actions={
        <>
          <button
            title="Back to Assessments"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-brand-violet/40 hover:bg-violet-50/60 hover:text-brand-violet"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            title="Assign candidates"
            onClick={onAssign}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-lg hover:brightness-110 active:scale-[0.98]"
          >
            <Users className="h-4 w-4" />
            Assign Candidates
          </button>
        </>
      }
    />
  );
};
