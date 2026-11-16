import { cn } from "@/lib/utils";

/** Tabella semantica: scorre in orizzontale su schermi stretti, intestazioni in sentence case. */
export function Table({
  className,
  minWidth,
  children,
}: {
  className?: string;
  minWidth?: number;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("relative overflow-x-auto rounded-lg border border-border bg-card shadow-panel scroll-thin", className)}>
      <table className="w-full border-collapse text-left text-[13px]" style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      {...props}
      scope={props.scope ?? "col"}
      className={cn(
        "h-10 border-b border-border bg-muted/60 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground first:rounded-tl-lg last:rounded-tr-lg",
        className,
      )}
    />
  );
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      {...props}
      className={cn(
        "border-b border-hairline-soft transition-colors last:border-0 hover:bg-muted/50 data-[selected=true]:bg-brand-soft/60",
        className,
      )}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return <td {...props} className={cn("px-4 py-3 align-middle", className)} />;
}
