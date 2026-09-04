import { NextResponse } from "next/server";
import { autocompleteArea } from "@/lib/googlePlaces";

export async function GET(req: Request) {
  const input = new URL(req.url).searchParams.get("input")?.trim();
  if (!input || input.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const suggestions = await autocompleteArea(input);
    return NextResponse.json({ suggestions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
