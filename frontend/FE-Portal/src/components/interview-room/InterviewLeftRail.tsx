import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, Keyboard, Lightbulb, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface InterviewLeftRailProps {
  helpOpen: boolean;
  onToggleHelp: () => void;
}

/**
 * Slim 56-px left rail with a single nav item (Help). Designed to grow to at
 * most two items — keeps the immersive feel of the interview room intact while
 * still giving the candidate a quick way to surface rules / shortcuts.
 */
export const InterviewLeftRail: React.FC<InterviewLeftRailProps> = ({
  helpOpen,
  onToggleHelp,
}) => {
  return (
    <>
      {/* Rail */}
      <aside
        aria-label="Interview navigation"
        className="relative z-30 hidden h-full w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-200/60 bg-white/70 py-3 backdrop-blur-xl backdrop-saturate-150 md:flex"
      >
        {/* Decorative gradient hairline along the right edge */}
        <span aria-hidden className="pointer-events-none absolute inset-y-6 right-0 w-px bg-gradient-to-b from-transparent via-brand-violet/25 to-transparent" />
        <NavButton
          icon={HelpCircle}
          label="Help & shortcuts"
          active={helpOpen}
          onClick={onToggleHelp}
        />
      </aside>

      {/* Slide-out panel + backdrop */}
      <AnimatePresence>
        {helpOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm md:left-14"
              onClick={onToggleHelp}
              aria-hidden
            />
            <motion.aside
              key="panel"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-label="Help and shortcuts"
              className="fixed inset-y-16 left-0 z-40 w-full max-w-sm overflow-y-auto border-r border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)] md:left-14"
            >
              <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-sm">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                  <h2 className="text-sm font-bold tracking-tight text-slate-900">Help & shortcuts</h2>
                </div>
                <button
                  type="button"
                  onClick={onToggleHelp}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close help panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <Section icon={ShieldCheck} title="Interview rules" tone="emerald">
                  <li>Stay on this tab — switching away may end the session.</li>
                  <li>Keep your camera on and your face visible.</li>
                  <li>You may pause once if you need a moment.</li>
                  <li>External help (search, AI, notes) isn&apos;t allowed.</li>
                </Section>

                <Section icon={Lightbulb} title="How to answer" tone="violet">
                  <li>Hold the mic button to speak; release to send.</li>
                  <li>Or click <strong>Type</strong> to write your answer.</li>
                  <li>Stuck? Tap <strong>Need a hint?</strong> — costs one hint.</li>
                  <li>Tap <strong>Skip</strong> to move to the next question.</li>
                </Section>

                <Section icon={Keyboard} title="Keyboard shortcuts" tone="amber">
                  <Shortcut keys={["Space"]} text="Push to talk (hold)" />
                  <Shortcut keys={["⏎"]} text="Send typed message" />
                  <Shortcut keys={["P"]} text="Pause / resume" />
                  <Shortcut keys={["?"]} text="Toggle this panel" />
                </Section>

                <p className="text-[11px] text-slate-500">
                  Need a human? Contact your administrator from the dashboard after the interview.
                </p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

/** Single rail icon button. */
const NavButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={active}
    className={cn(
      "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 active:scale-95",
      active
        ? "bg-gradient-to-br from-brand-purple via-brand-purple to-brand-violet text-white shadow-[0_6px_16px_-4px_rgba(124,58,237,0.5)] ring-1 ring-white/20"
        : "text-slate-500 hover:-translate-y-0.5 hover:bg-violet-50/80 hover:text-brand-violet hover:shadow-[0_4px_14px_-4px_rgba(124,58,237,0.35)]"
    )}
  >
    <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
  </button>
);

/** Help-panel section. */
const Section: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tone: "emerald" | "violet" | "amber";
  children: React.ReactNode;
}> = ({ icon: Icon, title, tone, children }) => {
  const toneCls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "violet"
        ? "bg-violet-50 text-brand-violet"
        : "bg-amber-50 text-amber-700";
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h3>
      </div>
      <ul className="space-y-1.5 pl-2 text-sm leading-relaxed text-slate-600 [&_li]:list-disc [&_li]:marker:text-slate-400 [&_li]:ml-3">
        {children}
      </ul>
    </section>
  );
};

/** Single keyboard shortcut row. */
const Shortcut: React.FC<{ keys: string[]; text: string }> = ({ keys, text }) => (
  <li className="flex items-center justify-between gap-3 !list-none !ml-0 py-0.5">
    <span className="text-sm text-slate-600">{text}</span>
    <span className="flex items-center gap-1">
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[11px] font-semibold text-slate-700 shadow-[0_1px_0_rgba(15,23,42,0.06)]"
        >
          {k}
        </kbd>
      ))}
    </span>
  </li>
);
