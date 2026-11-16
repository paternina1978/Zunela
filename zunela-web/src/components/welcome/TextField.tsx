import type { InputHTMLAttributes } from "react";

type TextFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">;

export function TextField({
  id,
  label,
  hint,
  error,
  value,
  onChange,
  className,
  ...inputProps
}: TextFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className="mb-1.5 block text-sm font-medium text-navy">{label}</span>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`h-11 w-full rounded-xl border bg-white px-3.5 text-sm text-ink outline-none transition-[border,box-shadow] placeholder:text-muted/70 ${
          error
            ? "border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(155,59,50,0.12)]"
            : "border-line focus:border-teal focus:shadow-[0_0_0_3px_rgba(10,111,108,0.14)]"
        } ${className ?? ""}`}
        {...inputProps}
      />
      {hint && !error ? (
        <span id={`${id}-hint`} className="mt-1.5 block text-xs leading-5 text-muted">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="mt-1.5 block text-xs text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
