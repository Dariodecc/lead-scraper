import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { nearbySearchPlaceIds, getPlaceDetails, NEARBY_MAX_RESULTS } from "../googlePlaces";
import { checkWebsiteStatus } from "../websiteCheck";
import { estimateOpening } from "../lib/openingEstimate";
import { getBucketThresholds, getQuotaCap } from "../settings";
import { enqueueWebhookDelivery } from "../queue";
import { makeLogger } from "../log";
import { generateGrid } from "../grid";
import { evaluateDeliveryRules, type DeliveryRules } from "../deliveryRules";
import { analyzeWebsite, AI_ANALYSIS_ATTR_KEY, AI_SCORE_ATTR_KEY } from "../aiAnalysis";

const db = new PrismaClient();
const log = makeLogger(db);

interface SearchRunJobData {
  searchRunId: string;
}

// Nearby Search (New) tronca a 20 risultati per chiamata, senza paginazione (limite reale
// dell'API, non un nostro difetto — vedi grid.ts). Sotto questa soglia una singola chiamata
// basta; sopra, si copre l'area con una griglia di celle da CELL_RADIUS_M.
const CELL_RADIUS_M = 3000;
const MAX_GRID_CELLS = 30;
// Se una cella (o una zona senza griglia) tocca esattamente il tetto di 20, è quasi certamente
// troncata (successo confermato su una vera zona satura, es. centro Milano) — si suddivide in 4
// sotto-celle a raggio dimezzato e si ripete, fino a questa profondità massima.
const MAX_SUBDIVIDE_DEPTH = 2;
// TEST (§7.2): serve solo a vedere quali campi si popolano per scegliere le colonne — non una
// scansione completa. Poche candidate, ci si ferma al primo risultato davvero nuovo.
const TEST_CANDIDATE_COUNT = 5;

async function googleApiCallsUsedToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return db.log.count({ where: { category: "google_api", createdAt: { gte: startOfDay } } });
}

async function collectCellPlaceIds(params: {
  lat: number;
  lng: number;
  radiusM: number;
  includedType: string;
  depth: number;
  searchId: string;
  idSet: Set<string>;
}): Promise<void> {
  const { lat, lng, radiusM, includedType, depth, searchId, idSet } = params;
  const ids = await nearbySearchPlaceIds({ lat, lng, radiusM, includedType });

  if (ids.length < NEARBY_MAX_RESULTS || depth >= MAX_SUBDIVIDE_DEPTH) {
    ids.forEach((id) => idSet.add(id));
    return;
  }

  // Tetto toccato: zona satura, si suddivide invece di accettare un troncamento silenzioso.
  await log(
    "warning",
    "google_api",
    `Zona densa (${ids.length} risultati su raggio ${Math.round(radiusM)}m) — suddivido in 4 sotto-zone`,
    { searchId },
  );
  const subRadius = radiusM / 2;
  const metersPerDegLat = 111_320;
  const metersPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const offsets: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [dx, dy] of offsets) {
    await collectCellPlaceIds({
      lat: lat + (dy * subRadius) / metersPerDegLat,
      lng: lng + (dx * subRadius) / metersPerDegLng,
      radiusM: subRadius,
      includedType,
      depth: depth + 1,
      searchId,
      idSet,
    });
  }
}

/** Crea (se assenti) i due campi custom ben noti per l'analisi AI e ritorna i loro id. */
async function ensureAiAttributes(listId: string): Promise<{ analysisAttrId: string; scoreAttrId: string }> {
  const [analysisAttr, scoreAttr] = await Promise.all([
    db.listAttribute.upsert({
      where: { listId_key: { listId, key: AI_ANALYSIS_ATTR_KEY } },
      create: { listId, key: AI_ANALYSIS_ATTR_KEY, name: "Analisi", type: "text", position: 100 },
      update: {},
    }),
    db.listAttribute.upsert({
      where: { listId_key: { listId, key: AI_SCORE_ATTR_KEY } },
      create: {
        listId,
        key: AI_SCORE_ATTR_KEY,
        name: "Punteggio contattabilità",
        type: "number",
        position: 101,
      },
      update: {},
    }),
  ]);
  return { analysisAttrId: analysisAttr.id, scoreAttrId: scoreAttr.id };
}

