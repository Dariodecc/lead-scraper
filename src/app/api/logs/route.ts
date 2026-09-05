import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const where: Prisma.LogWhereInput = {};

  const level = url.searchParams.get("level");
  if (level && level !== "all") where.level = level as Prisma.LogWhereInput["level"];

  const category = url.searchParams.get("category");
  if (category && category !== "all") where.category = category as Prisma.LogWhereInput["category"];

  const searchId = url.searchParams.get("searchId");
  if (searchId) where.searchId = searchId;

  const placeId = url.searchParams.get("placeId");
  if (placeId) where.placeId = placeId;

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 25)));

  const [logs, total] = await Promise.all([
    db.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { search: { select: { title: true } } },
    }),
    db.log.count({ where }),
  ]);

  return NextResponse.json({ logs, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}
