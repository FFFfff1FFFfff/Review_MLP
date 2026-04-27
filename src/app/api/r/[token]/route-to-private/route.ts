import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// One-way switch from the Google paste view to private feedback after the
// customer has already rated. Lets a 4-5★ rater bail on Google and send a
// private comment to the owner instead, without re-entering their rating.
export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const row = await prisma.reviewRequest.findUnique({
    where: { token: params.token },
    select: {
      id: true,
      ratedAt: true,
      routedTo: true,
      feedbackSubmittedAt: true
    }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!row.ratedAt) {
    return NextResponse.json({ error: "not rated yet" }, { status: 400 });
  }
  if (row.routedTo === "private") {
    // Already private — idempotent ok.
    return NextResponse.json({ ok: true });
  }
  if (row.feedbackSubmittedAt) {
    // Shouldn't be reachable (private feedback already in), but guard anyway.
    return NextResponse.json(
      { error: "feedback already submitted" },
      { status: 400 }
    );
  }

  // Atomic flip: only changes the row if it's currently routedTo=google.
  await prisma.reviewRequest.updateMany({
    where: { id: row.id, routedTo: "google" },
    data: { routedTo: "private" }
  });

  return NextResponse.json({ ok: true });
}
