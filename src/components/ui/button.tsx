import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cx } from "@/lib/cx";

export type ButtonVariant = "primary" | "secondary" | "text";

const base =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition-[color,background-color,transform,opacity,box-shadow] duration-200 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-black hover:brightness-95 hover:shadow-soft",
  secondary: "bg-ink text-bg hover:bg-ink/85",
  text: "rounded-sm px-1 text-ink underline underline-offset-4 hover:decoration-2",
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
