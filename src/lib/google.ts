interface BusinessGoogleFields {
  googleReviewUrl: string | null;
  googlePlaceId: string | null;
}

// Resolve the Google "write a review" URL for a business.
// Preference order: explicit override -> derive from Place ID -> null.
// Callers must treat null as "business not configured for Google reviews".
export function resolveGoogleReviewUrl(b: BusinessGoogleFields): string | null {
  if (b.googleReviewUrl) return b.googleReviewUrl;
  if (b.googlePlaceId) {
    return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(
      b.googlePlaceId
    )}`;
  }
  return null;
}
