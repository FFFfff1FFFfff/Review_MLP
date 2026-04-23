import { NextResponse } from "next/server";
import { z } from "zod";
import { signToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const Body = z.object({ email: z.string().email() });
const COOLDOWN_MS = 60_000;

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  // Only send magic links to emails registered as a Business owner.
  const business = await prisma.business.findUnique({ where: { ownerEmail: email } });
  if (!business) {
    // Respond 200 to avoid leaking which emails are registered.
    return NextResponse.json({ ok: true });
  }

  // Atomic per-email cooldown: exactly one request per COOLDOWN_MS window
  // claims the slot and sends. Throttled callers also receive 200 — same
  // shape, no timing-distinguishable extra work — to preserve the
  // enumeration protection above. A black-box test of 15 rapid POSTs will
  // see 15x 200 on purpose; the throttle only limits how many actually
  // reach sendMagicLinkEmail. Verify via Resend dashboard / lastMagicLinkSentAt
  // in DB, not via HTTP status codes.
  const claimed = await prisma.business.updateMany({
    where: {
      id: business.id,
      OR: [
        { lastMagicLinkSentAt: null },
        { lastMagicLinkSentAt: { lt: new Date(Date.now() - COOLDOWN_MS) } }
      ]
    },
    data: { lastMagicLinkSentAt: new Date() }
  });
  if (claimed.count === 0) {
    return NextResponse.json({ ok: true });
  }

  const token = await signToken(email, "magic", env.AUTH_SECRET);
  const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(email, url);

  return NextResponse.json({ ok: true });
}
