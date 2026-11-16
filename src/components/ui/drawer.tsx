"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

/**
 * Pannello laterale su <dialog> nativo: focus trap, Esc e livello "top layer" li gestisce il
 * browser. I figli sono montati solo quando è aperto, così ogni apertura riparte da zero.
 */
export function Drawer({
  open,
  onClose,
  width = 480,
  side = "right",
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  side?: "left" | "right";
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={title ? titleId : undefined}
      className={cn("sheet", side === "left" && "sheet-left")}
      style={{ width: `min(${width}px, 100vw)` }}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {open && (
        <div className="flex h-full flex-col">
          {title && (
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-semibold tracking-tight">
                  {title}
                </h2>
                {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Chiudi"
                className="-mr-2 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={16} weight="bold" />
              </button>
            </header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">{children}</div>
          {footer && <footer className="border-t border-border bg-card px-6 py-3.5">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
