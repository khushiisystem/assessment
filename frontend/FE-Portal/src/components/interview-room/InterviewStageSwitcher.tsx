import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Code2, Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StageMode = "chat" | "code" | "end";

/** Standardized fade+rise transition for stage swaps. */
const STAGE_VARIANTS = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const STAGE_TRANSITION = { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const };

/** Placeholder block — replaced in subsequent commits as each mode gets implemented. */
const StagePlaceholder: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  tone: "violet" | "indigo" | "emerald";
}> = ({ icon: Icon, title, hint, tone }) => {
  const ringCls =
    tone === "violet"
      ? "from-brand-purple to-brand-violet"
      : tone === "indigo"
        ? "from-indigo-500 to-indigo-600"
        : "from-emerald-500 to-emerald-600";

  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <span
          className={cn(
            "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md",
            ringCls
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-500">{hint}</p>
      </div>
    </div>
  );
};

export interface InterviewStageSwitcherProps {
  mode: StageMode;
  /** Premium variant exposes Code mode; Regular only ever swaps between Chat → End. */
  variant?: "regular" | "premium";
  /** Optional override slots — implementations land in subsequent commits. */
  chatSlot?: React.ReactNode;
  codeSlot?: React.ReactNode;
  endSlot?: React.ReactNode;
}

export const InterviewStageSwitcher: React.FC<InterviewStageSwitcherProps> = ({
  mode,
  variant = "regular",
  chatSlot,
  codeSlot,
  endSlot,
}) => {
  // Premium-only guard: silently fall back to chat if a regular-variant page is
  // asked to render code mode (defensive — shouldn't happen in normal flow).
  const effectiveMode: StageMode = mode === "code" && variant !== "premium" ? "chat" : mode;

  return (
    <main role="main" className="relative flex-1 overflow-hidden bg-slate-50/70">
      <AnimatePresence mode="wait">
        <motion.section
          key={effectiveMode}
          variants={STAGE_VARIANTS}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={STAGE_TRANSITION}
          className="h-full"
        >
          {effectiveMode === "chat" && (
            chatSlot ?? (
              <StagePlaceholder
                icon={MessageSquare}
                title="Conversation"
                hint="The AI interviewer asks one question at a time. Voice and text inputs live here in commit #2."
                tone="violet"
              />
            )
          )}

          {effectiveMode === "code" && (
            codeSlot ?? (
              <StagePlaceholder
                icon={Code2}
                title="Coding workspace"
                hint="The AI pivots to a problem-solving prompt with a live editor and terminal. Premium-only. Implemented in commit #5."
                tone="indigo"
              />
            )
          )}

          {effectiveMode === "end" && (
            endSlot ?? (
              <StagePlaceholder
                icon={CheckCircle2}
                title="Interview complete"
                hint="Summary and submission flow lands in commit #6. Auto-redirects to dashboard."
                tone="emerald"
              />
            )
          )}
        </motion.section>
      </AnimatePresence>
    </main>
  );
};

/** Floating dev-only switcher — visible only in dev mode so the shell can be eyeballed without a live session. */
export const DevModeSwitcher: React.FC<{
  mode: StageMode;
  variant: "regular" | "premium";
  onChange: (m: StageMode) => void;
}> = ({ mode, variant, onChange }) => {
  if (!import.meta.env.DEV) return null;
  const items: { mode: StageMode; label: string; icon: React.ComponentType<{ className?: string }>; premiumOnly?: boolean }[] = [
    { mode: "chat", label: "Chat", icon: MessageSquare },
    { mode: "code", label: "Code", icon: Code2, premiumOnly: true },
    { mode: "end", label: "End", icon: Sparkles },
  ];
  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-lg backdrop-blur">
      {items.map((i) => {
        const Icon = i.icon;
        const disabled = i.premiumOnly && variant !== "premium";
        const active = mode === i.mode;
        return (
          <button
            key={i.mode}
            type="button"
            onClick={() => onChange(i.mode)}
            disabled={disabled}
            title={disabled ? "Premium only" : `Switch to ${i.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all",
              active
                ? "bg-gradient-to-r from-brand-purple to-brand-violet text-white shadow"
                : "text-slate-600 hover:bg-slate-100",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
            )}
          >
            <Icon className="h-3 w-3" />
            {i.label}
          </button>
        );
      })}
    </div>
  );
};
