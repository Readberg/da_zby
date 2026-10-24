import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx("block text-sm font-semibold text-ink", className)} {...props} />;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(
        "min-h-11 w-full rounded-sm border-2 bg-bg px-3 text-base text-ink placeholder:text-muted",
        "focus-visible:border-ink disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted",
        invalid ? "border-danger" : "border-ink",
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger">
      {children}
    </p>
  );
}

export type TextFieldProps = Omit<InputProps, "id" | "invalid"> & {
  id: string;
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
};

/** Label + input + hint/error wired together for screen readers. */
export function TextField({ id, label, error, hint, className, ...props }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        invalid={Boolean(error)}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
