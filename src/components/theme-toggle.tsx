"use client";

import { useEffect, useState } from "react";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type Theme = "system" | "light" | "dark";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "Tema del sistema", icon: Desktop },
  { value: "light", label: "Tema chiaro", icon: Sun },
  { value: "dark", label: "Tema scuro", icon: Moon },
];

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ls-theme") as Theme | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legge la preferenza salvata dopo l'idratazione
      if (saved === "light" || saved === "dark" || saved === "system") setTheme(saved);
    } catch {}
    setMounted(true);
  }, []);

  // Con "Sistema" il tema segue il cambio di preferenza dell'OS in tempo reale.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("ls-theme", next);
    } catch {}
    apply(next);
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
      {OPTIONS.map(({ value, label, icon: IconCmp }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-[background-color,color,box-shadow] duration-150",
              active ? "bg-card text-foreground shadow-panel" : "text-muted-soft hover:text-foreground",
            )}
          >
            <IconCmp size={15} weight={active ? "fill" : "regular"} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
