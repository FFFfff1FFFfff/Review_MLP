import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { token: string } }
) {
  const row = await prisma.reviewRequest.findUnique({
    where: { token: params.token },
    select: { id: true, googleClickedAt: true }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
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
