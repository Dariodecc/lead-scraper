import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const where: Prisma.PlaceWhereInput = {};

  const listId = url.searchParams.get("listId");
  if (listId) where.listId = listId;

  const deliveryStatus = url.searchParams.get("deliveryStatus");
  if (deliveryStatus) where.deliveryStatus = deliveryStatus as Prisma.PlaceWhereInput["deliveryStatus"];

  const category = url.searchParams.get("category");
  if (category) where.category = category;

  const websiteStatus = url.searchParams.get("websiteStatus");
  if (websiteStatus) where.websiteStatus = websiteStatus as Prisma.PlaceWhereInput["websiteStatus"];

  const estimatedOpeningWindow = url.searchParams.get("estimatedOpeningWindow");
  if (estimatedOpeningWindow) {
    where.estimatedOpeningWindow =
      estimatedOpeningWindow as Prisma.PlaceWhereInput["estimatedOpeningWindow"];
  }

  const places = await db.place.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ places });
}

/** Eliminazione bulk: DELETE con body { ids: string[] } (§ gestione liste/risultati). */
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
  if (ids.length === 0) return NextResponse.json({ error: "ids richiesto" }, { status: 400 });

  const result = await db.place.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ deleted: result.count });
}