export async function processSearchRun(job: Job<SearchRunJobData>) {
  const run = await db.searchRun.findUnique({
    where: { id: job.data.searchRunId },
    include: { search: true },
  });
  if (!run) return;
  const search = run.search;
  const isTest = run.isTest;

  if (!search.listId) {
    // Non dovrebbe accadere: /api/searches/:id/test crea/collega sempre una lista prima di
    // accodare il job; una ricerca ricorrente non può passare ad "active" senza lista (§4).
    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "failed", error: "Ricerca senza lista di destinazione", finishedAt: new Date() },
    });
    await log("error", "search_run", "Run fallita: ricerca senza lista di destinazione", {
      searchId: search.id,
    });
    return;
  }

  const list = await db.list.findUnique({ where: { id: search.listId } });
  if (!list) {
    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "failed", error: "Lista di destinazione non trovata", finishedAt: new Date() },
    });
    return;
  }
  const deliveryRules = list.deliveryRules as DeliveryRules | null;
  const aiAttrs = list.aiAnalysisEnabled ? await ensureAiAttributes(list.id) : null;

  const quotaCap = await getQuotaCap();
  const usedToday = await googleApiCallsUsedToday();
  if (usedToday >= quotaCap) {
    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "failed", error: "Quota giornaliera Google Places raggiunta", finishedAt: new Date() },
    });
    await log("error", "google_api", "Quota giornaliera raggiunta — run saltata", { searchId: search.id });
    return;
  }
  if (usedToday >= quotaCap * 0.8) {
    await log(
      "warning",
      "google_api",
      `Quota giornaliera all'${Math.round((usedToday / quotaCap) * 100)}%`,
      { searchId: search.id },
    );
  }

  try {
    const centerLat = Number(search.areaLat);
    const centerLng = Number(search.areaLng);
    const placeIdSet = new Set<string>();

    if (isTest) {
      // Solo un piccolo campione dal centro zona — niente griglia, niente suddivisione: il TEST
      // serve a vedere i campi disponibili, non a scansionare l'area (§7.2).
      const ids = await nearbySearchPlaceIds({
        lat: centerLat,
        lng: centerLng,
        radiusM: search.areaRadiusM,
        includedType: search.categoryPlaceType,
        maxResultCount: TEST_CANDIDATE_COUNT,
      });
      ids.forEach((id) => placeIdSet.add(id));
    } else {
      const { cells, truncated } = generateGrid(
        centerLat,
        centerLng,
        search.areaRadiusM,
        CELL_RADIUS_M,
        MAX_GRID_CELLS,
      );

      if (cells.length > 1) {
        await log(
          "info",
          "google_api",
          `Copertura a griglia: ${cells.length} zone da ${CELL_RADIUS_M / 1000}km da scansionare` +
            (truncated ? ` (area troppo ampia, coperto solo il centro entro ${MAX_GRID_CELLS} celle)` : ""),
          { searchId: search.id },
        );
      }

      for (const cell of cells) {
        const usedNow = await googleApiCallsUsedToday();
        if (usedNow >= quotaCap) {
          await log(
            "warning",
            "google_api",
            "Quota giornaliera raggiunta a metà run — copertura griglia interrotta",
            { searchId: search.id },
          );
          break;
        }
        await collectCellPlaceIds({
          lat: cell.lat,
          lng: cell.lng,
          radiusM: cells.length > 1 ? CELL_RADIUS_M : search.areaRadiusM,
          includedType: search.categoryPlaceType,
          depth: 0,
          searchId: search.id,
          idSet: placeIdSet,
        });
      }
    }

    const placeIds = [...placeIdSet];
    await log("info", "google_api", `Nearby Search: ${placeIds.length} risultati unici`, {
      searchId: search.id,
    });

    const thresholds = await getBucketThresholds();
    let newCount = 0;
    let duplicateCount = 0;

    for (const placeId of placeIds) {
      const existing = await db.place.findUnique({ where: { placeId } });
      if (existing) {
        duplicateCount++;
        continue;
      }

      const details = await getPlaceDetails(placeId);
      await log("info", "google_api", `Place Details: ${details.businessName}`, { searchId: search.id });

      const websiteCheck = details.websiteUrl
        ? await checkWebsiteStatus(details.websiteUrl)
        : { status: "outdated" as const, pageText: null };
      const websiteStatus = details.websiteUrl ? websiteCheck.status : "none";
      const firstSeenAt = new Date();
      const { bucket, confidence } = estimateOpening({
        firstSeenAt,
        reviewCount: details.reviewCount,
        earliestReviewDate: details.earliestReviewDate,
        thresholds,
      });

      // Rilevazione catene: se lo stesso nome è già presente in questa lista almeno
      // `excludeChainsThreshold` volte, questo risultato (l'ennesima ripetizione) viene escluso
      // dall'invio — nessuna lista di brand da mantenere, si basa su ciò che si osserva.
      let isChain = false;
      if (list.excludeChainsThreshold != null) {
        const sameNameCount = await db.place.count({
          where: { listId: list.id, businessName: { equals: details.businessName, mode: "insensitive" } },
        });
        isChain = sameNameCount + 1 >= list.excludeChainsThreshold;
      }

      const place = await db.place.create({
        data: {
          placeId: details.placeId,
          businessName: details.businessName || "(nome non disponibile)",
          address: details.address,
          lat: details.lat,
          lng: details.lng,
          phone: details.phone,
          listId: search.listId,
          category: details.category,
          websiteUrl: details.websiteUrl,
          websiteStatus,
          rating: details.rating,
          reviewCount: details.reviewCount,
          priceLevel: details.priceLevel,
          businessStatus: details.businessStatus,
          estimatedOpeningWindow: bucket,
          estimationConfidence: confidence,
          confirmedOpeningDate: details.confirmedOpeningDate,
          earliestReviewDate: details.earliestReviewDate,
          firstSeenAt,
          deliveryStatus: "pending",
        },
      });
      newCount++;

      if (aiAttrs) {
        const result = await analyzeWebsite({
          businessName: place.businessName,
          category: place.category,
          websiteUrl: place.websiteUrl,
          websiteStatus,
          rating: details.rating,
          reviewCount: details.reviewCount,
          pageText: websiteCheck.pageText,
        });
        if (result) {
          await db.$transaction([
            db.placeCustomValue.upsert({
              where: {
                listAttributeId_placeId: { listAttributeId: aiAttrs.analysisAttrId, placeId: place.id },
              },
              create: { listAttributeId: aiAttrs.analysisAttrId, placeId: place.id, value: result.analysis },
              update: { value: result.analysis },
            }),
            db.placeCustomValue.upsert({
              where: {
                listAttributeId_placeId: { listAttributeId: aiAttrs.scoreAttrId, placeId: place.id },
              },
              create: { listAttributeId: aiAttrs.scoreAttrId, placeId: place.id, value: result.score },
              update: { value: result.score },
            }),
          ]);
        }
      }

      const rulesCheck = evaluateDeliveryRules(place, deliveryRules);
      if (isChain || !rulesCheck.allowed) {
        const reason = isChain
          ? `probabile catena (nome ripetuto ${list.excludeChainsThreshold}+ volte nella lista)`
          : `regola di invio: ${rulesCheck.reason}`;
        await db.place.update({ where: { id: place.id }, data: { deliveryStatus: "excluded" } });
        await log("info", "webhook_delivery", `Escluso dall'invio (${reason})`, {
          searchId: search.id,
          placeId: place.id,
        });
      } else {
        await enqueueWebhookDelivery(place.id);
      }

      if (isTest && newCount >= 1) break; // un solo esempio nuovo basta per mappare i campi
    }

    await db.searchRun.update({
      where: { id: run.id },
      data: {
        status: "done",
        resultsCount: placeIds.length,
        newCount,
        duplicateCount,
        finishedAt: new Date(),
      },
    });
    await log(
      "info",
      "search_run",
      `Run completata: ${placeIds.length} risultati, ${newCount} nuovi`,
      { searchId: search.id },
    );
  } catch (err) {
    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "failed", error: String(err), finishedAt: new Date() },
    });
    await log("error", "search_run", `Run fallita: ${String(err)}`, { searchId: search.id });
  }
}
