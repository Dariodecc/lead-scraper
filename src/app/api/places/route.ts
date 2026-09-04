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
