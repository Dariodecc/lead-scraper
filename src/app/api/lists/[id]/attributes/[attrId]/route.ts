import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },
) {
  const { attrId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.type === "string") data.type = body.type;
  if (body.options !== undefined) data.options = body.options;

  const attribute = await db.listAttribute.update({ where: { id: attrId }, data });
  return NextResponse.json({ attribute });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; attrId: string }> },
) {
  const { attrId } = await params;
  await db.listAttribute.delete({ where: { id: attrId } });
  return NextResponse.json({ ok: true });
}
