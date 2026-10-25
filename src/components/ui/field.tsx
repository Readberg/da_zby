import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx("block text-sm font-medium text-ink", className)} {...props} />;
}

const controlBase =
  "w-full rounded-md border bg-bg px-4 text-base text-ink placeholder:text-muted hover:border-muted focus-visible:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/60 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";

const controlBorder = (invalid?: boolean) => (invalid ? "border-danger" : "border-line");

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ invalid, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx("min-h-11", controlBase, controlBorder(invalid), className)}
      {...props}
    />
  );
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ invalid, className, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx("min-h-28 py-2", controlBase, controlBorder(invalid), className)}
      {...props}
    />
  );
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export function Select({ invalid, className, ...props }: SelectProps) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx("min-h-11", controlBase, controlBorder(invalid), className)}
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

type ShellProps = {
  id: string;
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
};

/** Label + control + hint/error wired together for screen readers. */
function FieldShell({
  id,
  label,
  error,
  hint,
  className,
  control,
}: ShellProps & {
  control: (props: {
    id: string;
    invalid: boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      {control({
        id,
        invalid: Boolean(error),
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {errorId && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export type TextFieldProps = Omit<InputProps, "id" | "invalid"> & ShellProps;

export function TextField({ id, label, error, hint, className, ...props }: TextFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      className={className}
      control={(control) => <Input {...control} {...props} />}
    />
  );
}

export type TextareaFieldProps = Omit<TextareaProps, "id" | "invalid"> & ShellProps;

export function TextareaField({ id, label, error, hint, className, ...props }: TextareaFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      className={className}
      control={(control) => <Textarea {...control} {...props} />}
    />
  );
}

export type SelectFieldProps = Omit<SelectProps, "id" | "invalid"> & ShellProps;

export function SelectField({
  id,
  label,
  error,
  hint,
  className,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      error={error}
      hint={hint}
      className={className}
      control={(control) => (
        <Select {...control} {...props}>
          {children}
        </Select>
      )}
    />
  );
}
