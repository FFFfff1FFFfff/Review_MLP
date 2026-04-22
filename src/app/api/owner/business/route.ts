import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePlaceId } from "@/lib/google-places";
import { getSessionBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const Body = z.object({ googlePlaceId: z.string().trim().min(1).max(300) });

export async function PUT(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Re-validate server-side. Owner confirmation happens in the UI, but the
  // client could POST any string — this guarantees the stored ID resolves.
  const place = await validatePlaceId(parsed.data.googlePlaceId);
  if (!place) {
    return NextResponse.json(
      { error: "Place ID did not resolve to a valid business" },
      { status: 400 }
    );
  }

  // Null out any stale googleReviewUrl override so the derived URL from the
  // new Place ID takes effect.
  await prisma.business.update({
    where: { id: business.id },
    data: { googlePlaceId: place.placeId, googleReviewUrl: null }
  });

  return NextResponse.json({
    ok: true,
    name: place.name,
    formattedAddress: place.formattedAddress
  });
}
