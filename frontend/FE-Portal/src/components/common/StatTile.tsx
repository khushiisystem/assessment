import React from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Compact metric tile with an optional info tooltip. Used on the results
 * dashboards so each number has a plain-language explanation. Needs a
 * <TooltipProvider> ancestor (the ui/tooltip provider).
 */
export function StatTile({
  icon,
  value,
  label,
  hint,
  className,
  valueClassName,
}: {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl p-3 text-center", className)}>
      <div className="mb-1 flex items-center justify-center gap-1.5">
        {icon}
        <span className={cn("text-lg font-bold", valueClassName)}>{value}</span>
      </div>
      <div className="flex items-center justify-center gap-1 text-xs font-medium">
        <span>{label}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`About ${label}`}
                className="text-slate-400 transition-colors hover:text-slate-600"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px] text-xs leading-snug">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
