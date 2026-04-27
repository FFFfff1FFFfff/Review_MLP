import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSessionBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

// Debug endpoint: owner looks up the live Twilio delivery status for one of
// their own review requests without needing Twilio console access. Scoped to
// the session's business so one owner can't probe another's SIDs.
export async function GET(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sid = new URL(req.url).searchParams.get("sid");
  if (!sid || !/^SM[a-zA-Z0-9]+$/.test(sid)) {
    return NextResponse.json({ error: "invalid sid" }, { status: 400 });
  }

  // Scope check — does this SID belong to a ReviewRequest owned by this
  // business?
  const row = await prisma.reviewRequest.findFirst({
    where: { smsSid: sid, businessId: business.id },
    select: { id: true }
  });
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages/${sid}.json`;
  const auth = Buffer.from(
    `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const res = await fetch(twilioUrl, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store"
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Twilio ${res.status}: ${errBody}` },
      { status: 502 }
    );
  }
  const data = (await res.json()) as {
    status?: string;
    error_code?: number | null;
    error_message?: string | null;
    date_updated?: string;
    date_sent?: string | null;
  };

  return NextResponse.json({
    status: data.status ?? null,
    errorCode: data.error_code ?? null,
    errorMessage: data.error_message ?? null,
    dateSent: data.date_sent ?? null,
    dateUpdated: data.date_updated ?? null
  });
}
