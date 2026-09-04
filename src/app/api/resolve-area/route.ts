import { NextResponse } from "next/server";
import { resolveArea } from "@/lib/googlePlaces";

export async function POST(req: Request) {
  const { placeId } = await req.json();
  if (!placeId) return NextResponse.json({ error: "placeId richiesto" }, { status: 400 });

  try {
    const area = await resolveArea(placeId);
    return NextResponse.json(area);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
