import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await db.place.findUnique({
    where: { id },
    include: { customValues: { include: { listAttribute: true } } },
  });
  if (!place) return NextResponse.json({ error: "Risultato non trovato" }, { status: 404 });

  const customAttributes: Record<string, unknown> = {};
  for (const cv of place.customValues) {
    customAttributes[cv.listAttribute.key] = cv.value;
  }

  return NextResponse.json({ place: { ...place, customAttributes } });
}
