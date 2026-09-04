import { PrismaClient, type LogCategory, type LogLevel } from "@prisma/client";

export function makeLogger(db: PrismaClient) {
  return function log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    extra: { searchId?: string | null; placeId?: string | null; payload?: unknown } = {},
  ) {
    return db.log.create({
      data: {
        level,
        category,
        message,
        searchId: extra.searchId ?? undefined,
        placeId: extra.placeId ?? undefined,
        payload: extra.payload as never,
      },
    });
  };
}
