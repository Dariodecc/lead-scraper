"use client";

import { useEffect, useState, type FormEvent } from "react";
import { inputClass, selectClass } from "@/components/ui/field";

const LABELS = {
  pending: "In coda",
  processing: "In invio",
  review: "Da verificare",
  delivered: "Inviato",
  failed: "Errore",
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

  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => { void onChange().catch(() => {}); }, 5000);
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

  const buttonClass = "w-fit rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50";
  return (
    <section className="mb-6 rounded-lg border border-hairline-soft p-4">
      <h2 className="text-sm font-semibold">CRM MDNT · {LABELS[delivery.status]}</h2>
      {delivery.message && <p className="mt-1 text-sm text-muted-foreground">{delivery.message}</p>}
      {(failed || (needsReview && !review)) && (
        <form onSubmit={handleCode} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            Codice operatore
            <input className={inputClass} type="password" autoComplete="off" value={token}
              onChange={(event) => setToken(event.target.value)} required />
          </label>
          <button className={buttonClass} disabled={busy}>{failed ? "Riprova invio al CRM" : "Apri verifica"}</button>
        </form>
      )}
      {needsReview && review && (
        <form onSubmit={confirm} className="mt-3 grid max-w-xl gap-3">
          {review.candidates?.length ? (
            <label className="grid gap-1 text-sm">
              Azienda esistente
              <select name="company" className={selectClass} defaultValue="" required>
                <option value="" disabled>Scegli un’azienda</option>
                {review.candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {[candidate.name, candidate.street, candidate.city, candidate.website].filter(Boolean).join(" · ")}
                  </option>
                ))}
                <option value="new">Crea una nuova azienda</option>
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm">
            Nome azienda verificato
            <input name="name" className={inputClass} defaultValue={review.evidence?.name} maxLength={250} required />
          </label>
          <label className="grid gap-1 text-sm">
            URL della fonte
            <input name="sourceUrl" className={inputClass} type="url" defaultValue={review.evidence?.sourceUrl} required />
          </label>
          <label className="grid gap-1 text-sm">
            Sito ufficiale (facoltativo)
            <input name="website" className={inputClass} type="url" defaultValue={review.evidence?.website} />
          </label>
          <fieldset className="grid gap-2 sm:grid-cols-3">
            <legend className="mb-1 text-sm">Indirizzo verificato (facoltativo)</legend>
            <input name="street" aria-label="Via e numero" placeholder="Via e numero" className={inputClass} defaultValue={review.evidence?.street} />
            <input name="city" aria-label="Comune" placeholder="Comune" className={inputClass} defaultValue={review.evidence?.city} />
            <input name="postcode" aria-label="CAP" placeholder="CAP" className={inputClass} defaultValue={review.evidence?.postcode} />
          </fieldset>
          <button className={buttonClass} disabled={busy}>Conferma e invia al CRM</button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </section>
  );
}
