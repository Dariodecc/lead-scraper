import { cn } from "@/lib/utils";

/** Interruttore su checkbox nativo (role="switch"): tastiera e lettori di schermo gratis. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  className,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-input transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:bg-brand peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring"
      />
      <span className="min-w-0 text-[13px]">
        <span className="font-medium text-foreground">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
        {children}
      </span>
    </label>
  );
}
