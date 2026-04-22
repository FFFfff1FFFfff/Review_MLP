interface BusinessGoogleFields {
  googleReviewUrl: string | null;
  googlePlaceId: string | null;
}

// Place IDs that are reserved as documentation examples and would route
// real customer reviews to the wrong business if accidentally configured.
// `ChIJN1t_tDeuEmsRUsoyG83frY4` is "Google Sydney" — the canonical Place
// ID example in Google's Places API docs and the easiest copy/paste mistake
// during onboarding.
const RESERVED_EXAMPLE_PLACE_IDS = new Set<string>([
  "ChIJN1t_tDeuEmsRUsoyG83frY4"
]);

// Resolve the Google "write a review" URL for a business.
// Preference order: explicit override -> derive from Place ID -> null.
// Callers must treat null as "business not configured for Google reviews".
export function resolveGoogleReviewUrl(b: BusinessGoogleFields): string | null {
  if (b.googleReviewUrl) return b.googleReviewUrl;
  if (b.googlePlaceId && !RESERVED_EXAMPLE_PLACE_IDS.has(b.googlePlaceId)) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
      b.googlePlaceId
    )}`;
  }
  return null;
}
