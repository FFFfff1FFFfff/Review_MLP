import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Twilio POSTs status events here for SMS rows that were sent with a
// StatusCallback URL. We only persist the "delivered" terminal event —
// intermediate states (queued / sent / sending) are noisy and don't change
// what the dashboard needs to show.
//
// Validation follows Twilio's HMAC-SHA1 scheme:
//   sig = base64(hmac_sha1(authToken, fullUrl + sortedFormParams))
// where fullUrl is the public URL Twilio called and sortedFormParams is the
// alphabetised concatenation of "<key><value>" pairs. Non-matching requests
// are 403'd before any DB work.
export async function POST(req: Request) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string") params[k] = v;
  }

  const signature = req.headers.get("x-twilio-signature") ?? "";
  const fullUrl = `${env.APP_URL}/api/sms/status-callback`;
  const expected = computeTwilioSignature(
    env.TWILIO_AUTH_TOKEN,
    fullUrl,
    params
  );
  // timingSafeEqual rejects unequal-length inputs, so guard explicitly.
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return NextResponse.json({ error: "bad signature" }, { status: 403 });
  }

  const sid = params.MessageSid;
  const status = params.MessageStatus;
  if (!sid || !status) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  if (status === "delivered") {
    // updateMany so we no-op cleanly if the row was already marked or never
    // existed (e.g. re-deliveries after manual Twilio resends).
    await prisma.reviewRequest.updateMany({
      where: { smsSid: sid, smsDeliveredAt: null },
      data: { smsDeliveredAt: new Date() }
    });
  }

  return NextResponse.json({ ok: true });
}

function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  return crypto.createHmac("sha1", authToken).update(data).digest("base64");
}
