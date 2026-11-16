import type { Icon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/** Stato vuoto composto: dice cosa manca e come popolarlo. */
export function EmptyState({
  icon: IconCmp,
  title,
  description,
  action,
  className,
}: {
  icon: Icon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <IconCmp size={20} aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-[46ch] text-[13px] text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
