import { signToken } from "./auth";
import { sendMagicLinkEmail } from "./email";
import { env } from "./env";
import { prisma } from "./prisma";

const COOLDOWN_MS = 60_000;

// Atomically claim a per-email cooldown slot and dispatch a magic-link email
// if we won. Returns false if throttled. Callers should return 200 either way
// — the uniform response preserves enumeration protection upstream.
//
// NOTE: a black-box test of 20 rapid POSTs to /api/auth/{request,signup} will
// see 20x 200 on purpose. Verify the throttle via Resend dashboard or
// Business.lastMagicLinkSentAt in DB, not HTTP status codes.
export async function dispatchMagicLinkIfReady(params: {
  businessId: string;
  email: string;
}): Promise<{ dispatched: boolean }> {
  const claimed = await prisma.business.updateMany({
    where: {
      id: params.businessId,
      OR: [
        { lastMagicLinkSentAt: null },
        { lastMagicLinkSentAt: { lt: new Date(Date.now() - COOLDOWN_MS) } }
      ]
    },
    data: { lastMagicLinkSentAt: new Date() }
  });
  if (claimed.count === 0) {
    return { dispatched: false };
  }

  const token = await signToken(params.email, "magic", env.AUTH_SECRET);
  const url = `${env.APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLinkEmail(params.email, url);
  return { dispatched: true };
}
