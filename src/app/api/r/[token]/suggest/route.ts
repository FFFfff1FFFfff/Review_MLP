import { NextResponse } from "next/server";
import { generateSuggestedReview } from "@/lib/ai-review";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const row = await prisma.reviewRequest.findUnique({
    where: { token: params.token },
    include: { business: true }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Only generate for the 4-5★ Google flow — private feedback doesn't need a
  // Google review draft.
  if (row.routedTo !== "google" || !row.ratedAt) {
    return NextResponse.json(
      { error: "not a google-routed request" },
      { status: 400 }
    );
  }

  // Cached — first generation only. Subsequent calls (refresh, second device)
  // get the same draft, so customers won't be surprised by different text.
  if (row.aiSuggestedReview) {
    return NextResponse.json({ suggested: row.aiSuggestedReview });
  }

  let suggested: string;
  try {
    suggested = await generateSuggestedReview(
      row.business.name,
      row.business.googleBusinessType,
      row.reviewText
    );
  } catch (e) {
    console.error(`AI review generation failed for ${row.id}:`, e);
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }

  // Best-effort persist — if it fails the customer still got their draft.
  await prisma.reviewRequest
    .updateMany({
      where: { id: row.id, aiSuggestedReview: null },
      data: { aiSuggestedReview: suggested }
    })
    .catch((err) =>
      console.error(`AI suggestion persist failed for ${row.id}:`, err)
    );

  return NextResponse.json({ suggested });
}
