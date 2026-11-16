"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CircleNotch, MapPin, MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface AreaValue {
  placeId: string;
  label: string;
  lat: number;
  lng: number;
  suggestedRadiusM?: number | null;
}

export function AreaAutocomplete({
  value,
  onChange,
}: {
  value: AreaValue | null;
  onChange: (area: AreaValue) => void;
}) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [suggestions, setSuggestions] = useState<{ placeId: string; label: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizza col valore esterno (drawer riaperto)
    setQuery(value?.label ?? "");
  }, [value?.label]);

  function handleInput(text: string) {
    setQuery(text);
    setActive(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/places-autocomplete?input=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
      setOpen(true);
    }, 300);
  }

  async function handleSelect(placeId: string, label: string) {
    setQuery(label);
    setOpen(false);
    setResolving(true);
    try {
      const res = await fetch("/api/resolve-area", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const area = await res.json();
      onChange(area);
    } finally {
      setResolving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      handleSelect(suggestions[active].placeId, suggestions[active].label);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <MagnifyingGlass
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-3 top-[18px] -translate-y-1/2 text-muted-soft"
      />
      <Input
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Cerca una città o un comune italiano…"
        className="pl-9 pr-9"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {resolving && (
        <CircleNotch
          size={16}
          aria-label="Risoluzione zona in corso"
          className="absolute right-3 top-[18px] -translate-y-1/2 animate-spin text-muted-soft"
        />
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-pop"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.placeId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                i === active ? "bg-muted" : "hover:bg-muted",
              )}
              onMouseDown={() => handleSelect(s.placeId, s.label)}
              onMouseEnter={() => setActive(i)}
            >
              <MapPin size={16} aria-hidden className="shrink-0 text-muted-soft" />
              <span className="truncate">{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
