import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getQuotaCap } from "@/lib/settings";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET() {
  const today = startOfToday();
  const monthStart = startOfMonth();

  const [
    leadsByStatus,
    leadsToday,
    costRowsMonth,
    costRowsToday,
    googleCallsToday,
    quotaCap,
    searchesByStatus,
    nextScheduled,
    listCount,
    listsWithCounts,
    recentErrors,
  ] = await Promise.all([
    db.place.groupBy({ by: ["deliveryStatus"], _count: { _all: true } }),
    db.place.count({ where: { firstSeenAt: { gte: today } } }),
    db.log.groupBy({
      by: ["category"],
      where: { createdAt: { gte: monthStart }, costUsd: { not: null } },
      _sum: { costUsd: true },
    }),
    db.log.groupBy({
      by: ["category"],
      where: { createdAt: { gte: today }, costUsd: { not: null } },
      _sum: { costUsd: true },
    }),
    db.log.count({ where: { category: "google_api", createdAt: { gte: today } } }),
    getQuotaCap(),
    db.search.groupBy({ by: ["status"], _count: { _all: true } }),
    db.search.findFirst({
      where: { status: "active", nextRunAt: { not: null } },
      orderBy: { nextRunAt: "asc" },
      select: { id: true, title: true, nextRunAt: true },
    }),
    db.list.count(),
    db.list.findMany({
      select: { id: true, name: true, _count: { select: { places: true } } },
      orderBy: { places: { _count: "desc" } },
      take: 5,
    }),
    db.log.findMany({
      where: { level: "error" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        category: true,
        message: true,
        createdAt: true,
        search: { select: { title: true } },
      },
    }),
  ]);

  const statusCount = (s: string) =>
    leadsByStatus.find((r) => r.deliveryStatus === s)?._count._all ?? 0;
  const sumFor = (rows: typeof costRowsMonth, cat: string) =>
    Number(rows.find((r) => r.category === cat)?._sum.costUsd ?? 0);

  return NextResponse.json({
    leads: {
      total: leadsByStatus.reduce((s, r) => s + r._count._all, 0),
      pending: statusCount("pending"),
      delivered: statusCount("delivered"),
      failed: statusCount("failed"),
      excluded: statusCount("excluded"),
      newToday: leadsToday,
    },
    costs: {
      monthToDate: {
        googleUsd: sumFor(costRowsMonth, "google_api"),
        aiUsd: sumFor(costRowsMonth, "ai_analysis"),
        totalUsd: sumFor(costRowsMonth, "google_api") + sumFor(costRowsMonth, "ai_analysis"),
      },
      today: {
        googleUsd: sumFor(costRowsToday, "google_api"),
        aiUsd: sumFor(costRowsToday, "ai_analysis"),
        totalUsd: sumFor(costRowsToday, "google_api") + sumFor(costRowsToday, "ai_analysis"),
      },
    },
    googleQuota: {
      usedToday: googleCallsToday,
      cap: quotaCap,
      percent: quotaCap > 0 ? Math.round((googleCallsToday / quotaCap) * 100) : 0,
    },
    searches: {
      active: searchesByStatus.find((r) => r.status === "active")?._count._all ?? 0,
      paused: searchesByStatus.find((r) => r.status === "paused")?._count._all ?? 0,
      draft: searchesByStatus.find((r) => r.status === "draft")?._count._all ?? 0,
      nextScheduled,
    },
    lists: {
      count: listCount,
      topByVolume: listsWithCounts.map((l) => ({ id: l.id, name: l.name, total: l._count.places })),
    },
    recentErrors: recentErrors.map((e) => ({
      id: e.id,
      category: e.category,
      message: e.message,
      createdAt: e.createdAt,
      searchTitle: e.search?.title ?? null,
    })),
    pendingRetries: statusCount("failed"),
  });
}
