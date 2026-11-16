"use client";

import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  id?: string;
  describedBy?: string;
  invalid?: boolean;
}

const FieldContext = createContext<FieldContextValue>({});

/**
 * Etichetta sopra, aiuto opzionale, errore sotto. L'id viene passato in automatico a
 * <Input>, <Select> e <Textarea> figli, così label e controllo sono davvero associati.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cn("grid gap-1.5", className)}>
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">
          {label}
          {optional && <span className="ml-1.5 font-normal text-muted-soft">facoltativo</span>}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-destructive-fg">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

export const controlBase =
  "w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.5)] placeholder:text-muted-soft transition-[border-color,box-shadow] duration-150 hover:border-foreground/25 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive dark:shadow-none";

// Classi esportate per i pochi punti in cui serve il tag nativo senza <Field>.
export const inputClass = `${controlBase} h-9`;
export const selectClass = `${controlBase} h-9 select-chevron`;
export const textareaClass = `${controlBase} py-2 leading-relaxed`;

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  const f = useContext(FieldContext);
  return (
    <input
      {...props}
      id={props.id ?? f.id}
      aria-describedby={props["aria-describedby"] ?? f.describedBy}
      aria-invalid={props["aria-invalid"] ?? (f.invalid || undefined)}
      className={cn(inputClass, className)}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  const f = useContext(FieldContext);
  return (
    <select
      {...props}
      id={props.id ?? f.id}
      aria-describedby={props["aria-describedby"] ?? f.describedBy}
      aria-invalid={props["aria-invalid"] ?? (f.invalid || undefined)}
      className={cn(selectClass, className)}
    />
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  const f = useContext(FieldContext);
  return (
    <textarea
      {...props}
      id={props.id ?? f.id}
      aria-describedby={props["aria-describedby"] ?? f.describedBy}
      aria-invalid={props["aria-invalid"] ?? (f.invalid || undefined)}
      className={cn(textareaClass, className)}
    />
  );
}
