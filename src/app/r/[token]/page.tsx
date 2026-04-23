import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveGoogleReviewUrl } from "@/lib/google";
import RatingForm from "@/components/RatingForm";

// Token links are time-sensitive; never cache.
export const dynamic = "force-dynamic";

const EXPIRY_DAYS = 7;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export default async function RateReviewPage({
  params
}: {
  params: { token: string };
}) {
  const req = await prisma.reviewRequest.findUnique({
    where: { token: params.token },
    include: { business: true }
  });

  if (!req) notFound();

  // Record first click for funnel tracking. Only writes once.
  if (!req.clickedAt) {
    await prisma.reviewRequest.update({
      where: { id: req.id },
      data: { clickedAt: new Date() }
    });
  }

  const expired = Date.now() > req.scheduledSendAt.getTime() + EXPIRY_MS;

  if (expired && !req.ratedAt) return <ExpiredPage />;

  const googleReviewUrl = resolveGoogleReviewUrl(req.business);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-4 w-4" />
        <span>Alauda Review</span>
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{req.business.name}</h1>
      <p className="mt-1 text-sm text-gray-600">How was your visit?</p>
      <RatingForm
        token={params.token}
        businessName={req.business.name}
        googleReviewUrl={googleReviewUrl}
        initialRouting={
          req.ratedAt
            ? {
                routedTo: req.routedTo as "google" | "private" | null,
                rating: req.rating,
                reviewText: req.reviewText,
                aiSuggestedReview: req.aiSuggestedReview,
                feedbackSubmitted: req.feedbackSubmittedAt !== null
              }
            : null
        }
      />
    </main>
  );
}

function ExpiredPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col p-6">
      <h1 className="text-2xl font-semibold">This link has expired</h1>
      <p className="mt-2 text-sm text-gray-600">
        Please reach out to the business directly.
      </p>
    </main>
  );
}
