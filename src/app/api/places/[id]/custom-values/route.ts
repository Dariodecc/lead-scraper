import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Modifica manuale del valore di un campo personalizzato per un singolo risultato — oggi i
// valori (es. scritti dall'analisi AI) si vedevano ma non si potevano correggere a mano.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: placeId } = await params;
  const body = await req.json();
  const { listAttributeId, value } = body as { listAttributeId?: string; value?: unknown };
  if (!listAttributeId) {
    return NextResponse.json({ error: "listAttributeId richiesto" }, { status: 400 });
  }

  const place = await db.place.findUnique({ where: { id: placeId } });
  if (!place) return NextResponse.json({ error: "Risultato non trovato" }, { status: 404 });

  const attribute = await db.listAttribute.findUnique({ where: { id: listAttributeId } });
  if (!attribute || attribute.listId !== place.listId) {
    return NextResponse.json({ error: "Campo personalizzato non valido per questa lista" }, { status: 400 });
  }

  const customValue = await db.placeCustomValue.upsert({
    where: { listAttributeId_placeId: { listAttributeId, placeId } },
    create: { listAttributeId, placeId, value: value as never },
    update: { value: value as never },
  });

  return NextResponse.json({ customValue });
}
