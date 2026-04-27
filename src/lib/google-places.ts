import { env } from "./env";

export interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
  // e.g. "Hair salon", "Coffee shop". Null if Places didn't classify the
  // business or the field was omitted from the response.
  primaryType: string | null;
  // Google's curated one-liner about the business, when Places has it
  // (smaller / niche businesses often don't). Used as a grounding hint for
  // AI review drafts.
  editorialSummary: string | null;
}

export class PlacesApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerMessage: string
  ) {
    super(message);
    this.name = "PlacesApiError";
  }
}

// A Place ID is a URL-safe opaque token, 20+ chars, no spaces. If the input
// matches that shape we trust it as an ID and validate via Place Details;
// otherwise we run a text search and return top matches.
function looksLikePlaceId(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(s);
}

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s);
}

const BASE = "https://places.googleapis.com/v1";
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.primaryTypeDisplayName,places.editorialSummary";
const DETAILS_MASK =
  "id,displayName,formattedAddress,primaryTypeDisplayName,editorialSummary";

// Follow a Google Maps share link (e.g. maps.app.goo.gl/xxx) to its full URL
// and pull the business name from the `/maps/place/<name>/@...` segment.
// Returns null if it doesn't look like a Maps place URL.
async function expandMapsUrl(url: string): Promise<string | null> {
  let finalUrl: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      // User-Agent nudges Google to return the desktop URL shape reliably.
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    finalUrl = res.url;
  } catch {
    return null;
  }

  // /maps/place/<url-encoded-name>/@lat,lng,zoom/...
  const match = finalUrl.match(/\/maps\/place\/([^/@]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
}

// Resolve an owner's input (business name, "name city", a Maps share URL,
// or an existing Place ID) into up to 3 candidate businesses. The UI shows
// these for the owner to confirm — owner confirmation is the guard against
// routing reviews to the wrong business.
export async function lookupPlaces(input: string): Promise<PlaceResult[]> {
  const query = input.trim();
  if (!query) return [];

  if (looksLikeUrl(query)) {
    const name = await expandMapsUrl(query);
    if (!name) {
      throw new PlacesApiError(
        "Couldn't extract a business from that URL. Paste the business name instead.",
        400,
        "url-expand-failed"
      );
    }
    return fetchTextSearch(name);
  }

  if (looksLikePlaceId(query)) {
    const one = await fetchPlaceDetails(query);
    return one ? [one] : [];
  }
  return fetchTextSearch(query);
}

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
  if (res.status === 404) return null;
  if (!res.ok) throw await placesError(res);
  const data = await res.json();
  if (!data?.id || !data?.displayName?.text) return null;
  return {
    placeId: data.id,
    name: data.displayName.text,
    formattedAddress: data.formattedAddress ?? "",
    primaryType: data.primaryTypeDisplayName?.text ?? null,
    editorialSummary: data.editorialSummary?.text ?? null
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
    body: JSON.stringify({ textQuery: query }),
    cache: "no-store"
  });
  if (!res.ok) throw await placesError(res);
  const data = await res.json();
  const places: unknown[] = Array.isArray(data?.places) ? data.places : [];
  return places
    .slice(0, 3)
    .map((p): PlaceResult | null => {
      const pp = p as {
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        primaryTypeDisplayName?: { text?: string };
        editorialSummary?: { text?: string };
      };
      if (!pp.id || !pp.displayName?.text) return null;
      return {
        placeId: pp.id,
        name: pp.displayName.text,
        formattedAddress: pp.formattedAddress ?? "",
        primaryType: pp.primaryTypeDisplayName?.text ?? null,
        editorialSummary: pp.editorialSummary?.text ?? null
      };
    })
    .filter((p): p is PlaceResult => p !== null);
}

async function placesError(res: Response): Promise<PlacesApiError> {
  const body = await res.text().catch(() => "");
  let providerMessage = body;
  try {
    const parsed = JSON.parse(body);
    providerMessage = parsed?.error?.message ?? body;
  } catch {
    /* body not JSON */
  }
  const hint =
    res.status === 403
      ? "Places API (New) may not be enabled on this key. Enable it in GCP Console → APIs & Services → Library → 'Places API (New)'."
      : res.status === 400
        ? "Places API rejected the request."
        : res.status === 429
          ? "Places API rate limit hit — try again in a minute."
          : `Places API error ${res.status}.`;
  return new PlacesApiError(
    `${hint} ${providerMessage}`.trim(),
    res.status,
    providerMessage
  );
}
