import React from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TableRowActionItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  destructive?: boolean;
  disabled?: boolean;
};

type TableRowActionsProps = {
  viewLabel?: string;
  viewItems: TableRowActionItem[];
  moreItems?: TableRowActionItem[];
  className?: string;
};

export function TableRowActions({
  viewLabel = "View",
  viewItems,
  moreItems = [],
  className,
}: TableRowActionsProps) {
  return (
    <div className={cn("flex items-center justify-end gap-1.5", className)}>
      {viewItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 gap-1 rounded-lg bg-blue-600 px-2 text-xs text-white hover:bg-blue-700"
              onClick={(e) => e.stopPropagation()}
            >
              {viewLabel}
              <ChevronDown className="h-4 w-4 opacity-90" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {viewItems.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick(e);
                }}
                className={cn(item.destructive && "text-red-600 focus:text-red-600")}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {moreItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg border-gray-200"
              onClick={(e) => e.stopPropagation()}
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4 text-gray-700" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {moreItems.map((item) => (
              <DropdownMenuItem
                key={item.label}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick(e);
                }}
                className={cn(item.destructive && "text-red-600 focus:text-red-600")}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

type TableRowIconButtonProps = {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** Single outline icon action (e.g. view result) matching candidate row controls */
export function TableRowIconButton({
  title,
  onClick,
  disabled,
  children,
  className,
}: TableRowIconButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      title={title}
      disabled={disabled}
      className={cn(
        "h-7 w-7 shrink-0 rounded-lg border-gray-200",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </Button>
  );
}
