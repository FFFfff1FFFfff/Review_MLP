import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionBusiness } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const business = await getSessionBusiness();
  if (!business) redirect("/owner/login");

  const recent = await prisma.reviewRequest.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">{business.name}</h1>
      <p className="mt-1 text-sm text-gray-600">Signed in as {business.ownerEmail}</p>

      <Link
        href="/owner/new"
        className="mt-6 inline-block rounded bg-black px-4 py-2 text-sm text-white"
      >
        + Request a review
      </Link>

      <h2 className="mt-10 text-lg font-semibold">Recent requests</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No requests yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-200 border-y border-gray-200">
          {recent.map((r) => (
            <li key={r.id} className="py-3 text-sm">
              <div className="font-mono">{r.clientPhoneE164}</div>
              <div className="text-gray-600">
                scheduled {r.scheduledSendAt.toISOString()}
                {r.sentAt ? " · sent" : " · pending"}
                {r.optedOut ? " · opted out" : ""}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
