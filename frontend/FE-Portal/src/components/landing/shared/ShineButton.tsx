import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ShineButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-lg hover:shadow-xl",
  secondary: "bg-white text-zinc-900 border-2 border-zinc-900 hover:bg-zinc-50",
  outline: "bg-transparent text-white border border-white/30 hover:bg-white/10 backdrop-blur-sm",
  ghost: "bg-transparent text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100",
};

const sizes = {
  sm: "px-5 py-2 text-sm",
  md: "px-7 py-3 text-sm",
  lg: "px-8 py-3.5 text-base",
};

export const ShineButton = ({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ShineButtonProps) => (
  <button
    type="button"
    className={cn(
      "group relative inline-flex items-center justify-center rounded-full font-semibold tracking-tight overflow-hidden transition-all duration-300",
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    <span className="relative z-10">{children}</span>
    {variant === "primary" && (
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
    )}
  </button>
);
