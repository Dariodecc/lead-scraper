"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowSquareOut, Check, Star } from "@phosphor-icons/react";
import { Input, Select, Textarea } from "@/components/ui/field";
import { CrmDeliveryPanel, type CrmDeliverySummary } from "@/components/liste/crm-delivery-panel";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelBody, PanelHeader, DefRow } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { DeliveryBadge, LevelBadge } from "@/components/status-badges";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  WEBSITE_STATUS_LABEL,
  BUCKET_LABEL,
  CONFIDENCE_LABEL,
  BUSINESS_STATUS_LABEL,
} from "@/lib/placeFields";
import { cn } from "@/lib/utils";

interface PlaceDetail {
  id: string;
  placeId: string;
  listId: string;
  businessName: string;
  category: string | null;
  address: string;
  lat: string;
  lng: string;
  phone: string | null;
  websiteUrl: string | null;
  websiteStatus: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  businessStatus: string | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  confirmedOpeningDate: string | null;
  earliestReviewDate: string | null;
  firstSeenAt: string;
  deliveryStatus: string;
  previewOnly: boolean;
  crmDelivery: CrmDeliverySummary | null;
  deliveryAttempts: number;
  lastDeliveryAttemptAt: string | null;
  createdAt: string;
  customAttributes: Record<string, unknown>;
}

interface ListAttribute {
  id: string;
  name: string;
  key: string;
  type: string;
  options: string[] | null;
}

interface LogRow {
  id: string;
  level: string;
  category: string;
  message: string;
  createdAt: string;
}

const PRICE_LABEL: Record<number, string> = {
  1: "€ — economico",
  2: "€€ — medio",
  3: "€€€ — alto",
  4: "€€€€ — molto alto",
};

const LEVEL_DOT: Record<string, string> = {
  info: "bg-muted-foreground/50",
  warning: "bg-warning",
  error: "bg-destructive",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight">{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1 mt-5 text-xs font-medium text-muted-foreground first:mt-0">{children}</h3>;
}

