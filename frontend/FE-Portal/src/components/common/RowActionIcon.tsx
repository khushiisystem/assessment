import React from "react";
import { cn } from "@/lib/utils";

/**
 * App-wide compact icon-only action button for table row "Actions" cells.
 * Uses a native title tooltip so it needs no TooltipProvider ancestor.
 * Used across candidates, assessments and results tables for a consistent look.
 */
export function RowActionIcon({
  label,
  onClick,
  className,
  disabled,
  children,
}: {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick(e);
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
        className
      )}
    >
      {children}
    </button>
  );
}
