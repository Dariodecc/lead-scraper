"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Field, inputClass, selectClass } from "@/components/ui/field";

const ATTR_TYPES = ["text", "number", "date", "boolean", "select"] as const;

export function NewListDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [attrs, setAttrs] = useState<{ name: string; type: string }[]>([]);
  const [attrName, setAttrName] = useState("");
  const [attrType, setAttrType] = useState<string>("text");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setAttrs([]);
    setAttrName("");
    setAttrType("text");
  }

  function addAttr() {
    if (!attrName.trim()) return;
    setAttrs((a) => [...a, { name: attrName.trim(), type: attrType }]);
    setAttrName("");
    setAttrType("text");
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          attributes: attrs.map((a) => ({ ...a, key: undefined })),
        }),
      });
      if (res.ok) {
        onCreated();
        reset();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} width={420}>
      <h3 className="mb-6 text-[22px] font-semibold tracking-tight">Nuova lista</h3>
      <Field label="Nome">
        <input
          type="text"
          placeholder="es. Idraulici Nord Italia"
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="mb-2.5 text-[13px] font-medium">Campi personalizzati (nessuno di default)</div>
      <div className="mb-3.5 flex flex-col gap-2">
        {attrs.map((a, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2"
          >
            <span className="text-[13px] font-medium">{a.name}</span>
            <button
              type="button"
              className="text-xs text-destructive"
              onClick={() => setAttrs((list) => list.filter((_, idx) => idx !== i))}
            >
              Rimuovi
            </button>
          </div>
        ))}
      </div>
      <div className="mb-7 flex gap-2">
        <input
          type="text"
          placeholder="Nome campo custom"
          className={`${inputClass} flex-1`}
          value={attrName}
          onChange={(e) => setAttrName(e.target.value)}
        />
        <select className={selectClass} style={{ width: 110 }} value={attrType} onChange={(e) => setAttrType(e.target.value)}>
          {ATTR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addAttr}
          className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Aggiungi
        </button>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={handleCreate}
          className="h-10 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          Crea lista
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 flex-1 rounded-md border border-border bg-background text-sm font-semibold"
        >
          Annulla
        </button>
      </div>
    </Drawer>
  );
}
