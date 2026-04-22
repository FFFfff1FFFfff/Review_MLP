import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionBusiness } from "@/lib/session";
import { resolveGoogleReviewUrl } from "@/lib/google";
import { normalizeContact } from "@/lib/contact";
import { pickScheduledSendAt } from "@/lib/scheduling";
import { generateShortToken } from "@/lib/token";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  channel: z.enum(["sms", "email"]),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  override: z.boolean().optional(),
  // true → skip the 1-3h jitter + 9am-9pm CT window; next cron tick (≤60s)
  // picks it up. Velocity cap and dedup still apply.
  sendNow: z.boolean().optional()
});

const RATE_LIMIT_PER_HOUR = 20;
const DEDUP_WINDOW_DAYS = 30;
const MAX_TOKEN_RETRIES = 5;

export async function POST(req: Request) {
  const business = await getSessionBusiness();
  if (!business) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fail fast if the business has no Google destination configured.
  if (!resolveGoogleReviewUrl(business)) {
    return NextResponse.json(
      { error: "business not configured for Google reviews yet" },
      { status: 400 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const contact = normalizeContact({
    channel: parsed.data.channel,
    phone: parsed.data.phone,
    email: parsed.data.email
  });
  if (!contact) {
    return NextResponse.json(
      {
        error:
          parsed.data.channel === "sms"
            ? "invalid phone number"
            : "invalid email address"
      },
      { status: 400 }
    );
  }

  // Per-business hourly rate limit (channel-agnostic).
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.reviewRequest.count({
    where: { businessId: business.id, createdAt: { gt: hourAgo } }
  });
  if (recentCount >= RATE_LIMIT_PER_HOUR) {
    return NextResponse.json(
      { error: "rate limit: 20 requests per hour" },
      { status: 429 }
    );
  }

  // 30-day dedup keyed on the channel's hash column.
  if (!parsed.data.override) {
    const windowStart = new Date(
      Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const dupeWhere =
      contact.channel === "sms"
        ? { clientPhoneHash: contact.phoneHash }
        : { clientEmailHash: contact.emailHash };
    const dupe = await prisma.reviewRequest.findFirst({
      where: {
        businessId: business.id,
        ...dupeWhere,
        createdAt: { gt: windowStart }
      },
      select: { id: true }
    });
    if (dupe) {
      return NextResponse.json(
        {
          error: `This ${contact.channel === "sms" ? "number" : "address"} was already requested within ${DEDUP_WINDOW_DAYS} days. Submit again to override.`,
          code: "DUPLICATE"
        },
        { status: 409 }
      );
    }
  }

  // sendNow bypasses jitter + send window. Offset 1s into the past so the
  // cron's `scheduledSendAt <= now` filter picks it up on the very next tick
  // (≤60s) without a race.
  const scheduledSendAt = parsed.data.sendNow
    ? new Date(Date.now() - 1000)
    : pickScheduledSendAt();

  const contactFields =
    contact.channel === "sms"
      ? {
          deliveryChannel: "sms" as const,
          clientPhoneE164: contact.phoneE164,
          clientPhoneHash: contact.phoneHash
        }
      : {
          deliveryChannel: "email" as const,
          clientEmail: contact.email,
          clientEmailHash: contact.emailHash
        };

  // Retry on the rare token collision; token is unique.
  for (let i = 0; i < MAX_TOKEN_RETRIES; i++) {
    const token = generateShortToken();
    try {
      const row = await prisma.reviewRequest.create({
        data: {
          businessId: business.id,
          scheduledSendAt,
          token,
          ...contactFields
        }
      });
      return NextResponse.json({ ok: true, id: row.id, scheduledSendAt });
    } catch (e: unknown) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }
  }
  return NextResponse.json({ error: "could not generate token" }, { status: 500 });
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "P2002"
  );
}
