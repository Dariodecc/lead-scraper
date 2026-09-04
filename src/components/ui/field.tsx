export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1.5 block text-[13px] font-medium text-foreground/80">{label}</label>
      {children}
    </div>
  );
}

export const inputClass = "h-10 w-full rounded-md border border-border bg-background px-3.5 text-sm";
export const selectClass = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm";
