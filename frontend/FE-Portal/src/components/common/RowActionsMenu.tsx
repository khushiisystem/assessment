import React from "react";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Three-dot (kebab) row-action menu — the shared pattern used across admin
 * data tables (Candidates, Courses, Mock Interviews, Results, …).
 * Pass `DropdownMenuItem`s (icon + text) as children.
 */
export function RowActionsMenu({
  children,
  align = "end",
  className,
  contentClassName,
  label = "Row actions",
}: {
  children: React.ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  contentClassName?: string;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-brand-violet/40 hover:bg-violet-50 hover:text-brand-violet focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/50 data-[state=open]:border-brand-violet/40 data-[state=open]:bg-violet-50 data-[state=open]:text-brand-violet",
            className
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("w-52", contentClassName)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
