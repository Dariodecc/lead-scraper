import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const lists = await db.list.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      searches: { select: { title: true } },
      _count: { select: { places: true } },
    },
  });

  const withCounts = await Promise.all(
    lists.map(async (l) => {
      const [newCount, deliveredCount, failedCount] = await Promise.all([
        db.place.count({ where: { listId: l.id, deliveryStatus: "pending" } }),
        db.place.count({ where: { listId: l.id, deliveryStatus: "delivered" } }),
        db.place.count({ where: { listId: l.id, deliveryStatus: "failed" } }),
      ]);
      return {
        id: l.id,
        name: l.name,
        searchNames: l.searches.map((s) => s.title).join(", ") || "Nessuna ricerca collegata",
        total: l._count.places,
        newCount,
        deliveredCount,
        failedCount,
        createdAt: l.createdAt,
      };
    }),
  );

  return NextResponse.json({ lists: withCounts });
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name richiesto" }, { status: 400 });
  }

  const attributes = Array.isArray(body.attributes) ? body.attributes : [];

  const list = await db.list.create({
    data: {
      name: body.name,
      visibleFields: attributes.map((a: { key: string }) => a.key),
      cardFields: ["total", "newCount", "failedCount"],
      attributes: {
        create: attributes.map((a: { name: string; key: string; type: string }, i: number) => ({
          name: a.name,
          key: a.key,
          type: a.type,
          position: i,
        })),
      },
    },
    include: { attributes: true },
  });

  return NextResponse.json({ list }, { status: 201 });
}
