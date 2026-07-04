import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Users, ChevronDown, ArrowRight, Layers } from "lucide-react";
import { TechnologyIcon } from "@/components/TechnologyIcon.js";
import { cn } from "@/lib/utils";
import { themeForCategory, labelForCategory } from "@/components/dashboard/courseTheme";

interface TechnologyCardProps {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  assignedUsersCount: number;
  level?: string;
  category?: string;
  index?: number;
  onClick: (id: string) => void;
}

const DetailRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <span className="flex items-center gap-1.5 text-slate-500">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      {label}
    </span>
    <span className="truncate font-semibold capitalize text-slate-700">{value}</span>
  </div>
);

const TechnologyCard = ({
  id,
  name,
  description,
  questionCount,
  assignedUsersCount,
  level,
  category,
  index = 0,
  onClick,
}: TechnologyCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const theme = themeForCategory(category);
  const CategoryIcon = theme.icon;
  const categoryLabel = labelForCategory(category);
  const hasDescription = Boolean(description && description.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.25), ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative self-start overflow-hidden rounded-xl border bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300",
        expanded
          ? "border-brand-violet/30 shadow-[0_10px_28px_-16px_rgba(61,7,95,0.4)]"
          : "border-slate-200/80 hover:border-brand-violet/30 hover:shadow-[0_8px_22px_-14px_rgba(61,7,95,0.35)]"
      )}
    >
      {/* category-tinted left accent */}
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1 bg-gradient-to-b", theme.gradient)} />

      {/* ===== Compact header (click to expand) ===== */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 pl-4 text-left"
      >
        {/* icon tile */}
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-300 group-hover:scale-105",
            theme.soft,
            theme.ring,
            theme.text
          )}
        >
          <TechnologyIcon name={name} size={26} fallbackMonogram />
        </span>

        {/* name + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-bold text-slate-900">{name}</h3>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-300",
                expanded && "rotate-180 text-brand-violet"
              )}
            />
          </div>
          <div className="mt-1 flex items-center gap-2.5 text-xs text-slate-500">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset",
                theme.soft,
                theme.text,
                theme.ring
              )}
            >
              <CategoryIcon className="h-3 w-3" />
              {categoryLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">{questionCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">{assignedUsersCount}</span>
            </span>
          </div>
        </div>
      </button>

      {/* ===== Expandable detail ===== */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-3 pl-4">
              <div className="border-t border-slate-100 pt-3">
                {hasDescription ? (
                  <p className="text-xs leading-relaxed text-slate-600">{description}</p>
                ) : (
                  <p className="text-xs italic text-slate-300">No description provided</p>
                )}
              </div>

              <div className="space-y-1.5 rounded-lg bg-slate-50/80 p-2.5">
                <DetailRow icon={CategoryIcon} label="Category" value={categoryLabel} />
                {level && <DetailRow icon={Layers} label="Level" value={level} />}
                <DetailRow icon={BookOpen} label="Questions" value={`${questionCount}`} />
                <DetailRow icon={Users} label="Candidates" value={`${assignedUsersCount}`} />
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(id);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-purple px-3 py-2 text-xs font-semibold text-white transition-colors duration-300 hover:bg-[#ff5a1f]"
              >
                Open course
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TechnologyCard;
