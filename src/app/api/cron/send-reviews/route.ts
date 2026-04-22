import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { resolveGoogleReviewUrl } from "@/lib/google";
import { getNotifier, type NotifierTarget } from "@/lib/notifier";
import { prisma } from "@/lib/prisma";
import { renderEmailReview, renderSmsBody } from "@/lib/sms-template";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BATCH_SIZE = 10;
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
    // produce messages with a dead link. Defer (not skip) — otherwise a stuck
    // row would re-enter every batch and starve the queue.
    if (!resolveGoogleReviewUrl(row.business)) {
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
      });
      results.push({ id: row.id, status: "deferred-no-google-url" });
      continue;
    }

    const recent = await prisma.reviewRequest.count({
      where: {
        businessId: row.businessId,
        sentAt: { gt: new Date(now.getTime() - DAY_MS) }
      }
    });
    if (recent >= env.VELOCITY_CAP) {
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
      });
      results.push({ id: row.id, status: "deferred-velocity" });
      continue;
    }

    // Resolve (target, body) per channel. Malformed rows (missing contact
    // data or unknown channel) shouldn't exist given create-time validation
    // — if they do, defer them by a day so they don't starve the batch queue
    // every cron tick. Same template as deferred-no-google-url above.
    let target: NotifierTarget;
    let body: string;
    if (row.deliveryChannel === "sms") {
      if (!row.clientPhoneE164) {
        await prisma.reviewRequest.update({
          where: { id: row.id },
          data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
        });
        results.push({ id: row.id, status: "deferred-missing-phone" });
        continue;
      }
      target = { channel: "sms", toPhoneE164: row.clientPhoneE164 };
      body = renderSmsBody(row.business, row.token, env.APP_URL);
    } else if (row.deliveryChannel === "email") {
      if (!row.clientEmail) {
        await prisma.reviewRequest.update({
          where: { id: row.id },
          data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
        });
        results.push({ id: row.id, status: "deferred-missing-email" });
        continue;
      }
      const rendered = renderEmailReview(row.business, row.token, env.APP_URL);
      target = {
        channel: "email",
        toEmail: row.clientEmail,
        subject: rendered.subject
      };
      body = rendered.text;
    } else {
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { scheduledSendAt: new Date(now.getTime() + DAY_MS) }
      });
      results.push({ id: row.id, status: "deferred-unknown-channel" });
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

    // Wrap ONLY the provider send in the rollback-on-error block. After a
    // successful send the message is already out; a later DB failure must not
    // revert sentAt or the next cron tick will re-deliver.
    let providerId: string | null = null;
    try {
      ({ providerId } = await notifier.send(target, body));
    } catch (e: unknown) {
      await prisma.reviewRequest.update({
        where: { id: row.id },
        data: { sentAt: null }
      });
      console.error(`send failed for ${row.id}:`, e);
      results.push({ id: row.id, status: "send-failed" });
      continue;
    }

    // Send succeeded — record providerId best-effort.
    if (providerId) {
      await prisma.reviewRequest
        .update({
          where: { id: row.id },
          data: { smsSid: providerId }
        })
        .catch((err) =>
          console.error(
            `smsSid persist failed for ${row.id} (message already sent):`,
            err
          )
        );
    }
    results.push({ id: row.id, status: "sent" });
  }

  return NextResponse.json({ processed: results.length, results });
}
