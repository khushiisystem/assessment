import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { CARD_SHADOW, CARD_SHADOW_DEEP } from "@/lib/uiStyles";

type Rounded = "xl" | "2xl" | "3xl";
type Shadow = "default" | "deep" | "none";

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Corner radius — `2xl` for content panels (default), `3xl` for hero/feature blocks. */
  rounded?: Rounded;
  /** Soft brand-tinted shadow — `default` (panels), `deep` (list containers), or `none`. */
  shadow?: Shadow;
  /** Add `overflow-hidden` (common for cards with bordered children that need clipping). */
  overflowHidden?: boolean;
}

const ROUNDED_CLASS: Record<Rounded, string> = {
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

const SHADOW_CLASS: Record<Shadow, string> = {
  default: CARD_SHADOW,
  deep: CARD_SHADOW_DEEP,
  none: "",
};

/**
 * Canonical content-surface card. Encapsulates the standard
 * `rounded-* border border-slate-200/70 bg-white ${shadow}` pattern so pages
 * don't repeat the raw class string.
 *
 * Forwards extra props to the underlying `<div>` (id, onClick, role, etc.).
 */
export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  ({ rounded = "2xl", shadow = "default", overflowHidden = false, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        ROUNDED_CLASS[rounded],
        "border border-slate-200/70 bg-white",
        SHADOW_CLASS[shadow],
        overflowHidden && "overflow-hidden",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  )
);
SurfaceCard.displayName = "SurfaceCard";
