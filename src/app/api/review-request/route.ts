import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionBusiness } from "@/lib/session";
import { resolveGoogleReviewUrl } from "@/lib/google";
import { normalizePhone } from "@/lib/phone";
import { pickScheduledSendAt } from "@/lib/scheduling";
import { generateShortToken } from "@/lib/token";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  phone: z.string().min(1),
  override: z.boolean().optional()
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

  const normalized = normalizePhone(parsed.data.phone);
  if (!normalized) {
    return NextResponse.json({ error: "invalid phone number" }, { status: 400 });
  }

  // Per-business hourly rate limit.
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

  // 30-day dedup (warn once; override allowed on resubmit).
  if (!parsed.data.override) {
    const windowStart = new Date(
      Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const dupe = await prisma.reviewRequest.findFirst({
      where: {
        businessId: business.id,
        clientPhoneHash: normalized.hash,
        createdAt: { gt: windowStart }
      },
      select: { id: true }
    });
    if (dupe) {
      return NextResponse.json(
        {
          error: `This number was already requested within ${DEDUP_WINDOW_DAYS} days. Submit again to override.`,
          code: "DUPLICATE"
        },
        { status: 409 }
      );
    }
  }

  const scheduledSendAt = pickScheduledSendAt();

  // Retry on the rare token collision; token is unique.
  for (let i = 0; i < MAX_TOKEN_RETRIES; i++) {
    const token = generateShortToken();
    try {
      const row = await prisma.reviewRequest.create({
        data: {
          businessId: business.id,
          clientPhoneE164: normalized.e164,
          clientPhoneHash: normalized.hash,
          scheduledSendAt,
          token
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
