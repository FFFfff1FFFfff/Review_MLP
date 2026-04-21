import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPrivateFeedbackEmail } from "@/lib/email";
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
    include: { business: true }
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

  const { text } = parsed.data;

  // Persist first, atomically. The earlier feedbackSubmittedAt check is
  // read-then-act and non-atomic — two concurrent submits can both clear it
  // and race here. updateMany's filter is the authoritative gate: whichever
  // request sets feedbackSubmittedAt first wins (count=1); the loser gets
  // count=0 and must NOT send an owner email (its text was never persisted,
  // so the email would diverge from the stored feedback).
  const updated = await prisma.reviewRequest.updateMany({
    where: { id: row.id, feedbackSubmittedAt: null },
    data: { reviewText: text, feedbackSubmittedAt: new Date() }
  });
  if (updated.count === 0) {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  try {
    await sendPrivateFeedbackEmail({
      toOwner: row.business.ownerEmail,
      businessName: row.business.name,
      rating: row.rating,
      text,
      clientContact:
        row.deliveryChannel === "sms"
          ? (row.clientPhoneE164 ?? "unknown")
          : (row.clientEmail ?? "unknown")
    });
  } catch (e) {
    // Don't fail the client submission if the notify email fails — the
    // feedback is already persisted and visible in the owner dashboard.
    console.error(`private feedback email failed for ${row.id}:`, e);
  }

  return NextResponse.json({ ok: true });
}
