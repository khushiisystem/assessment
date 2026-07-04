import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Optional leading icon rendered in a brand-gradient chip. */
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
  actionsClassName?: string;
}

/**
 * Standard admin page header: brand-gradient icon chip (optional), bold title
 * and muted subtitle, with an actions slot. Used across the Admin module so
 * every page shares the same header look, typography and spacing.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
  contentClassName,
  titleClassName,
  descriptionClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-3", contentClassName)}>
        {Icon ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1 className={cn("text-xl font-bold tracking-tight text-slate-900", titleClassName)}>
            {title}
          </h1>
          {description ? (
            <p className={cn("mt-0.5 text-xs text-slate-500", descriptionClassName)}>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2 sm:justify-end",
            actionsClassName
          )}
        >
          {actions}
        </div>
      ) : null}
    </header>
  );
}
