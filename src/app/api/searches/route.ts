import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeNextRunAt } from "@/lib/scheduling";
import { placeTypeLabel } from "@/lib/placeTypes";

export async function GET() {
  const searches = await db.search.findMany({
    orderBy: { createdAt: "desc" },
    include: { list: { select: { name: true } }, runs: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  return NextResponse.json({ searches });
}

export async function POST(req: Request) {
  const body = await req.json();

  const required = ["title", "areaPlaceId", "areaLabel", "areaLat", "areaLng", "categoryPlaceType", "frequency"];
  for (const field of required) {
    if (body[field] == null) {
      return NextResponse.json({ error: `${field} richiesto` }, { status: 400 });
    }
  }

  const frequency = body.frequency as "once" | "weekly" | "monthly";
  const time = body.scheduleTime ?? "07:00";
  let nextRunAt: Date | null = null;
  try {
    nextRunAt = computeNextRunAt({
      frequency,
      dayOfWeek: body.scheduleDayOfWeek,
      dayOfMonth: body.scheduleDayOfMonth,
      time,
    });
  } catch {
    // once, o campi giorno mancanti per weekly/monthly — resta null, verrà validato all'attivazione.
  }

  const search = await db.search.create({
    data: {
      title: body.title,
      areaPlaceId: body.areaPlaceId,
      areaLabel: body.areaLabel,
      areaLat: body.areaLat,
      areaLng: body.areaLng,
      areaRadiusM: body.areaRadiusM ?? 15000,
      categoryPlaceType: body.categoryPlaceType,
      categoryLabel: body.categoryLabel ?? placeTypeLabel(body.categoryPlaceType),
      frequency,
      scheduleDayOfWeek: body.scheduleDayOfWeek ?? null,
      scheduleDayOfMonth: body.scheduleDayOfMonth ?? null,
      scheduleTime: time,
      nextRunAt,
      listId: body.listId || null,
      status: "draft",
    },
  });

  return NextResponse.json({ search }, { status: 201 });
}
