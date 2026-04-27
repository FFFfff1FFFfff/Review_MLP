import { NextResponse } from "next/server";
import { z } from "zod";
import { validatePlaceId } from "@/lib/google-places";
import { getSessionBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Both fields are optional so the same endpoint serves "save the connected
// Google listing" and "save the owner's freeform description" without a
// second route. At least one must be present.
const Body = z
  .object({
    googlePlaceId: z.string().trim().min(1).max(300).optional(),
    ownerDescription: z.string().trim().max(500).optional()
  })
  .refine(
    (b) => b.googlePlaceId !== undefined || b.ownerDescription !== undefined,
    "expected googlePlaceId or ownerDescription"
  );

export async function PUT(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const data: {
    googlePlaceId?: string;
    googleReviewUrl?: null;
    name?: string;
    googleBusinessType?: string | null;
    googleEditorialSummary?: string | null;
    ownerDescription?: string | null;
  } = {};

  if (parsed.data.googlePlaceId !== undefined) {
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
    // new Place ID takes effect. Also sync business.name to Google's canonical
    // value (so the dashboard stops showing whatever placeholder the seed set)
    // and cache type + editorial summary for the AI review prompt's grounding.
    data.googlePlaceId = place.placeId;
    data.googleReviewUrl = null;
    data.name = place.name;
    data.googleBusinessType = place.primaryType;
    data.googleEditorialSummary = place.editorialSummary;
  }

  if (parsed.data.ownerDescription !== undefined) {
    // Empty string clears the field (owner deleted their description); zod
    // already enforced max length.
    data.ownerDescription = parsed.data.ownerDescription || null;
  }

  await prisma.business.update({
    where: { id: business.id },
    data
  });

  return NextResponse.json({ ok: true });
}
