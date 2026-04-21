import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const Body = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(2000).optional()
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
    select: { id: true, scheduledSendAt: true, ratedAt: true, routedTo: true }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (Date.now() > row.scheduledSendAt.getTime() + EXPIRY_MS) {
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  const { rating, text } = parsed.data;
  const routedTo = rating >= 4 ? "google" : "private";

  // Idempotent write: only applies when ratedAt is still null. Double-submits
  // (e.g. double-click, accidental replay) return the existing route.
  const updated = await prisma.reviewRequest.updateMany({
    where: { id: row.id, ratedAt: null },
    data: { rating, reviewText: text, routedTo, ratedAt: new Date() }
  });

  if (updated.count === 0) {
    return NextResponse.json({
      ok: true,
      alreadyRated: true,
      routedTo: row.routedTo
    });
  }

  return NextResponse.json({ ok: true, routedTo });
}
