"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";

type Tone = "neutral" | "success" | "danger";

interface ToastInput {
  title: string;
  description?: string;
  tone?: Tone;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ToastContext = createContext<((t: ToastInput) => void) | null>(null);

/** Notifica transitoria (sostituisce `alert()` e i "Salvato ✓" inline). */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast fuori da <ToastProvider>");
  return ctx;
}

const ICON = {
  success: <CheckCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-success" aria-hidden />,
  danger: <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-destructive" aria-hidden />,
  neutral: <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-brand" aria-hidden />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setItems((i) => i.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++idRef.current;
      setItems((i) => [...i.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.tone === "danger" ? 7000 : 3800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "danger" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-popover px-3.5 py-3 shadow-pop [animation:toast-in_240ms_cubic-bezier(0.2,0.7,0.2,1)_both]"
          >
            {ICON[t.tone ?? "neutral"]}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-5">{t.title}</div>
              {t.description && <div className="mt-0.5 text-[13px] text-muted-foreground">{t.description}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Chiudi notifica"
              className="-mr-1 -mt-0.5 rounded-md p-1 text-muted-soft transition-colors hover:bg-muted hover:text-foreground"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
