"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "done" | "error";

export default function RatingForm({ token }: { token: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 || status === "submitting") return;
    setStatus("submitting");
    setError(null);
    const res = await fetch(`/api/r/${token}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, text: text.trim() || undefined })
    });
    if (res.ok) {
      setStatus("done");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Failed to submit");
    setStatus("error");
  }

  if (status === "done") {
    return (
      <div className="mt-10 text-center">
        <h2 className="text-xl font-semibold">Thanks for your feedback!</h2>
        <p className="mt-2 text-sm text-gray-600">
          Your response has been recorded.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-6">
      <div className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= (hover || rating);
          return (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className={`select-none px-2 py-1 text-5xl leading-none transition-colors ${
                filled ? "text-yellow-400" : "text-gray-300"
              }`}
            >
              ★
            </button>
          );
        })}
      </div>

      <textarea
        placeholder="Anything you'd like to share? (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        maxLength={2000}
        className="w-full rounded border border-gray-300 px-3 py-2 text-base"
      />

      <button
        type="submit"
        disabled={rating === 0 || status === "submitting"}
        className="w-full rounded bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-40"
      >
        {status === "submitting" ? "Submitting…" : "Submit"}
      </button>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}