function CustomValueInput({
  attribute,
  value,
  onSave,
}: {
  attribute: ListAttribute;
  value: unknown;
  onSave: (value: unknown) => void;
}) {
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  const [saved, setSaved] = useState(false);

  function commit() {
    let parsed: unknown = draft;
    if (attribute.type === "number") parsed = draft.trim() ? Number(draft) : null;
    if (attribute.type === "boolean") parsed = draft === "true";
    onSave(parsed);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  const savedMark = (
    <span aria-live="polite" className="inline-flex h-5 items-center gap-1 text-xs font-medium text-success-fg">
      {saved && (
        <>
          <Check size={12} weight="bold" aria-hidden />
          Salvato
        </>
      )}
    </span>
  );

  if (attribute.type === "boolean") {
    return (
      <Select
        aria-label={attribute.name}
        value={draft || "false"}
        onChange={(e) => {
          setDraft(e.target.value);
          onSave(e.target.value === "true");
        }}
      >
        <option value="true">Sì</option>
        <option value="false">No</option>
      </Select>
    );
  }

  if (attribute.type === "select" && attribute.options && attribute.options.length > 0) {
    return (
      <Select
        aria-label={attribute.name}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onSave(e.target.value);
        }}
      >
        <option value="">—</option>
        {attribute.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }

  if (attribute.type === "text") {
    return (
      <div className="grid gap-1">
        <Textarea
          aria-label={attribute.name}
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
        {savedMark}
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <Input
        aria-label={attribute.name}
        type={attribute.type === "number" ? "number" : attribute.type === "date" ? "date" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
      {savedMark}
    </div>
  );
}

export default function PlaceDetailPage() {
  const params = useParams<{ listId: string; placeId: string }>();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [listName, setListName] = useState("");
  const [attributes, setAttributes] = useState<ListAttribute[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const load = useCallback(async () => {
    const [placeRes, listRes, logsRes] = await Promise.all([
      fetch(`/api/places/${params.placeId}`),
      fetch(`/api/lists/${params.listId}`),
      fetch(`/api/logs?placeId=${params.placeId}&pageSize=50`),
    ]);
    const placeData = await placeRes.json();
    const listData = await listRes.json();
    const logsData = await logsRes.json();
    setPlace(placeData.place);
    setListName(listData.list?.name ?? "");
    setAttributes(listData.list?.attributes ?? []);
    setLogs(logsData.logs ?? []);
  }, [params.placeId, params.listId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch dati al mount
    load();
  }, [load]);

  async function saveCustomValue(listAttributeId: string, value: unknown) {
    await fetch(`/api/places/${params.placeId}/custom-values`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listAttributeId, value }),
    });
    load();
  }

  if (!place) return <PageSkeleton rows={8} />;

  return (
    <>
      <PageHeader
        back={{ label: listName || "Lista", href: `/liste?list=${params.listId}` }}
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {place.businessName}
            <span className="text-base">
              <DeliveryBadge status={place.deliveryStatus} previewOnly={place.previewOnly} />
            </span>
          </span>
        }
        description={`${place.category ?? "—"} · ${place.address}`}
        actions={
          <a
            href={`https://www.google.com/maps/place/?q=place_id:${place.placeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            Vedi su Google Maps
            <ArrowSquareOut aria-hidden />
          </a>
        }
      />

      {place.crmDelivery && <CrmDeliveryPanel placeId={place.id} delivery={place.crmDelivery} onChange={load} />}

      <Panel className="rise mb-6 overflow-hidden" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="grid grid-cols-2 divide-border max-lg:divide-y lg:grid-cols-4 lg:divide-x [&>*:nth-child(odd)]:max-lg:border-r [&>*:nth-child(odd)]:max-lg:border-border">
          <Fact label="Valutazione">
            {place.rating != null ? (
              <span className="num inline-flex items-center gap-1.5">
                <Star size={15} weight="fill" className="text-warning" aria-hidden />
                {place.rating}
                <span className="text-[13px] font-normal text-muted-foreground">
                  · {place.reviewCount ?? 0} recensioni
                </span>
              </span>
            ) : (
              <span className="font-normal text-muted-soft">Nessun dato</span>
            )}
          </Fact>
          <Fact label="Apertura stimata">
            {BUCKET_LABEL[place.estimatedOpeningWindow]}
            <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">
              · confidenza {CONFIDENCE_LABEL[place.estimationConfidence]?.toLowerCase()}
            </span>
          </Fact>
          <Fact label="Sito web">
            <Badge tone={place.websiteStatus === "none" ? "warning" : place.websiteStatus === "outdated" ? "neutral" : "success"}>
              {WEBSITE_STATUS_LABEL[place.websiteStatus] ?? place.websiteStatus}
            </Badge>
          </Fact>
          <Fact label="Telefono">
            <span className="num font-mono text-sm">{place.phone ?? "—"}</span>
          </Fact>
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <PanelHeader title="Dettagli" />
          <PanelBody>
            <dl>
              <SubHeading>Contatti</SubHeading>
              <DefRow label="Telefono">
                <span className="num font-mono">{place.phone ?? "—"}</span>
              </DefRow>
              <DefRow label="URL sito">
                {place.websiteUrl ? (
                  <a
                    href={place.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block max-w-full truncate align-bottom text-brand underline-offset-2 hover:underline"
                    title={place.websiteUrl}
                  >
                    {place.websiteUrl}
                  </a>
                ) : (
                  "—"
                )}
              </DefRow>
              <DefRow label="Stato sito">{WEBSITE_STATUS_LABEL[place.websiteStatus] ?? place.websiteStatus}</DefRow>

              <SubHeading>Su Google</SubHeading>
              <DefRow label="Rating / recensioni">
                {place.rating != null ? (
                  <span className="num">
                    {place.rating}★ · {place.reviewCount ?? 0} recensioni
                  </span>
                ) : (
                  "Nessun dato"
                )}
              </DefRow>
              <DefRow label="Fascia di prezzo">{place.priceLevel ? PRICE_LABEL[place.priceLevel] : "Non disponibile"}</DefRow>
              <DefRow label="Stato attività">
                {place.businessStatus ? BUSINESS_STATUS_LABEL[place.businessStatus] ?? place.businessStatus : "—"}
              </DefRow>

              <SubHeading>Stima di apertura</SubHeading>
              <DefRow label="Apertura stimata">
                <span className="font-semibold">{BUCKET_LABEL[place.estimatedOpeningWindow]}</span>
              </DefRow>
              <DefRow label="Confidenza stima">{CONFIDENCE_LABEL[place.estimationConfidence]}</DefRow>
              {place.confirmedOpeningDate && (
                <DefRow label="Data apertura confermata">{formatDate(place.confirmedOpeningDate)}</DefRow>
              )}
              <DefRow label="Recensione più vecchia">
                {place.earliestReviewDate ? formatDate(place.earliestReviewDate) : "Nessun dato"}
              </DefRow>

              <SubHeading>Sistema</SubHeading>
              <DefRow label="Coordinate">
                <span className="num font-mono text-xs">
                  {place.lat}, {place.lng}
                </span>
              </DefRow>
              <DefRow label="Google Place ID">
                <span className="break-all font-mono text-[11px]">{place.placeId}</span>
              </DefRow>
              <DefRow label="Prima comparsa">
                <span className="num">{formatDateTime(place.firstSeenAt)}</span>
              </DefRow>
              <DefRow label="Tentativi di consegna">
                <span className="num">
                  {place.lastDeliveryAttemptAt
                    ? `${place.deliveryAttempts} · ultimo ${formatDateTime(place.lastDeliveryAttemptAt)}`
                    : "Nessuno ancora"}
                </span>
              </DefRow>
            </dl>
          </PanelBody>
        </Panel>

        <div className="grid gap-6">
          <Panel className="rise" style={{ "--i": 3 } as React.CSSProperties}>
            <PanelHeader
              title="Campi personalizzati"
              description="Valori scritti dall'analisi AI o inseriti a mano. Si salvano quando esci dal campo."
            />
            <PanelBody>
              {attributes.length === 0 ? (
                <p className="text-[13px] text-muted-soft">Nessun campo personalizzato in questa lista.</p>
              ) : (
                <div className="grid gap-4">
                  {attributes.map((a) => (
                    <div key={a.id} className="grid gap-1.5">
                      <span className="text-[13px] font-medium">{a.name}</span>
                      <CustomValueInput
                        attribute={a}
                        value={place.customAttributes[a.key]}
                        onSave={(value) => saveCustomValue(a.id, value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </PanelBody>
          </Panel>

          <Panel className="rise" style={{ "--i": 4 } as React.CSSProperties}>
            <PanelHeader title="Attività di questa entry" description="Esecuzioni, analisi e consegne che la riguardano." />
            {logs.length === 0 ? (
              <PanelBody>
                <p className="text-[13px] text-muted-soft">Nessun evento registrato.</p>
              </PanelBody>
            ) : (
              <ol className="relative px-5 py-4">
                <span aria-hidden className="absolute bottom-6 left-[27px] top-6 w-px bg-border" />
                {logs.map((l) => (
                  <li key={l.id} className="relative flex gap-3 py-2.5">
                    <span
                      aria-hidden
                      className={cn("relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card", LEVEL_DOT[l.level] ?? "bg-muted-foreground/50")}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <LevelBadge level={l.level} />
                        <time dateTime={l.createdAt} className="num text-xs text-muted-soft">
                          {formatDateTime(l.createdAt)}
                        </time>
                      </div>
                      <p className="mt-1.5 break-words text-[13px] text-muted-foreground">{l.message}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
