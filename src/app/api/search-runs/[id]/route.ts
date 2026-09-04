import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await db.searchRun.findUnique({ where: { id } });
  if (!run) return NextResponse.json({ error: "Run non trovata" }, { status: 404 });
  return NextResponse.json({ run });
}
