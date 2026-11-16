"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Flask, Info, Pause, Play } from "@phosphor-icons/react";
import { Field, Input, Select } from "@/components/ui/field";
import { AreaAutocomplete, type AreaValue } from "@/components/ricerche/area-autocomplete";
import { PLACE_TYPES } from "@/lib/placeTypes";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SearchStatusBadge, RunStatusBadge } from "@/components/status-badges";
import { useToast } from "@/components/ui/toast";
import { formatDateTime, formatUsd } from "@/lib/format";

// Leaflet tocca `window` — niente SSR, si carica solo lato client dopo il mount.
const CoverageMap = dynamic(() => import("@/components/map/coverage-map").then((m) => m.CoverageMap), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-lg bg-muted" aria-hidden />,
});

const WEEKDAYS = [
  { id: 1, label: "Lunedì" },
  { id: 2, label: "Martedì" },
  { id: 3, label: "Mercoledì" },
  { id: 4, label: "Giovedì" },
  { id: 5, label: "Venerdì" },
  { id: 6, label: "Sabato" },
  { id: 0, label: "Domenica" },
];

type Frequency = "once" | "weekly" | "monthly";

interface ListSummary {
  id: string;
  name: string;
}

interface RunRow {
  id: string;
  startedAt: string;
  status: string;
  resultsCount: number;
  newCount: number;
  duplicateCount: number;
}

interface CostSummary {
  totalUsd: number;
  googleApiUsd: number;
  aiAnalysisUsd: number;
  callCount: number;
}

function emptyDraft() {
  return {
    title: "",
    area: null as AreaValue | null,
    radiusKm: 15,
    categoryPlaceType: "",
    frequency: "monthly" as Frequency,
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: "07:00",
    listId: "",
  };
}

interface OtherSearch {
  id: string;
  title: string;
  areaLabel: string;
  areaLat: string | number | null;
  areaLng: string | number | null;
  areaRadiusM: number;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-5 border-b border-border px-5 py-6 last:border-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8">
      <legend className="sr-only">{title}</legend>
      <div aria-hidden>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>}
      </div>
      <div className="grid min-w-0 gap-5">{children}</div>
    </fieldset>
  );
}

