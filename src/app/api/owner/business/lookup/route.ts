import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupPlaces, PlacesApiError } from "@/lib/google-places";
import { getSessionBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const Body = z.object({ query: z.string().trim().min(1).max(500) });

export async function POST(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  try {
    const results = await lookupPlaces(parsed.data.query);
    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof PlacesApiError) {
      // Pass the Places API's own message straight back so the owner knows
      // whether it's a key/enable issue vs an input issue.
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    console.error("places lookup failed:", e);
    return NextResponse.json(
      {
        error:
          "Lookup failed. Check server logs. (Most common: GOOGLE_PLACES_API_KEY not set in Vercel.)"
      },
      { status: 500 }
    );
  }
}
