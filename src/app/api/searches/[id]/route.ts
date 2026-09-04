import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { computeNextRunAt } from "@/lib/scheduling";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await db.search.findUnique({
    where: { id },
    include: { runs: { orderBy: { startedAt: "desc" } } },
  });
  if (!search) return NextResponse.json({ error: "Ricerca non trovata" }, { status: 404 });
  return NextResponse.json({ search });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const existing = await db.search.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Ricerca non trovata" }, { status: 404 });

  const data: Record<string, unknown> = {};
  const passthrough = [
    "title",
    "areaPlaceId",
    "areaLabel",
    "areaLat",
    "areaLng",
    "areaRadiusM",
    "categoryPlaceType",
    "categoryLabel",
    "outboundWebhookUrl",
    "outboundFields",
    "listId",
  ] as const;
  for (const field of passthrough) {
    if (body[field] !== undefined) data[field] = body[field] || null;
  }
  if (body.outboundWebhookSecret) {
    data.outboundWebhookSecretEncrypted = encryptSecret(body.outboundWebhookSecret);
  }

  const frequency = body.frequency ?? existing.frequency;
  const scheduleChanged =
    body.frequency !== undefined ||
    body.scheduleDayOfWeek !== undefined ||
    body.scheduleDayOfMonth !== undefined ||
    body.scheduleTime !== undefined;

  if (body.frequency !== undefined) data.frequency = body.frequency;
  if (body.scheduleDayOfWeek !== undefined) data.scheduleDayOfWeek = body.scheduleDayOfWeek;
  if (body.scheduleDayOfMonth !== undefined) data.scheduleDayOfMonth = body.scheduleDayOfMonth;
  if (body.scheduleTime !== undefined) data.scheduleTime = body.scheduleTime;

  if (scheduleChanged) {
    try {
      data.nextRunAt = computeNextRunAt({
        frequency,
        dayOfWeek: body.scheduleDayOfWeek ?? existing.scheduleDayOfWeek,
        dayOfMonth: body.scheduleDayOfMonth ?? existing.scheduleDayOfMonth,
        time: body.scheduleTime ?? existing.scheduleTime ?? "07:00",
      });
    } catch {
      data.nextRunAt = null;
    }
  }

  if (body.status !== undefined) {
    const targetListId = body.listId !== undefined ? body.listId : existing.listId;
    if (body.status === "active" && !targetListId) {
      return NextResponse.json(
        { error: "Una ricerca non può diventare attiva senza una lista di destinazione collegata" },
        { status: 400 },
      );
    }
    data.status = body.status;
  }

  const search = await db.search.update({ where: { id }, data });
  return NextResponse.json({ search });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.search.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
