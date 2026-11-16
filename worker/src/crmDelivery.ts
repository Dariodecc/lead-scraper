import { randomUUID } from "node:crypto";
import { Prisma, type Place, type PrismaClient } from "@prisma/client";
import { normalizeName, placeRecordId, TwentyClient, TwentyError, verifiedCompany, type CompanyEvidence } from "./twenty";
import type { WebsiteCheckResult } from "./websiteCheck";

const MAX_ATTEMPTS = 5;
const POLL_MS = 5000;
const LEASE_MS = 180_000;

function config() {
  const { TWENTY_BASE_URL, TWENTY_API_KEY, TWENTY_SYNC_START_AT } = process.env;
  if (!TWENTY_SYNC_START_AT) return null;
  const startAt = new Date(TWENTY_SYNC_START_AT);
  if (!TWENTY_API_KEY || !TWENTY_BASE_URL || !Number.isFinite(startAt.getTime())) {
    throw new Error("Configurazione Twenty incompleta: servono URL, chiave API e data di partenza ISO.");
  }
  const url = new URL(TWENTY_BASE_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/") {
    throw new Error("TWENTY_BASE_URL deve identificare un origin HTTPS.");
  }
  return { startAt, client: new TwentyClient(url, TWENTY_API_KEY) };
}

const integration = (() => {
  try {
    return config();
  } catch {
    console.error("Configurazione Twenty non valida. Controlla URL HTTPS, chiave API e data di partenza ISO.");
    return null;
  }
})();

export function qualifiesForCrm(place: Pick<Place, "firstSeenAt" | "previewOnly">, startAt = integration?.startAt) {
  return !!startAt && !place.previewOnly && place.firstSeenAt >= startAt;
}

function websiteEvidence(place: Place, checked: WebsiteCheckResult | null): CompanyEvidence | undefined {
  if (!checked?.finalUrl || checked.redirectedToDifferentDomain || !checked.httpStatus
    || checked.httpStatus < 200 || checked.httpStatus >= 300) return;

  const name = checked.companyNames.find((candidate) =>
    normalizeName(candidate) === normalizeName(place.businessName));
  if (!name?.trim()) return;

  const source = new URL(checked.finalUrl);
  if (source.protocol !== "https:" && source.protocol !== "http:") return;
  source.search = "";
  source.hash = "";
  return { name: name.trim().replace(/\s+/g, " "), sourceUrl: source.href, website: source.origin };
}

export async function registerCrmDelivery(db: PrismaClient, place: Place, checked: WebsiteCheckResult | null) {
  if (!qualifiesForCrm(place)) return;
  const evidence = websiteEvidence(place, checked);
  await db.$transaction([
    db.crmDelivery.upsert({
      where: { placeId: place.id },
      update: {},
      create: {
        placeId: place.id,
        status: evidence ? "pending" : "review",
        evidence: evidence ? { ...evidence } : undefined,
        message: evidence ? null : "Conferma il nome dell’azienda e indica una fonte indipendente.",
      },
    }),
    db.place.update({ where: { id: place.id }, data: { crmScreeningPending: false } }),
  ]);
}

type Delivery = Prisma.CrmDeliveryGetPayload<{ include: { place: { select: { placeId: true } } } }>;

export async function deliverCrmRecord(db: PrismaClient, delivery: Delivery, token: string, twenty: TwentyClient) {
  const update = (data: Prisma.CrmDeliveryUpdateManyMutationInput) =>
    db.crmDelivery.updateMany({ where: { placeId: delivery.placeId, leaseToken: token }, data });

  try {
    const evidence = delivery.evidence as unknown as CompanyEvidence | null;
    if (!evidence) {
      await update({ status: "review", leaseToken: null, message: "Conferma il nome e la fonte dell’azienda." });
      return;
    }

    const googlePlaceId = delivery.place.placeId;
    const opportunityId = placeRecordId("opportunity", googlePlaceId);
    const existing = await twenty.opportunity(opportunityId);
    let companyId = existing?.companyId ?? delivery.companyId;

    if (existing && !existing.companyId) {
      throw new TwentyError(422, "L’opportunità è già presente nel CRM ma è scollegata dall’azienda.");
    }

    if (!companyId) {
      const newCompanyId = placeRecordId("company", googlePlaceId);
      let company = await twenty.company(newCompanyId);
      if (!company && !delivery.createCompany) {
        const candidates = await twenty.candidates(evidence);
        company = verifiedCompany(evidence, candidates);
        if (!company && candidates.length) {
          await update({
            status: "review",
            leaseToken: null,
            candidates: candidates.map((candidate) => ({
              id: candidate.id,
              name: candidate.name,
              website: candidate.domainName?.primaryLinkUrl ?? null,
              city: candidate.address?.addressCity ?? null,
              street: candidate.address?.addressStreet1 ?? null,
            })),
            message: "Verifica le aziende corrispondenti prima di proseguire.",
          });
          return;
        }
      }
      company ??= await twenty.createCompany(newCompanyId, evidence);
      companyId = company.id;
    }

    if (!existing) {
      const saved = await update({ companyId, dueAt: new Date(Date.now() + LEASE_MS) });
      if (!saved.count) return;
      const opportunity = await twenty.createOpportunity(opportunityId, companyId, evidence.name);
      if (opportunity.companyId !== companyId) {
        throw new TwentyError(422, "L’opportunità è collegata a un’altra azienda nel CRM.");
      }
    }

    await update({
      status: "delivered",
      companyId,
      opportunityId,
      leaseToken: null,
      message: null,
      candidates: Prisma.DbNull,
    });
  } catch (error) {
    const retry = delivery.attempts < MAX_ATTEMPTS && (!(error instanceof TwentyError) || error.retryable);
    const message = error instanceof TwentyError ? error.message : "Connessione a Twenty interrotta o risposta inattesa.";
    await update({
      status: retry ? "pending" : "failed",
      dueAt: new Date(Date.now() + 30_000 * 2 ** (delivery.attempts - 1)),
      leaseToken: null,
      message,
    });
    console.warn(`Consegna CRM ${delivery.placeId}: ${message} Tentativo ${delivery.attempts}.`);
  }
}

export function startCrmDeliveryWorker(db: PrismaClient) {
  const twenty = integration?.client;
  if (!twenty) return async () => {};

  async function processNext(client: TwentyClient) {
    const now = new Date();
    const eligible = {
      status: { in: ["pending", "processing"] },
      dueAt: { lte: now },
    } satisfies Prisma.CrmDeliveryWhereInput;
    const next = await db.crmDelivery.findFirst({ where: eligible, orderBy: { dueAt: "asc" } });
    if (!next) return;

    const token = randomUUID();
    const claim = await db.crmDelivery.updateMany({
      where: { ...eligible, placeId: next.placeId },
      data: { status: "processing", attempts: { increment: 1 }, leaseToken: token, dueAt: new Date(Date.now() + LEASE_MS) },
    });
    if (!claim.count) return;
    const delivery = await db.crmDelivery.findUnique({
      where: { placeId: next.placeId },
      include: { place: { select: { placeId: true } } },
    });
    if (delivery?.leaseToken === token) await deliverCrmRecord(db, delivery, token, client);
  }

  let active: Promise<void> | undefined;
  const tick = () => {
    if (active) return;
    active = processNext(twenty).catch(() => console.error("Errore durante la lettura della coda CRM."))
      .finally(() => { active = undefined; });
  };
  const timer = setInterval(tick, POLL_MS);
  tick();
  console.log("Lead Scraper worker pronto — consegna CRM Twenty attiva");
  return async () => {
    clearInterval(timer);
    await active;
  };
}
