import { NextResponse } from "next/server";
import { getSessionBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Hard delete a review request the owner no longer wants in their dashboard
// (most often: cleaning up test rows). Scoped via deleteMany's businessId
// filter — passing a SID owned by another tenant returns count=0 → 404, so
// the endpoint can't be used to probe other businesses' IDs.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await prisma.reviewRequest.deleteMany({
    where: { id: params.id, businessId: business.id }
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
