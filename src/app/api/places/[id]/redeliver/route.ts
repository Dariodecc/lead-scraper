import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueWebhookDelivery } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await db.place.findUnique({ where: { id } });
  if (!place) return NextResponse.json({ error: "Risultato non trovato" }, { status: 404 });

  await db.place.update({ where: { id }, data: { deliveryStatus: "pending" } });
  await enqueueWebhookDelivery(id);

  return NextResponse.json({ ok: true }, { status: 202 });
}
