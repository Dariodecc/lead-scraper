import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueSearchRun } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await db.search.findUnique({ where: { id } });
  if (!search) return NextResponse.json({ error: "Ricerca non trovata" }, { status: 404 });

  let listId = search.listId;
  if (!listId) {
    // TEST senza lista collegata: ne crea una automaticamente dal titolo della ricerca (§7.2).
    const list = await db.list.create({
      data: { name: search.title, visibleFields: [], cardFields: ["total", "newCount", "failedCount"] },
    });
    listId = list.id;
    await db.search.update({ where: { id }, data: { listId } });
  }

  const run = await db.searchRun.create({
    data: { searchId: id, isTest: true, status: "running" },
  });

  await enqueueSearchRun(run.id);

  return NextResponse.json({ runId: run.id, listId }, { status: 202 });
}
