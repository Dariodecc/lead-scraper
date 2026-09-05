import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { encryptSecret, isSecretSet } from "@/lib/crypto";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const list = await db.list.findUnique({
    where: { id },
    include: { attributes: { orderBy: { position: "asc" } }, searches: { select: { title: true } } },
  });
  if (!list) return NextResponse.json({ error: "Lista non trovata" }, { status: 404 });

  const { outboundWebhookSecretEncrypted, ...rest } = list;
  return NextResponse.json({
    list: {
      ...rest,
      hasOutboundWebhookSecret: isSecretSet(outboundWebhookSecretEncrypted),
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
  // Filtro di invio — a livello di Lista (non Impostazioni, non per-ricerca).
  if (body.deliveryRules !== undefined) data.deliveryRules = body.deliveryRules;
  if (body.excludeChainsThreshold !== undefined) {
    data.excludeChainsThreshold = body.excludeChainsThreshold === null ? null : Number(body.excludeChainsThreshold);
  }
  if (typeof body.aiAnalysisEnabled === "boolean") data.aiAnalysisEnabled = body.aiAnalysisEnabled;
  if (body.aiPromptMd !== undefined) data.aiPromptMd = body.aiPromptMd || null;

  // Webhook in uscita — solo a livello di Lista.
  if (body.outboundWebhookUrl !== undefined) data.outboundWebhookUrl = body.outboundWebhookUrl || null;
  if (typeof body.outboundWebhookSecret === "string" && body.outboundWebhookSecret.length > 0) {
    data.outboundWebhookSecretEncrypted = encryptSecret(body.outboundWebhookSecret);
  }
  if (body.outboundFields !== undefined) {
    data.outboundFields = Array.isArray(body.outboundFields) && body.outboundFields.length > 0
      ? body.outboundFields
      : null;
  }

  const updated = await db.list.update({ where: { id }, data });
  const { outboundWebhookSecretEncrypted, ...rest } = updated;
  return NextResponse.json({
    list: { ...rest, hasOutboundWebhookSecret: isSecretSet(outboundWebhookSecretEncrypted) },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Cascade nello schema: elimina anche tutti i risultati di questa lista (l'utente viene
  // avvisato in UI prima di confermare).
  await db.list.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