export default function SearchDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const isNew = params.id === "new";

  const [draft, setDraft] = useState(emptyDraft());
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [otherSearches, setOtherSearches] = useState<OtherSearch[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [errors, setErrors] = useState<{ area?: string; category?: string }>({});
  const [loaded, setLoaded] = useState(isNew);

  const load = useCallback(async () => {
    const listsRes = await fetch("/api/lists");
    const listsData = await listsRes.json();
    setLists((listsData.lists ?? []).map((l: { id: string; name: string }) => ({ id: l.id, name: l.name })));

    // Altre ricerche già impostate — mostrate come riferimento sulla mappa qui sotto, per avere
    // un contesto di quanti km usano zone simili invece di indovinare da zero.
    const searchesRes = await fetch("/api/searches");
    const searchesData = await searchesRes.json();
    setOtherSearches(
      (searchesData.searches ?? []).filter(
        (s: OtherSearch) => s.id !== params.id && s.areaLat != null && s.areaLng != null,
      ),
    );

    if (!isNew) {
      const res = await fetch(`/api/searches/${params.id}`);
      const data = await res.json();
      const s = data.search;
      setDraft({
        title: s.title,
        area: { placeId: s.areaPlaceId, label: s.areaLabel, lat: Number(s.areaLat), lng: Number(s.areaLng) },
        radiusKm: Math.round(s.areaRadiusM / 1000),
        categoryPlaceType: s.categoryPlaceType,
        frequency: s.frequency,
        dayOfWeek: s.scheduleDayOfWeek ?? 1,
        dayOfMonth: s.scheduleDayOfMonth ?? 1,
        time: s.scheduleTime ?? "07:00",
        listId: s.listId ?? "",
      });
      setStatus(s.status);
      setRuns(s.runs ?? []);
      setCostSummary(data.costSummary ?? null);
    }
    setLoaded(true);
  }, [isNew, params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  const selectedList = lists.find((l) => l.id === draft.listId) ?? null;

  async function handleSave() {
    const nextErrors: { area?: string; category?: string } = {};
    if (!draft.area) nextErrors.area = "Scegli una zona dai suggerimenti.";
    if (!draft.categoryPlaceType) nextErrors.category = "Seleziona una categoria.";
    setErrors(nextErrors);
    if (nextErrors.area || nextErrors.category || !draft.area) {
      toast({ title: "Mancano dei dati", description: "Seleziona zona e categoria prima di salvare.", tone: "danger" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: draft.title.trim() || "Nuova ricerca",
        areaPlaceId: draft.area.placeId,
        areaLabel: draft.area.label,
        areaLat: draft.area.lat,
        areaLng: draft.area.lng,
        areaRadiusM: draft.radiusKm * 1000,
        categoryPlaceType: draft.categoryPlaceType,
        categoryLabel: PLACE_TYPES.find((t) => t.id === draft.categoryPlaceType)?.label,
        frequency: draft.frequency,
        scheduleDayOfWeek: draft.frequency === "weekly" ? draft.dayOfWeek : null,
        scheduleDayOfMonth: draft.frequency === "monthly" ? draft.dayOfMonth : null,
        scheduleTime: draft.frequency === "once" ? null : draft.time,
        listId: draft.listId || null,
      };

      const res = await fetch(isNew ? "/api/searches" : `/api/searches/${params.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Salvataggio non riuscito", description: data.error, tone: "danger" });
        return;
      }
      if (isNew) {
        toast({ title: "Ricerca creata", tone: "success" });
        router.push(`/ricerche/${data.search.id}`);
      } else {
        toast({ title: "Modifiche salvate", tone: "success" });
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (isNew) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/searches/${params.id}/test`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Test non riuscito", description: data.error, tone: "danger" });
        return;
      }
      toast({ title: "Test accodato", description: "Controlla Logs tra qualche secondo per l'esito.", tone: "success" });
      load();
    } finally {
      setTesting(false);
    }
  }

  async function handleToggleStatus() {
    if (isNew) return;
    const nextStatus = status === "active" ? "paused" : "active";
    const res = await fetch(`/api/searches/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Operazione non riuscita", description: data.error, tone: "danger" });
      return;
    }
    setStatus(nextStatus);
    toast({ title: nextStatus === "active" ? "Ricerca attivata" : "Ricerca messa in pausa", tone: "success" });
  }

  // Le ricerche "una tantum" restano "attive" per sempre dopo la prima esecuzione — per
  // rilanciarle serve un'azione diretta, non il toggle Attiva/Pausa (che non le farebbe mai
  // ripartire da sole, §scheduling).
  async function handleRunOnce() {
    if (isNew) return;
    const res = await fetch(`/api/searches/${params.id}/run`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Operazione non riuscita", description: data.error, tone: "danger" });
      return;
    }
    setStatus("active");
    toast({ title: "Ricerca accodata", description: "L'esito comparirà nello storico esecuzioni.", tone: "success" });
    load();
  }

  if (!loaded) return <PageSkeleton rows={8} />;

  const runControls = !isNew && (
    <>
      <Button variant="outline" loading={testing} onClick={handleTest}>
        {!testing && <Flask aria-hidden />}
        Esegui test
      </Button>
      {draft.frequency === "once" ? (
        <Button variant="outline" onClick={handleRunOnce} disabled={!draft.listId}>
          <Play weight="fill" aria-hidden />
          {status === "active" ? "Esegui di nuovo" : "Esegui"}
        </Button>
      ) : (
        <Button variant="outline" onClick={handleToggleStatus} disabled={status === "draft" && !draft.listId}>
          {status === "active" ? <Pause weight="fill" aria-hidden /> : <Play weight="fill" aria-hidden />}
          {status === "active" ? "Pausa" : "Attiva"}
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHeader
        back={{ label: "Ricerche", href: "/ricerche" }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <input
              aria-label="Titolo della ricerca"
              className="field-sizing-content -mx-2 min-w-[9ch] max-w-full rounded-md bg-transparent px-2 py-0.5 text-2xl font-semibold tracking-[-0.02em] transition-colors placeholder:text-muted-soft hover:bg-muted focus-visible:bg-muted focus-visible:outline-2"
              placeholder="Nuova ricerca"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            {!isNew && <SearchStatusBadge status={status} />}
          </span>
        }
        description="Zona e categoria da Google Places, frequenza di esecuzione e lista di destinazione."
        actions={runControls}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          <Section title="Zona" description="Dove cercare e quanto è ampia l'area scansionata.">
            <Field label="Zona (Google Places)" error={errors.area}>
              <AreaAutocomplete
                value={draft.area}
                onChange={(area) => {
                  setErrors((e) => ({ ...e, area: undefined }));
                  setDraft((d) => ({
                    ...d,
                    area,
                    // Precompila il raggio per coprire l'intero comune selezionato (dal bounding
                    // box che Google restituisce) — resta comunque modificabile a mano sotto.
                    radiusKm: area.suggestedRadiusM ? Math.round(area.suggestedRadiusM / 1000) : d.radiusKm,
                  }));
                }}
              />
            </Field>

            <Field
              label="Raggio di copertura"
              hint="Precompilato per coprire l'intero comune scelto: modificalo solo se vuoi un'area più piccola o più ampia."
            >
              <div className="relative max-w-40">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  className="num pr-10"
                  value={draft.radiusKm}
                  onChange={(e) => setDraft((d) => ({ ...d, radiusKm: Number(e.target.value) }))}
                />
                <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-soft">
                  km
                </span>
              </div>
            </Field>

            {draft.area && (
              <div className="grid gap-2">
                <div className="text-[13px] font-medium">Copertura sulla mappa</div>
                <CoverageMap
                  circles={[
                    ...otherSearches.map((s) => ({
                      id: s.id,
                      lat: Number(s.areaLat),
                      lng: Number(s.areaLng),
                      radiusM: s.areaRadiusM,
                      label: `${s.title || "Nuova ricerca"} — ${s.areaLabel} (${Math.round(s.areaRadiusM / 1000)} km)`,
                      color: "muted",
                      href: `/ricerche/${s.id}`,
                    })),
                    {
                      id: "preview",
                      lat: draft.area.lat,
                      lng: draft.area.lng,
                      radiusM: draft.radiusKm * 1000,
                      label: `${draft.area.label} — ${draft.radiusKm} km (questa ricerca)`,
                    },
                  ]}
                  height={320}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  In blu questa ricerca, in grigio le altre già impostate (clicca per aprirle). Il cerchio è
                  l&apos;area effettivamente scansionata, non il confine amministrativo esatto del comune.
                </p>
              </div>
            )}
          </Section>

          <Section title="Categoria" description="Il tipo di attività da cercare.">
            <Field label="Categoria commerciale (Place Type)" error={errors.category}>
              <Select
                value={draft.categoryPlaceType}
                onChange={(e) => {
                  setErrors((er) => ({ ...er, category: undefined }));
                  setDraft((d) => ({ ...d, categoryPlaceType: e.target.value }));
                }}
              >
                <option value="">Seleziona una categoria…</option>
                {PLACE_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <Section title="Pianificazione" description="Ogni quanto la ricerca viene rieseguita.">
            <div className="grid gap-1.5">
              <div className="text-[13px] font-medium">Frequenza</div>
              <Segmented<Frequency>
                label="Frequenza"
                value={draft.frequency}
                onChange={(f) => setDraft((d) => ({ ...d, frequency: f }))}
                options={[
                  { value: "once", label: "Una tantum" },
                  { value: "weekly", label: "Settimanale" },
                  { value: "monthly", label: "Mensile" },
                ]}
              />
            </div>

            {draft.frequency !== "once" && (
              <div className="grid gap-4 sm:grid-cols-2">
                {draft.frequency === "weekly" ? (
                  <Field label="Giorno della settimana">
                    <Select
                      value={draft.dayOfWeek}
                      onChange={(e) => setDraft((d) => ({ ...d, dayOfWeek: Number(e.target.value) }))}
                    >
                      {WEEKDAYS.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <Field label="Giorno del mese">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      className="num"
                      value={draft.dayOfMonth}
                      onChange={(e) => setDraft((d) => ({ ...d, dayOfMonth: Number(e.target.value) }))}
                    />
                  </Field>
                )}
                <Field label="Ora di partenza" hint="Fuso orario Europe/Rome.">
                  <Input
                    type="time"
                    className="num"
                    value={draft.time}
                    onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
                  />
                </Field>
              </div>
            )}
          </Section>

          <Section title="Destinazione" description="Dove finiscono i risultati trovati.">
            <Field
              label="Lista di destinazione"
              hint={
                selectedList ? (
                  <>
                    Webhook, prompt AI e filtri di invio si configurano nella lista collegata:{" "}
                    <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/liste?list=${selectedList.id}`}>
                      apri &ldquo;{selectedList.name}&rdquo;
                    </Link>
                  </>
                ) : (
                  "Webhook, prompt AI e filtri di invio si configurano nella lista di destinazione."
                )
              }
            >
              <Select value={draft.listId} onChange={(e) => setDraft((d) => ({ ...d, listId: e.target.value }))}>
                <option value="">Nessuna — verrà creata al primo test</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-b-lg border-t border-border bg-card/90 px-5 py-3.5 backdrop-blur">
            <Button variant="default" size="lg" loading={saving} onClick={handleSave}>
              {isNew ? "Crea ricerca" : "Salva modifiche"}
            </Button>
          </div>
        </Panel>

        <div className="grid gap-6">
          {isNew ? (
            <Panel className="rise" style={{ "--i": 2 } as React.CSSProperties}>
              <PanelHeader title="Come viene coperta l'area" />
              <PanelBody className="flex gap-3 text-[13px] leading-relaxed text-muted-foreground">
                <Info size={18} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-brand" />
                <p>
                  Google restituisce al massimo 20 risultati a chiamata: l&apos;area viene quindi coperta con più
                  chiamate, a griglia, con suddivisione automatica nelle zone dense. Scegli la zona e il raggio
                  verrà proposto in automatico.
                </p>
              </PanelBody>
            </Panel>
          ) : (
            <>
              <Panel className="rise" style={{ "--i": 2 } as React.CSSProperties}>
                <PanelHeader title="Costi API di questa ricerca" />
                {costSummary ? (
                  <PanelBody>
                    <div className="text-[13px] text-muted-foreground">Totale</div>
                    <div className="num mt-1 text-[28px] font-semibold leading-none tracking-[-0.025em]">
                      {formatUsd(costSummary.totalUsd)}
                    </div>
                    <dl className="mt-5 grid gap-2 border-t border-hairline-soft pt-4 text-[13px]">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Google Places</dt>
                        <dd className="num">{formatUsd(costSummary.googleApiUsd)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Analisi AI</dt>
                        <dd className="num">{formatUsd(costSummary.aiAnalysisUsd)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Chiamate totali</dt>
                        <dd className="num">{costSummary.callCount.toLocaleString("it-IT")}</dd>
                      </div>
                    </dl>
                  </PanelBody>
                ) : (
                  <PanelBody>
                    <p className="text-[13px] text-muted-soft">Nessun costo registrato ancora.</p>
                  </PanelBody>
                )}
              </Panel>

              <Panel className="rise" style={{ "--i": 3 } as React.CSSProperties}>
                <PanelHeader title="Storico esecuzioni" />
                {runs.length === 0 ? (
                  <PanelBody>
                    <p className="text-[13px] text-muted-soft">Nessuna esecuzione ancora.</p>
                  </PanelBody>
                ) : (
                  <ol className="divide-y divide-hairline-soft">
                    {runs.map((r) => (
                      <li key={r.id} className="px-5 py-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <time dateTime={r.startedAt} className="num text-[13px] font-medium">
                            {formatDateTime(r.startedAt)}
                          </time>
                          <RunStatusBadge status={r.status} />
                        </div>
                        <p className="num mt-1.5 text-xs text-muted-foreground">
                          {r.resultsCount} risultati · {r.newCount} nuovi · {r.duplicateCount} duplicati
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>
    </>
  );
}
