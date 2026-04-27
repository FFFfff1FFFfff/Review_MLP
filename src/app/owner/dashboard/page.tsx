import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SmsStatusButton from "@/components/SmsStatusButton";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function DashboardPage() {
  const business = await getSessionBusiness();
  if (!business) redirect("/owner/login");

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const scope = { businessId: business.id, createdAt: { gt: since } };

  const [
    createdCount,
    sentCount,
    clickedCount,
    ratedCount,
    googleClickedCount,
    privateFeedback,
    recent
  ] = await Promise.all([
    prisma.reviewRequest.count({ where: scope }),
    prisma.reviewRequest.count({ where: { ...scope, sentAt: { not: null } } }),
    prisma.reviewRequest.count({ where: { ...scope, clickedAt: { not: null } } }),
    prisma.reviewRequest.count({ where: { ...scope, ratedAt: { not: null } } }),
    prisma.reviewRequest.count({
      where: { ...scope, googleClickedAt: { not: null } }
    }),
    prisma.reviewRequest.findMany({
      where: {
        businessId: business.id,
        routedTo: "private",
        feedbackSubmittedAt: { not: null }
      },
      orderBy: { feedbackSubmittedAt: "desc" },
      take: 20
    }),
    prisma.reviewRequest.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const needsPlaceIdSetup =
    !business.googlePlaceId && !business.googleReviewUrl;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-4 w-4" />
        <span>Alauda Review</span>
      </div>
      <div className="mt-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Signed in as {business.ownerEmail}
          </p>
        </div>
        <Link href="/owner/settings" className="text-sm underline">
          Settings
        </Link>
      </div>

      {needsPlaceIdSetup && (
        <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Review requests can&apos;t send yet — your Google Place ID isn&apos;t
          set. <Link href="/owner/settings" className="underline">Add it in Settings</Link>.
        </div>
      )}

      <Link
        href="/owner/new"
        className="mt-6 inline-block rounded bg-black px-4 py-2 text-sm text-white"
      >
        + Request a review
      </Link>

      <h2 className="mt-10 text-lg font-semibold">Funnel — last {WINDOW_DAYS} days</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <FunnelCard label="Requested" value={createdCount} />
        <FunnelCard label="Delivered" value={sentCount} />
        <FunnelCard label="Clicked" value={clickedCount} />
        <FunnelCard label="Rated" value={ratedCount} />
        <FunnelCard label="Google-clicked" value={googleClickedCount} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Private feedback</h2>
      {privateFeedback.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No private feedback yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {privateFeedback.map((r) => (
            <li
              key={r.id}
              className="rounded border border-gray-200 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.rating}★</span>
                <span className="text-xs text-gray-500">
                  {r.feedbackSubmittedAt?.toLocaleString() ?? ""}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-gray-800">
                {r.reviewText}
              </p>
              <div className="mt-2 font-mono text-xs text-gray-500">
                {r.deliveryChannel === "sms"
                  ? r.clientPhoneE164
                  : r.clientEmail}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-lg font-semibold">Recent requests</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No requests yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
          {recent.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-700">
                  {r.deliveryChannel}
                </span>
                {r.routedTo === "private" && r.ratedAt && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs uppercase text-amber-800">
                    private
                  </span>
                )}
                {r.routedTo === "google" && r.googleClickedAt && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-xs uppercase text-green-800">
                    opened google
                  </span>
                )}
                <span className="font-mono">
                  {r.deliveryChannel === "sms"
                    ? r.clientPhoneE164
                    : r.clientEmail}
                </span>
              </div>
              <div className="mt-1 text-gray-600">
                scheduled {r.scheduledSendAt.toISOString()}
                {r.sentAt ? " · sent" : " · pending"}
                {r.ratedAt ? ` · rated ${r.rating}★` : ""}
                {r.optedOut ? " · opted out" : ""}
              </div>
              {r.reviewText && (
                <p className="mt-2 whitespace-pre-wrap text-gray-800">
                  {r.reviewText}
                </p>
              )}
              {r.smsSid && (
                <div className="mt-1">
                  <SmsStatusButton sid={r.smsSid} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function FunnelCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}
