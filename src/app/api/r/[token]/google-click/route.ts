import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      googleClickedAt: true
    }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Only Google-routed customers (4-5★) should ever hit the Google CTA.
  // Without this gate any holder of a private-routed token can POST here and
  // poison the owner dashboard's Google-click funnel metric.
  if (!row.ratedAt || row.routedTo !== "google") {
    return NextResponse.json(
      { error: "not a google-routed request" },
      { status: 400 }
    );
  }

  // Idempotent: only the first click writes googleClickedAt.
  if (!row.googleClickedAt) {
    await prisma.reviewRequest.updateMany({
      where: { id: row.id, googleClickedAt: null },
      data: { googleClickedAt: new Date() }
    });
  }

  return NextResponse.json({ ok: true });
}
