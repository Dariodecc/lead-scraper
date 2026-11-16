"use client";

import { useState } from "react";
import { Plus, X } from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Field, Input, inputClass, selectClass } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

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
  const toast = useToast();
  const [name, setName] = useState("");
  const [attrs, setAttrs] = useState<{ name: string; type: string }[]>([]);
  const [attrName, setAttrName] = useState("");
  const [attrType, setAttrType] = useState<string>("text");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | undefined>();

  function reset() {
    setName("");
    setAttrs([]);
    setAttrName("");
    setAttrType("text");
    setNameError(undefined);
  }

  function addAttr() {
    if (!attrName.trim()) return;
    setAttrs((a) => [...a, { name: attrName.trim(), type: attrType }]);
    setAttrName("");
    setAttrType("text");
  }

  async function handleCreate() {
    if (!name.trim()) {
      setNameError("Dai un nome alla lista.");
      return;
    }
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
        toast({ title: "Lista creata", description: name.trim(), tone: "success" });
        onCreated();
        reset();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({ title: "Creazione non riuscita", description: data.error, tone: "danger" });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={440}
      title="Nuova lista"
      description="Poi la colleghi a una o più ricerche."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button loading={saving} onClick={handleCreate}>
            Crea lista
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 p-6">
        <Field label="Nome" error={nameError}>
          <Input
            type="text"
            autoFocus
            placeholder="es. Idraulici Nord Italia"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameError(undefined);
            }}
          />
        </Field>

        <div>
          <div className="text-[13px] font-medium">Campi personalizzati</div>
          <p className="mt-0.5 text-xs text-muted-foreground">Facoltativi: nessuno è creato di default.</p>

          {attrs.length > 0 && (
            <ul className="mt-3 grid gap-1.5">
              {attrs.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/60 py-1.5 pl-3 pr-1.5"
                >
                  <span className="text-[13px] font-medium">
                    {a.name}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-soft">{a.type}</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Rimuovi ${a.name}`}
                    onClick={() => setAttrs((list) => list.filter((_, idx) => idx !== i))}
                  >
                    <X weight="bold" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              aria-label="Nome del campo personalizzato"
              placeholder="Nome campo"
              className={`${inputClass} flex-1`}
              value={attrName}
              onChange={(e) => setAttrName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAttr();
                }
              }}
            />
            <select
              aria-label="Tipo del campo"
              className={`${selectClass} w-28`}
              value={attrType}
              onChange={(e) => setAttrType(e.target.value)}
            >
              {ATTR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={addAttr} disabled={!attrName.trim()}>
              <Plus weight="bold" aria-hidden />
              Aggiungi
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
