import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveFixedFieldDisplay, FIXED_PLACE_FIELDS } from "@/lib/placeFields";

const FIXED_LABEL = new Map(FIXED_PLACE_FIELDS.map((f) => [f.key as string, f.label]));

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await db.list.findUnique({
    where: { id },
    include: { attributes: { orderBy: { position: "asc" } } },
  });
  if (!list) return NextResponse.json({ error: "Lista non trovata" }, { status: 404 });

  const places = await db.place.findMany({
    where: { listId: id },
    include: { customValues: true },
    orderBy: { createdAt: "desc" },
  });

  const visibleFields = (list.visibleFields as string[]) ?? [];
  const attrByKey = new Map(list.attributes.map((a) => [a.key, a]));

  const rows = places.map((p) => {
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
  });
}
