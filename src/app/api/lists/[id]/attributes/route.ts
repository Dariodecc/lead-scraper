import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attributes = await db.listAttribute.findMany({
    where: { listId: id },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ attributes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name richiesto" }, { status: 400 });
  }

  const count = await db.listAttribute.count({ where: { listId: id } });
  const attribute = await db.listAttribute.create({
    data: {
      listId: id,
      name: body.name,
      key: slugify(body.name),
      type: body.type ?? "text",
      position: count,
    },
  });
  return NextResponse.json({ attribute }, { status: 201 });
}
