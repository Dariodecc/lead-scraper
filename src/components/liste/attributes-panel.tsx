"use client";

import { useState } from "react";
import { inputClass, selectClass } from "@/components/ui/field";
import { FIXED_PLACE_FIELDS } from "@/lib/placeFields";

const ATTR_TYPES = ["text", "number", "date", "boolean", "select"] as const;

export interface ListAttribute {
  id: string;
  name: string;
  key: string;
  type: string;
}

export function AttributesPanel({
  listId,
  attributes,
  visibleFields,
  onChanged,
}: {
  listId: string;
  attributes: ListAttribute[];
  visibleFields: string[];
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");

  const allFields = [
    ...FIXED_PLACE_FIELDS.map((f) => ({ key: f.key, label: f.label })),
    ...attributes.map((a) => ({ key: a.key, label: a.name })),
  ];

  async function addAttribute() {
    if (!name.trim()) return;
    await fetch(`/api/lists/${listId}/attributes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    setName("");
    setType("text");
    onChanged();
  }

  async function deleteAttribute(attrId: string) {
    await fetch(`/api/lists/${listId}/attributes/${attrId}`, { method: "DELETE" });
    onChanged();
  }

  async function toggleVisible(key: string) {
    const next = visibleFields.includes(key)
      ? visibleFields.filter((k) => k !== key)
      : [...visibleFields, key];
    await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibleFields: next }),
    });
    onChanged();
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-muted p-5">
      <div className="mb-3 text-[13px] font-semibold">Colonne mostrate in tabella</div>
      <div className="mb-5 flex flex-wrap gap-2">
        {allFields.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => toggleVisible(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              visibleFields.includes(f.key)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 text-[13px] font-semibold">Campi personalizzati di questa lista</div>
      <div className="mb-4 flex flex-col gap-2">
        {attributes.length === 0 && (
          <div className="text-xs text-muted-soft">Nessun campo custom ancora</div>
        )}
        {attributes.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3.5 py-2.5"
          >
            <span>
              <span className="text-[13px] font-medium">{a.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-soft">{a.key}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground">{a.type}</span>
              <button className="text-xs text-destructive" onClick={() => deleteAttribute(a.id)}>
                Elimina
              </button>
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Nome campo custom"
          className={`${inputClass} flex-1 bg-background`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={selectClass}
          style={{ width: 110 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {ATTR_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addAttribute}
          className="rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Aggiungi
        </button>
      </div>
    </div>
  );
}
