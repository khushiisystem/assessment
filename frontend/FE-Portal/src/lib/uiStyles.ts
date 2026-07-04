/**
 * Canonical UI design tokens for the admin panel.
 *
 * Single source of truth for form/element styling so every page renders a
 * consistent, modern SaaS-style UI kit. Prefer the shadcn `@/components/ui/*`
 * components where possible; use these class constants for raw elements
 * (native inputs/selects/labels/buttons) that aren't wrapped in a component.
 *
 * Brand: deep purple #3d075f → violet #7c3aed. Radii: inputs/buttons rounded-xl,
 * cards rounded-2xl. Borders: slate-200. Focus ring: #7c3aed/50.
 */

/** Card elevation shadow (soft, brand-tinted). */
export const CARD_SHADOW =
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-18px_rgba(61,7,95,0.35)]";

/** Deeper variant for floating list containers / panels. */
export const CARD_SHADOW_DEEP =
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(61,7,95,0.25)]";

/** Full card surface (rounded-2xl + hairline border + shadow). */
export const CARD_CLASS =
  `rounded-2xl border border-slate-200/70 bg-white ${CARD_SHADOW}`;

/** Standard text input / native select trigger (h-10). */
export const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50 disabled:cursor-not-allowed disabled:bg-slate-50";

/** Native `<select>` (same as input; adds pointer cursor). */
export const SELECT_CLASS = `${INPUT_CLASS} cursor-pointer`;

/** Multiline textarea. */
export const TEXTAREA_CLASS =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/50 disabled:cursor-not-allowed disabled:bg-slate-50";

/** Compact variant for dense forms (text-xs, tighter padding). */
export const INPUT_SM_CLASS =
  "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-violet/40 disabled:cursor-not-allowed disabled:bg-slate-50";

/** Field label. */
export const LABEL_CLASS = "mb-1.5 block text-sm font-semibold text-slate-700";

/** Compact field label (dense forms). */
export const LABEL_SM_CLASS = "mb-1 block text-xs font-semibold text-slate-700";

/** Primary action button (brand gradient). */
export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-purple to-brand-violet px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";

/** Secondary / outline button. */
export const BTN_OUTLINE =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

/** Destructive button. */
export const BTN_DANGER =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60";

/** Page / section heading (h1). */
export const PAGE_TITLE = "text-xl font-bold tracking-tight text-slate-900";

/** Card / section heading (h2). */
export const SECTION_TITLE = "text-base font-bold tracking-tight text-slate-900";

/** Sub-section heading (h3). */
export const SUBSECTION_TITLE = "text-sm font-semibold text-slate-800";

/** Standard page content max-width (use on the outer page container). */
export const PAGE_MAX_WIDTH = "max-w-[1600px]";

/** Alert/severity → container + icon classes (shared across dashboards). */
export const ALERT_STYLE: Record<"danger" | "warn" | "info", { wrap: string; icon: string }> = {
  danger: { wrap: "border-rose-200 bg-rose-50/60", icon: "text-rose-500" },
  warn: { wrap: "border-amber-200 bg-amber-50/60", icon: "text-amber-500" },
  info: { wrap: "border-sky-200 bg-sky-50/60", icon: "text-sky-500" },
};

/** Soft tone chip (icon bubble) backgrounds — shared activity/feed styling. */
export const ACTIVITY_TONE: Record<string, string> = {
  violet: "bg-violet-100 text-violet-600",
  sky: "bg-sky-100 text-sky-600",
  emerald: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
};

/** Difficulty → badge classes (easy/medium/hard). */
export const DIFFICULTY_BADGE: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-rose-100 text-rose-700",
};
