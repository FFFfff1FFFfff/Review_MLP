import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { resolveGoogleReviewUrl } from "@/lib/google";
import { getNotifier } from "@/lib/notifier";
import { prisma } from "@/lib/prisma";
import { renderSmsBody } from "@/lib/sms-template";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BATCH_SIZE = 10;
const VELOCITY_CAP = 3; // per-business max sends per rolling 24h
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  // Vercel Cron attaches Authorization: Bearer ${CRON_SECRET}.
  if (req.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.reviewRequest.findMany({
    where: {
      scheduledSendAt: { lte: now },
      sentAt: null,
      optedOut: false
    },
    take: BATCH_SIZE,
    orderBy: { scheduledSendAt: "asc" },
    include: { business: true }
  });

  const notifier = getNotifier();
  const results: Array<{ id: string; status: string }> = [];

  for (const row of due) {
    // Revalidate Google URL at send time so a misconfigured business doesn't
    // produce SMS with a dead link.
    if (!resolveGoogleReviewUrl(row.business)) {
      results.push({ id: row.id, status: "skipped-no-google-url" });
      continue;
    }

    const recent = await prisma.reviewRequest.count({
      where: {
        businessId: row.businessId,
        sentAt: { gt: new Date(now.getTime() - DAY_MS) }
      }
    });
    if (recent >= VELOCITY_CAP) {
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
      });
      results.push({ id: row.id, status: "deferred-velocity" });
      continue;
    }

    // Optimistic claim: exactly one concurrent invocation wins.
    const claimed = await prisma.reviewRequest.updateMany({
      where: { id: row.id, sentAt: null },
      data: { sentAt: now }
    });
    if (claimed.count === 0) {
      results.push({ id: row.id, status: "claimed-by-other" });
      continue;
    }

    const body = renderSmsBody(row.business, row.token, env.APP_URL);

    try {
      const { providerId } = await notifier.send(row.clientPhoneE164, body);
      if (providerId) {
        await prisma.reviewRequest.update({
          where: { id: row.id },
          data: { smsSid: providerId }
        });
      }
      results.push({ id: row.id, status: "sent" });
    } catch (e: unknown) {
      // Roll back the claim so the next cron tick retries.
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { sentAt: null }
      });
      console.error(`send failed for ${row.id}:`, e);
      results.push({ id: row.id, status: "send-failed" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
