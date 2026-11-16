"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  /** Piccola nota a destra dell'etichetta (es. "auto" per le sezioni che salvano subito). */
  hint?: string;
}

/** Tab a sottolineatura con navigazione da tastiera (←/→/Home/End). */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  label: string;
  className?: string;
}) {
  const base = useId();

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = items.findIndex((i) => i.value === value);
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    onChange(items[next].value);
    document.getElementById(`${base}-${items[next].value}`)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border scroll-thin", className)}
    >
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            id={`${base}-${t.value}`}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium transition-colors",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-opacity",
              active
                ? "text-foreground after:bg-brand after:opacity-100"
                : "text-muted-foreground after:bg-brand after:opacity-0 hover:text-foreground",
            )}
          >
            {t.label}
            {t.hint && <span className="rounded-sm bg-muted px-1.5 text-[10px] font-medium text-muted-soft">{t.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
