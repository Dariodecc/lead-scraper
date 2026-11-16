"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number;
}

/**
 * Controllo a segmenti costruito su radio nativi: tastiera (frecce), focus e lettori di schermo
 * funzionano senza codice aggiuntivo.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-fit max-w-full gap-0.5 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-0.5 scroll-thin", className)}
    >
      {options.map((o) => (
        <label key={o.value} className="relative">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="peer sr-only"
          />
          <span className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow] duration-150 hover:text-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-panel peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring">
            {o.label}
            {o.count != null && <span className="num text-xs text-muted-soft">{o.count}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
