"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowsClockwise, CheckCircle, HourglassMedium, WarningCircle, type Icon } from "@phosphor-icons/react";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LABELS = {
  pending: "In coda",
  processing: "In invio",
  review: "Da verificare",
  delivered: "Inviato",
  failed: "Errore",
};

const STATE_STYLE: Record<keyof typeof LABELS, { tone: Tone; icon: Icon; bar: string; iconClass: string }> = {
  pending: { tone: "brand", icon: HourglassMedium, bar: "border-l-brand", iconClass: "text-brand" },
  processing: { tone: "brand", icon: ArrowsClockwise, bar: "border-l-brand", iconClass: "text-brand" },
  review: { tone: "warning", icon: WarningCircle, bar: "border-l-warning", iconClass: "text-warning-fg" },
  delivered: { tone: "success", icon: CheckCircle, bar: "border-l-success", iconClass: "text-success-fg" },
  failed: { tone: "danger", icon: WarningCircle, bar: "border-l-destructive", iconClass: "text-destructive-fg" },
};

export interface CrmDeliverySummary {
  status: keyof typeof LABELS;
  message: string | null;
}

interface Review {
  updatedAt: string;
  evidence: Partial<Record<"name" | "sourceUrl" | "website" | "street" | "city" | "postcode", string>> | null;
  candidates: { id: string; name: string; website: string | null; city: string | null; street: string | null }[] | null;
}

export function CrmDeliveryPanel({
  placeId,
  delivery,
  onChange,
}: {
  placeId: string;
  delivery: CrmDeliverySummary;
  onChange: () => Promise<void>;
}) {
  const [token, setToken] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const url = `/api/places/${placeId}/crm`;
  const needsReview = delivery.status === "review";
  const failed = delivery.status === "failed";
  const processing = delivery.status === "pending" || delivery.status === "processing";
  const style = STATE_STYLE[delivery.status];
  const StateIcon = style.icon;

  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => {
      void onChange().catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [onChange, processing]);

  async function request(method: "GET" | "POST", body?: object) {
    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Azione non riuscita.");
    return data;
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (failed) {
        await request("POST", { action: "retry" });
        await onChange();
      } else {
        setReview(await request("GET"));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Azione non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) return;
    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "").trim() || undefined;
    setError("");
    setBusy(true);
    try {
      await request("POST", {
        action: "confirm",
        revision: review.updatedAt,
        company: read("company"),
        evidence: {
          name: read("name"),
          sourceUrl: read("sourceUrl"),
          website: read("website"),
          street: read("street"),
          city: read("city"),
          postcode: read("postcode"),
        },
      });
      setReview(null);
      await onChange();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Conferma non riuscita.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Consegna al CRM"
      className={cn("rise mb-6 rounded-lg border border-l-4 border-border bg-card p-5 shadow-panel", style.bar)}
    >
      <div className="flex items-start gap-3">
        <StateIcon
          size={20}
          weight="fill"
          aria-hidden
          className={cn("mt-0.5 shrink-0", style.iconClass, delivery.status === "processing" && "animate-spin")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">CRM MDNT</h2>
            <Badge tone={style.tone}>{LABELS[delivery.status]}</Badge>
          </div>
          {delivery.message && <p className="mt-1 text-[13px] text-muted-foreground">{delivery.message}</p>}

          {(failed || (needsReview && !review)) && (
            <form onSubmit={handleCode} className="mt-4 flex flex-wrap items-end gap-3">
              <Field label="Codice operatore" className="w-full max-w-64">
                <Input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  required
                />
              </Field>
              <Button type="submit" loading={busy}>
                {failed ? "Riprova invio al CRM" : "Apri verifica"}
              </Button>
            </form>
          )}

          {needsReview && review && (
            <form onSubmit={confirm} className="mt-4 grid max-w-xl gap-4">
              {review.candidates?.length ? (
                <Field label="Azienda esistente">
                  <Select name="company" defaultValue="" required>
                    <option value="" disabled>
                      Scegli un’azienda
                    </option>
                    {review.candidates.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {[candidate.name, candidate.street, candidate.city, candidate.website].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                    <option value="new">Crea una nuova azienda</option>
                  </Select>
                </Field>
              ) : null}
              <Field label="Nome azienda verificato">
                <Input name="name" defaultValue={review.evidence?.name} maxLength={250} required />
              </Field>
              <Field label="URL della fonte">
                <Input name="sourceUrl" type="url" defaultValue={review.evidence?.sourceUrl} required />
              </Field>
              <Field label="Sito ufficiale" optional>
                <Input name="website" type="url" defaultValue={review.evidence?.website} />
              </Field>
              <fieldset className="grid gap-2 sm:grid-cols-3">
                <legend className="mb-1.5 text-[13px] font-medium">
                  Indirizzo verificato <span className="font-normal text-muted-soft">facoltativo</span>
                </legend>
                <Input name="street" aria-label="Via e numero" placeholder="Via e numero" defaultValue={review.evidence?.street} />
                <Input name="city" aria-label="Comune" placeholder="Comune" defaultValue={review.evidence?.city} />
                <Input name="postcode" aria-label="CAP" placeholder="CAP" defaultValue={review.evidence?.postcode} />
              </fieldset>
              <div>
                <Button type="submit" loading={busy}>
                  Conferma e invia al CRM
                </Button>
              </div>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-destructive-fg">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
