import { redirect } from "next/navigation";
import { getSessionBusiness } from "@/lib/session";
import BusinessSettingsForm from "./BusinessSettingsForm";
import OwnerDescriptionForm from "./OwnerDescriptionForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const business = await getSessionBusiness();
  if (!business) redirect("/owner/login");

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-gray-600">{business.name}</p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Google Place ID</h2>
        <p className="mt-1 text-sm text-gray-600">
          Set where your 4-5★ customers will post their Google review.
        </p>
        <BusinessSettingsForm
          currentPlaceId={business.googlePlaceId}
          currentReviewUrl={business.googleReviewUrl}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">About your business</h2>
        <p className="mt-1 text-sm text-gray-600">
          1-2 sentences describing what you do. Helps the AI generate review
          drafts that sound specific to your business instead of generic.
        </p>
        <OwnerDescriptionForm initialValue={business.ownerDescription ?? ""} />
      </section>
    </main>
  );
}
