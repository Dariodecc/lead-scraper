import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveFixedFieldDisplay, FIXED_PLACE_FIELDS } from "@/lib/placeFields";
import type { Place, PlaceCustomValue, Prisma } from "@prisma/client";

const FIXED_LABEL = new Map(FIXED_PLACE_FIELDS.map((f) => [f.key as string, f.label]));
const DEFAULT_PAGE_SIZE = 25;

// Valore comparabile (non la stringa di visualizzazione) per l'ordinamento — es. il rating deve
// ordinare come numero, non alfabeticamente sulla stringa "4.5★ (683)".
function sortableFixedValue(p: Place, key: string): number | string | null {
  switch (key) {
    case "rating":
      return p.rating != null ? Number(p.rating) : null;
    case "review_count":
      return p.reviewCount;
    case "price_level":
      return p.priceLevel;
    case "confirmed_opening_date":
      return p.confirmedOpeningDate ? p.confirmedOpeningDate.getTime() : null;
    case "category":
      return p.category;
    case "website_url":
      return p.websiteUrl;
    case "website_status":
      return p.websiteStatus;
    case "business_status":
      return p.businessStatus;
    case "estimated_opening_window":
      return p.estimatedOpeningWindow;
    case "estimation_confidence":
      return p.estimationConfidence;
    default:
      return null;
  }
}

function compareValues(a: number | string | null, b: number | string | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // i valori assenti finiscono in fondo, in entrambe le direzioni
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await db.list.findUnique({
    where: { id },
    include: { attributes: { orderBy: { position: "asc" } } },
  });
  if (!list) return NextResponse.json({ error: "Lista non trovata" }, { status: 404 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE)));
  const deliveryStatus = url.searchParams.get("deliveryStatus");
  const sortBy = url.searchParams.get("sortBy");
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  const where: Prisma.PlaceWhereInput = { listId: id };
  if (deliveryStatus && deliveryStatus !== "all") {
    where.deliveryStatus = deliveryStatus as Prisma.PlaceWhereInput["deliveryStatus"];
  }

  // Lista intera (non paginata a livello di query): un lead-gen interno resta su volumi di
  // centinaia/poche migliaia di righe per lista, non milioni — ordinare in JS su un campo
  // personalizzato (JSON in una tabella collegata, che Prisma non sa ordinare via ORM) è più
  // semplice e robusto di una query SQL grezza, a questo scale.
  const allPlaces = await db.place.findMany({
    where,
    include: { customValues: true },
    orderBy: { createdAt: "desc" },
  });

  const visibleFields = (list.visibleFields as string[]) ?? [];
  const attrByKey = new Map(list.attributes.map((a) => [a.key, a]));

  function customSortValue(p: { customValues: PlaceCustomValue[] }, attrId: string): number | string | null {
    const cv = p.customValues.find((v) => v.listAttributeId === attrId);
    if (!cv || cv.value == null) return null;
    const v = cv.value as unknown;
    if (typeof v === "number" || typeof v === "boolean") return Number(v);
    return String(v);
  }

  if (sortBy) {
    const attr = attrByKey.get(sortBy);
    allPlaces.sort((a, b) => {
      const va = attr ? customSortValue(a, attr.id) : sortableFixedValue(a, sortBy);
      const vb = attr ? customSortValue(b, attr.id) : sortableFixedValue(b, sortBy);
      return compareValues(va, vb) * (sortDir === "asc" ? 1 : -1);
    });
  }

  const total = allPlaces.length;
  const paged = allPlaces.slice((page - 1) * pageSize, page * pageSize);

  const rows = paged.map((p) => {
    const values = visibleFields.map((key) => {
      const attr = attrByKey.get(key);
      if (attr) {
        const cv = p.customValues.find((v) => v.listAttributeId === attr.id);
        return cv ? String(cv.value) : "—";
      }
      return resolveFixedFieldDisplay(p, key);
    });
    return {
      id: p.id,
      name: p.businessName,
      address: p.address,
      deliveryStatus: p.deliveryStatus,
      values,
    };
  });

  return NextResponse.json({
    visibleColumns: visibleFields.map((key) => ({
      key,
      label: attrByKey.get(key)?.name ?? FIXED_LABEL.get(key) ?? key,
    })),
    places: rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
