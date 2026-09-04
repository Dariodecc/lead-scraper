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

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const logs = await db.log.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { search: { select: { title: true } } },
  });

  return NextResponse.json({ logs });
}
