"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" colora il pulsante di conferma e dà il focus iniziale ad "Annulla". */
  tone?: "default" | "danger";
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Dialog di conferma accessibile (sostituisce `window.confirm`). Restituisce true/false. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm fuori da <ConfirmProvider>");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setState({ options, resolve })),
    [],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (state && d && !d.open) d.showModal();
  }, [state]);

  function finish(result: boolean) {
    state?.resolve(result);
    setState(null);
    dialogRef.current?.close();
  }

  const o = state?.options;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby={titleId}
        onClose={() => {
          // Chiusura con Esc: equivale ad "Annulla".
          if (state) {
            state.resolve(false);
            setState(null);
          }
        }}
        onClick={(e) => e.target === e.currentTarget && finish(false)}
      >
        {o && (
          <div className="p-5">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {o.title}
            </h2>
            {o.description && <p className="mt-1.5 text-sm text-muted-foreground">{o.description}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => finish(false)} autoFocus={o.tone === "danger"}>
                {o.cancelLabel ?? "Annulla"}
              </Button>
              <Button variant={o.tone === "danger" ? "destructive" : "default"} onClick={() => finish(true)}>
                {o.confirmLabel ?? "Conferma"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
