import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await db.list.findUnique({
    where: { id },
    include: { attributes: { orderBy: { position: "asc" } }, searches: { select: { title: true } } },
  });
  if (!list) return NextResponse.json({ error: "Lista non trovata" }, { status: 404 });

  return NextResponse.json({
    list: {
      ...list,
      searchNames: list.searches.map((s) => s.title).join(", ") || "Nessuna ricerca collegata",
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (Array.isArray(body.visibleFields)) data.visibleFields = body.visibleFields;
  if (Array.isArray(body.cardFields)) data.cardFields = body.cardFields;

  const list = await db.list.update({ where: { id }, data });
  return NextResponse.json({ list });
}
