import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = await db.log.findUnique({
    where: { id },
    include: { search: { select: { title: true } } },
  });
  if (!log) return NextResponse.json({ error: "Log non trovato" }, { status: 404 });
  return NextResponse.json({ log });
}
