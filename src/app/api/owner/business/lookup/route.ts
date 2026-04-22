import { NextResponse } from "next/server";
import { z } from "zod";
import { lookupPlaces } from "@/lib/google-places";
import { getSessionBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

const Body = z.object({ query: z.string().trim().min(1).max(300) });

export async function POST(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid query" }, { status: 400 });
  }

  const results = await lookupPlaces(parsed.data.query);
  return NextResponse.json({ results });
}
