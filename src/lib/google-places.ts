import { env } from "./env";

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
}

// A Place ID is a URL-safe opaque token, 20+ chars, no spaces. If the input
// matches that shape we trust it as an ID and validate via Place Details;
// otherwise we run a text search and return top matches.
function looksLikePlaceId(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(s);
}

const BASE = "https://places.googleapis.com/v1";
const FIELD_MASK = "places.id,places.displayName,places.formattedAddress";
const DETAILS_MASK = "id,displayName,formattedAddress";

// Resolve an owner's input (business name, "name city", or an existing Place
// ID) into up to 3 candidate businesses. The UI shows these for the owner to
// confirm — this is the guard against routing reviews to the wrong business.
export async function lookupPlaces(input: string): Promise<PlaceResult[]> {
  const query = input.trim();
  if (!query) return [];

  if (looksLikePlaceId(query)) {
    const one = await fetchPlaceDetails(query);
    return one ? [one] : [];
  }
  return fetchTextSearch(query);
}

// Re-validate a Place ID server-side on save. Owner confirmation happens in
// the UI, but a malicious or racing client could POST any ID — this ensures
// we only persist IDs that resolve to a real business.
export async function validatePlaceId(
  placeId: string
): Promise<PlaceResult | null> {
  if (!looksLikePlaceId(placeId)) return null;
  return fetchPlaceDetails(placeId);
}

async function fetchPlaceDetails(placeId: string): Promise<PlaceResult | null> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": DETAILS_MASK
    },
    cache: "no-store"
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.id || !data?.displayName?.text) return null;
  return {
    placeId: data.id,
    name: data.displayName.text,
    formattedAddress: data.formattedAddress ?? ""
  };
}

async function fetchTextSearch(query: string): Promise<PlaceResult[]> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify({ textQuery: query, pageSize: 3 }),
    cache: "no-store"
  });
  if (!res.ok) return [];
  const data = await res.json();
  const places: unknown[] = Array.isArray(data?.places) ? data.places : [];
  return places
    .map((p): PlaceResult | null => {
      const pp = p as {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
      };
      if (!pp.id || !pp.displayName?.text) return null;
      return {
        placeId: pp.id,
        name: pp.displayName.text,
        formattedAddress: pp.formattedAddress ?? ""
      };
    })
    .filter((p): p is PlaceResult => p !== null);
}
