import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveFixedFieldDisplay, FIXED_PLACE_FIELDS } from "@/lib/placeFields";
import type { Prisma } from "@prisma/client";

const FIXED_LABEL = new Map(FIXED_PLACE_FIELDS.map((f) => [f.key as string, f.label]));
const DEFAULT_PAGE_SIZE = 25;

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

  const where: Prisma.PlaceWhereInput = { listId: id };
  if (deliveryStatus && deliveryStatus !== "all") {
    where.deliveryStatus = deliveryStatus as Prisma.PlaceWhereInput["deliveryStatus"];
  }

  const [places, total] = await Promise.all([
    db.place.findMany({
      where,
      include: { customValues: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.place.count({ where }),
  ]);

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
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
