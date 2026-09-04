"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui/field";

export interface AreaValue {
  placeId: string;
  label: string;
  lat: number;
  lng: number;
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
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronizza col valore esterno (drawer riaperto)
    setQuery(value?.label ?? "");
  }, [value?.label]);

  function handleInput(text: string) {
    setQuery(text);
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

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Cerca una città o comune italiano…"
        className={inputClass}
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {resolving && <div className="mt-1 text-xs text-muted-soft">Risoluzione zona…</div>}
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              className="block w-full px-3.5 py-2 text-left text-sm hover:bg-secondary"
              onMouseDown={() => handleSelect(s.placeId, s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
