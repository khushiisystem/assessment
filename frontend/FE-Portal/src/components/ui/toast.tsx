import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-4 right-4 z-[100] flex max-h-screen w-full flex-col gap-2.5 outline-none md:max-w-[380px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const toastVariants = cva(
  cn(
    // base
    "group/toast pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border bg-white/85 px-4 py-3 pr-9",
    "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_38px_-18px_rgba(61,7,95,0.35)]",
    "backdrop-blur-xl backdrop-saturate-150",
    "transition-all duration-300",
    // animation
    "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
  ),
  {
    variants: {
      variant: {
        default: "border-slate-200/60 text-slate-900",
        destructive: "border-rose-200/70 text-rose-900",
        success: "border-emerald-200/70 text-emerald-900",
        info: "border-sky-200/70 text-sky-900",
        warning: "border-amber-200/70 text-amber-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & VariantProps<typeof toastVariants>
>(({ className, variant = "default", ...props }, ref) => {
  return (
    <ToastPrimitives.Root ref={ref} className={cn(toastVariants({ variant }), className)} {...props}>
      {/* Left tone accent strip */}
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1 rounded-l-2xl", TONE_BAR[variant ?? "default"])} />
      {/* Decorative top hairline */}
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-px", TONE_HAIRLINE[variant ?? "default"])} />
      {props.children}
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

export const TONE_BAR: Record<NonNullable<VariantProps<typeof toastVariants>["variant"]>, string> = {
  default: "bg-gradient-to-b from-brand-purple via-brand-violet to-brand-purple",
  destructive: "bg-gradient-to-b from-rose-500 via-rose-600 to-rose-500",
  success: "bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-500",
  info: "bg-gradient-to-b from-sky-500 via-sky-600 to-sky-500",
  warning: "bg-gradient-to-b from-amber-400 via-amber-500 to-amber-400",
};

export const TONE_HAIRLINE: Record<NonNullable<VariantProps<typeof toastVariants>["variant"]>, string> = {
  default: "bg-gradient-to-r from-transparent via-brand-violet/30 to-transparent",
  destructive: "bg-gradient-to-r from-transparent via-rose-500/30 to-transparent",
  success: "bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent",
  info: "bg-gradient-to-r from-transparent via-sky-500/30 to-transparent",
  warning: "bg-gradient-to-r from-transparent via-amber-500/30 to-transparent",
};

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white px-3 text-xs font-semibold text-slate-700 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-violet/40 hover:text-brand-violet hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-violet/40 disabled:pointer-events-none disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-all duration-200 hover:bg-slate-100/70 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-violet/40",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-3.5 w-3.5" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-[13px] font-bold leading-tight tracking-tight", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-[12px] leading-relaxed text-slate-600", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>;

type ToastActionElement = React.ReactElement<typeof ToastAction>;

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
};
