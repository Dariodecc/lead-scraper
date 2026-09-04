"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import {
  WEBSITE_STATUS_LABEL,
  BUCKET_LABEL,
  CONFIDENCE_LABEL,
  DELIVERY_STATUS_LABEL,
} from "@/lib/placeFields";

interface PlaceDetail {
  id: string;
  businessName: string;
  category: string | null;
  address: string;
  phone: string | null;
  websiteUrl: string | null;
  websiteStatus: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  estimatedOpeningWindow: string;
  estimationConfidence: string;
  deliveryStatus: string;
  customAttributes: Record<string, unknown>;
}

const PRICE_LABEL: Record<number, string> = {
  1: "€ — economico",
  2: "€€ — medio",
  3: "€€€ — alto",
  4: "€€€€ — molto alto",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-hairline-soft pb-2.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px]">{value}</span>
    </div>
  );
}

export function PlaceDrawer({ placeId, onClose }: { placeId: string | null; onClose: () => void }) {
  const [place, setPlace] = useState<PlaceDetail | null>(null);

  useEffect(() => {
    if (!placeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset alla chiusura del drawer
      setPlace(null);
      return;
    }
    fetch(`/api/places/${placeId}`)
      .then((r) => r.json())
      .then((data) => setPlace(data.place));
  }, [placeId]);

  return (
    <Drawer open={!!placeId} onClose={onClose} width={460}>
      {place && (
        <>
          <div className="mb-1.5 text-xs text-muted-soft">Dettaglio risultato</div>
          <h3 className="mb-1 text-[22px] font-semibold tracking-tight">{place.businessName}</h3>
          <p className="mb-6 text-sm text-muted-foreground">
            {place.category ?? "—"} · {place.address}
          </p>
          <div className="flex flex-col gap-3.5">
            <Row label="Telefono" value={<span className="font-mono">{place.phone ?? "—"}</span>} />
            <Row
              label="Sito web"
              value={
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium">
                  {WEBSITE_STATUS_LABEL[place.websiteStatus] ?? place.websiteStatus}
                </span>
              }
            />
            <Row
              label="Rating / recensioni"
              value={place.rating != null ? `${place.rating}★ · ${place.reviewCount ?? 0} recensioni` : "Nessun dato"}
            />
            <Row
              label="Fascia di prezzo (size proxy)"
              value={place.priceLevel ? PRICE_LABEL[place.priceLevel] : "Non disponibile"}
            />
            <Row
              label="Apertura stimata"
              value={
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-semibold">
                  {BUCKET_LABEL[place.estimatedOpeningWindow]}
                </span>
              }
            />
            <Row label="Confidenza stima" value={CONFIDENCE_LABEL[place.estimationConfidence]} />
            {Object.entries(place.customAttributes).map(([key, value]) => (
              <Row key={key} label={key} value={String(value)} />
            ))}
            <Row
              label="Consegna webhook"
              value={
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium">
                  {DELIVERY_STATUS_LABEL[place.deliveryStatus]}
                </span>
              }
            />
          </div>
        </>
      )}
    </Drawer>
  );
}
