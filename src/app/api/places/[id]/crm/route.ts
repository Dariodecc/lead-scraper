import { createHash, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const uuid = z.string().uuid();
const publicUrl = z.string().trim().max(2000).url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
}, "Usa un URL HTTP o HTTPS.");
const independentSource = publicUrl.refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.hostname !== "maps.app.goo.gl"
    && !(url.hostname === "goo.gl" && url.pathname.startsWith("/maps"))
    && !/^maps\.google\./.test(url.hostname)
    && !(/(^|\.)google\.[a-z.]+$/i.test(url.hostname) && url.pathname.startsWith("/maps"));
}, "Indica una fonte indipendente da Google Maps.");
const evidence = z.object({
  name: z.string().trim().min(1).max(250),
  sourceUrl: independentSource,
  website: independentSource.optional(),
  street: z.string().trim().min(1).max(250).optional(),
  city: z.string().trim().min(1).max(150).optional(),
  postcode: z.string().trim().min(1).max(30).optional(),
});
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retry") }),
  z.object({
    action: z.literal("confirm"),
    evidence,
    company: z.union([uuid, z.literal("new")]).optional(),
    revision: z.string().datetime(),
  }),
]);

function authorized(request: Request) {
  const secret = process.env.TWENTY_REVIEW_TOKEN;
  const auth = request.headers.get("authorization");
  if (!secret || !auth?.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(secret), digest(auth.slice(7)));
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return error("Codice operatore non valido.", 401);
  const { id } = await params;
  if (!uuid.safeParse(id).success) return error("Risultato non trovato.", 404);
  const delivery = await db.crmDelivery.findUnique({
    where: { placeId: id },
    select: { status: true, candidates: true, evidence: true, updatedAt: true },
  });
  if (!delivery) return error("Consegna CRM non trovata.", 404);
  return NextResponse.json(delivery, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return error("Codice operatore non valido.", 401);
  const { id } = await params;
  if (!uuid.safeParse(id).success) return error("Risultato non trovato.", 404);
  const parsed = action.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  const input = parsed.data;
  const reset = { status: "pending", dueAt: new Date(), attempts: 0, message: null } as const;
  if (input.action === "retry") {
    const result = await db.crmDelivery.updateMany({ where: { placeId: id, status: "failed" }, data: reset });
    if (!result.count) return error("La consegna CRM non è più in errore.", 409);
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const delivery = await db.crmDelivery.findUnique({
    where: { placeId: id },
    select: { status: true, candidates: true },
  });
  if (delivery?.status !== "review") return error("La consegna CRM non è più in verifica.", 409);

  const candidates = z.array(z.object({ id: uuid })).parse(delivery.candidates ?? []);
  if (candidates.length && !input.company) return error("Scegli un’azienda CRM oppure creane una nuova.", 400);
  if (input.company && (input.company === "new" ? !candidates.length : !candidates.some(({ id }) => id === input.company))) {
    return error("La scelta dell’azienda non è valida.", 400);
  }

  const result = await db.crmDelivery.updateMany({
    where: { placeId: id, status: "review", updatedAt: new Date(input.revision) },
    data: {
      ...reset,
      evidence: input.evidence,
      candidates: Prisma.DbNull,
      companyId: input.company && input.company !== "new" ? input.company : null,
      createCompany: input.company === "new",
    },
  });
  if (!result.count) return error("La verifica è cambiata. Riapri la scheda CRM.", 409);
  return NextResponse.json({ ok: true }, { status: 202 });
}
