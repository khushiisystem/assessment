import { CheckCircle2, AlertTriangle, AlertCircle, Info, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

const TONE_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Sparkles,
  destructive: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const TONE_ICON_BG: Record<ToastVariant, string> = {
  default: "bg-gradient-to-br from-brand-purple to-brand-violet text-white shadow-[0_4px_12px_-2px_rgba(124,58,237,0.45)] ring-1 ring-white/20",
  destructive: "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_4px_12px_-2px_rgba(244,63,94,0.45)] ring-1 ring-white/20",
  success: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_4px_12px_-2px_rgba(16,185,129,0.45)] ring-1 ring-white/20",
  info: "bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-[0_4px_12px_-2px_rgba(14,165,233,0.45)] ring-1 ring-white/20",
  warning: "bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-[0_4px_12px_-2px_rgba(245,158,11,0.45)] ring-1 ring-white/20",
};

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const tone = (variant ?? "default") as ToastVariant;
        const Icon = TONE_ICON[tone];
        return (
          <Toast key={id} variant={variant} {...props}>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                TONE_ICON_BG[tone],
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
              {action && <div className="mt-1.5">{action}</div>}
            </div>
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
