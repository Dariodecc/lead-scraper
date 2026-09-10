import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enqueueSearchRun } from "@/lib/queue";

// Rilancio manuale di una scansione reale — usato in particolare dalle ricerche "una tantum",
// che dopo la prima esecuzione restano "attive" per sempre (nessuna transizione automatica di
// stato a fine run) e quindi non potrebbero più ripartire dal toggle Attiva/Pausa da solo.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await db.search.findUnique({ where: { id } });
  if (!search) return NextResponse.json({ error: "Ricerca non trovata" }, { status: 404 });
  if (!search.listId) {
    return NextResponse.json(
      { error: "Ricerca senza lista di destinazione collegata" },
      { status: 400 },
    );
  }

  const run = await db.searchRun.create({
    data: { searchId: id, isTest: false, status: "running" },
  });
  await enqueueSearchRun(run.id);

  if (search.status !== "active") {
    await db.search.update({ where: { id }, data: { status: "active" } });
  }

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
