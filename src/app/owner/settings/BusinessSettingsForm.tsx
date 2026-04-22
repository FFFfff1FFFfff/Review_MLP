"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PlaceResult {
  placeId: string;
  name: string;
  formattedAddress: string;
}

export default function BusinessSettingsForm({
  currentPlaceId,
  currentReviewUrl
}: {
  currentPlaceId: string | null;
  currentReviewUrl: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "looking" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setStatus("looking");
    setError(null);
    setResults(null);
    setSelectedId(null);
    const res = await fetch("/api/owner/business/lookup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: query.trim() })
    });
    const body = await res.json().catch(() => ({}));
    setStatus("idle");
    if (!res.ok) {
      setError(body.error ?? "Lookup failed");
      return;
    }
    const list: PlaceResult[] = body.results ?? [];
    if (list.length === 0) {
      setError("No matches — try a more specific name or city.");
      return;
    }
    setResults(list);
    setSelectedId(list[0].placeId);
  }

  async function save() {
    if (!selectedId) return;
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/owner/business", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ googlePlaceId: selectedId })
    });
    const body = await res.json().catch(() => ({}));
    setStatus("idle");
    if (!res.ok) {
      setError(body.error ?? "Save failed");
      return;
    }
    router.push("/owner/dashboard");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      {currentPlaceId ? (
        <div className="rounded border border-gray-200 p-3 text-sm">
          <div className="text-gray-500">Current Place ID</div>
          <div className="mt-1 font-mono text-xs break-all">{currentPlaceId}</div>
          {currentReviewUrl && (
            <div className="mt-2 text-xs text-amber-700">
              Note: a googleReviewUrl override is also set. Saving a new Place ID
              here will clear it.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Connect your Google business listing</p>
          <p className="mt-1">
            Tell us where your customers should leave their Google review. Review
            requests won&apos;t send until this is set.
          </p>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-xs">
            <li>Search by your business name and city, or paste a Google Maps share link</li>
            <li>Confirm the right business from the results</li>
            <li>Save</li>
          </ol>
        </div>
      )}

      <form onSubmit={lookup} className="space-y-2">
        <label className="block text-sm text-gray-700">
          Business name, &ldquo;name city&rdquo;, a Google Maps link, or a Place ID
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
            }}
            placeholder="Your business name and city"
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={status !== "idle" || !query.trim()}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {status === "looking" ? "Looking up…" : "Look up"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          E.g. paste a Maps share link like https://maps.app.goo.gl/xxx.
        </p>
      </form>

      {results && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            {results.length === 1
              ? "Is this your business?"
              : "Pick your business:"}
          </p>
          <div className="space-y-2">
            {results.map((r) => (
              <label
                key={r.placeId}
                className={`flex cursor-pointer items-start gap-3 rounded border p-3 ${
                  selectedId === r.placeId
                    ? "border-black bg-gray-50"
                    : "border-gray-200"
                }`}
              >
                <input
                  type="radio"
                  name="place"
                  value={r.placeId}
                  checked={selectedId === r.placeId}
                  onChange={() => setSelectedId(r.placeId)}
                  className="mt-1"
                />
                <div className="text-sm">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-gray-600">{r.formattedAddress}</div>
                  <a
                    href={`https://search.google.com/local/writereview?placeid=${encodeURIComponent(
                      r.placeId
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 underline"
                  >
                    Preview review page ↗
                  </a>
                </div>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={save}
            disabled={status !== "idle" || !selectedId}
            className="w-full rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save this Place ID"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
