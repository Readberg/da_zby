import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "text";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 font-display text-base font-bold uppercase tracking-wide cursor-pointer transition-[color,background-color,transform,opacity] duration-200 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-md border-2 border-ink bg-accent px-5 text-ink hover:bg-ink hover:text-accent disabled:hover:bg-accent disabled:hover:text-ink",
  secondary:
    "rounded-md border-2 border-ink bg-ink px-5 text-white hover:bg-bg hover:text-ink disabled:hover:bg-ink disabled:hover:text-white",
  text: "px-1 text-ink underline underline-offset-4 hover:decoration-2 disabled:hover:decoration-1",
};

/** Shared look for <button> and link-like buttons. */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string) {
  return cx(base, variants[variant], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Shows a spinner and blocks repeated clicks while an action is running. */
  loading?: boolean;
};

export function Button({
  variant = "primary",
  className,
  type = "button",
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
