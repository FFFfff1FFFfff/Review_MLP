import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  text: z.string().trim().min(1).max(2000)
});

export async function POST(
  req: Request,
  { params }: { params: { token: string } }
) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const row = await prisma.reviewRequest.findUnique({
    where: { token: params.token },
    select: {
      id: true,
      ratedAt: true,
      rating: true,
      routedTo: true,
      feedbackSubmittedAt: true
    }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Private feedback only applies to the low-rating branch. Require the row
  // to already be rated — the rating step is what set `routedTo`.
  if (row.routedTo !== "private" || !row.ratedAt || row.rating == null) {
    return NextResponse.json(
      { error: "not a private-feedback request" },
      { status: 400 }
    );
  }
  if (row.feedbackSubmittedAt) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  // Persist atomically. updateMany's filter is the authoritative gate against
  // double-submits; loser gets count=0. Owner sees the feedback on the
  // dashboard's Private feedback inbox — no email is sent.
  const updated = await prisma.reviewRequest.updateMany({
    where: { id: row.id, feedbackSubmittedAt: null },
    data: { reviewText: parsed.data.text, feedbackSubmittedAt: new Date() }
  });
  if (updated.count === 0) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }
  return NextResponse.json({ ok: true });
}
