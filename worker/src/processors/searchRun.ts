import type { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { nearbySearchPlaceIds, getPlaceDetails } from "../googlePlaces";
import { checkWebsiteStatus } from "../websiteCheck";
import { estimateOpening } from "../lib/openingEstimate";
import { getBucketThresholds, getQuotaCap } from "../settings";
import { enqueueWebhookDelivery } from "../queue";
import { makeLogger } from "../log";

const db = new PrismaClient();
const log = makeLogger(db);

interface SearchRunJobData {
  searchRunId: string;
}

async function googleApiCallsUsedToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return db.log.count({ where: { category: "google_api", createdAt: { gte: startOfDay } } });
}

export async function processSearchRun(job: Job<SearchRunJobData>) {
  const run = await db.searchRun.findUnique({
    where: { id: job.data.searchRunId },
    include: { search: true },
  });
  if (!run) return;
  const search = run.search;

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
    const placeIds = await nearbySearchPlaceIds({
      lat: Number(search.areaLat),
      lng: Number(search.areaLng),
      radiusM: search.areaRadiusM,
      includedType: search.categoryPlaceType,
    });
    await log("info", "google_api", `Nearby Search: ${placeIds.length} risultati`, { searchId: search.id });

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

      const websiteStatus = details.websiteUrl ? await checkWebsiteStatus(details.websiteUrl) : "none";
      const firstSeenAt = new Date();
      const { bucket, confidence } = estimateOpening({
        firstSeenAt,
        reviewCount: details.reviewCount,
        earliestReviewDate: details.earliestReviewDate,
        thresholds,
      });

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
      await enqueueWebhookDelivery(place.id);
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
