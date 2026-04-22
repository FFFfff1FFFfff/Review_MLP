"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Routed = "google" | "private";

interface InitialRouting {
  routedTo: Routed | null;
  rating: number | null;
  reviewText: string | null;
  aiSuggestedReview: string | null;
  feedbackSubmitted: boolean;
}

interface Props {
  token: string;
  businessName: string;
  googleReviewUrl: string | null;
  initialRouting: InitialRouting | null;
}

type Stage =
  | { kind: "rate" }
  | { kind: "google"; rating: number; aiSuggestedReview: string | null }
  | { kind: "private"; rating: number; alreadySubmitted: boolean };

export default function RatingForm({
  token,
  businessName,
  googleReviewUrl,
  initialRouting
}: Props) {
  // If the row is already rated, resume where the client left off.
  const initialStage: Stage = useMemo(() => {
    if (initialRouting?.routedTo === "google") {
      return {
        kind: "google",
        rating: initialRouting.rating ?? 5,
        aiSuggestedReview: initialRouting.aiSuggestedReview
      };
    }
    if (initialRouting?.routedTo === "private") {
      return {
        kind: "private",
        rating: initialRouting.rating ?? 1,
        alreadySubmitted: initialRouting.feedbackSubmitted
      };
    }
    return { kind: "rate" };
  }, [initialRouting]);

  const [stage, setStage] = useState<Stage>(initialStage);

  if (stage.kind === "rate") {
    return (
      <RateStage
        token={token}
        onRouted={(routedTo, rating) => {
          if (routedTo === "google") {
            // First-time route: no cached AI draft yet — GoogleStage will
            // fetch it on mount.
            setStage({
              kind: "google",
              rating,
              aiSuggestedReview: null
            });
          } else {
            setStage({ kind: "private", rating, alreadySubmitted: false });
          }
        }}
      />
    );
  }

  if (stage.kind === "google") {
    return (
      <GoogleStage
        token={token}
        googleReviewUrl={googleReviewUrl}
        cachedAiSuggestedReview={stage.aiSuggestedReview}
      />
    );
  }

  return (
    <PrivateStage
      token={token}
      alreadySubmitted={stage.alreadySubmitted}
      onSubmitted={() =>
        setStage({ kind: "private", rating: stage.rating, alreadySubmitted: true })
      }
    />
  );
}

// ---------- Rate stage ----------

function RateStage({
  token,
  onRouted
}: {
  token: string;
  onRouted: (routedTo: Routed, rating: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/r/${token}/rate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rating, text: text.trim() || undefined })
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to submit");
      return;
    }
    const routedTo: Routed = body.routedTo === "google" ? "google" : "private";
    onRouted(routedTo, rating);
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
        disabled={rating === 0 || submitting}
        className="w-full rounded bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}

// ---------- Google routing stage ----------

type AiState = "ready" | "loading" | "error";

function GoogleStage({
  token,
  googleReviewUrl,
  cachedAiSuggestedReview
}: {
  token: string;
  googleReviewUrl: string | null;
  cachedAiSuggestedReview: string | null;
}) {
  // If the row already has a generated draft, use it. Otherwise fetch on
  // mount. The customer can edit the textarea freely — `text` is local state
  // and never written back to the server.
  const [text, setText] = useState(cachedAiSuggestedReview ?? "");
  const [aiState, setAiState] = useState<AiState>(
    cachedAiSuggestedReview ? "ready" : "loading"
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (cachedAiSuggestedReview) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/r/${token}/suggest`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        if (cancelled) return;
        if (typeof body.suggested === "string" && body.suggested.trim()) {
          setText(body.suggested);
          setAiState("ready");
        } else {
          setAiState("error");
        }
      } catch {
        if (!cancelled) setAiState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, cachedAiSuggestedReview]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
      // Focus + select so "Select All, Copy" is one tap away.
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.select();
        ta.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }

  // Fire-and-forget the click beacon. Must NOT await — an async gap would
  // sever the user-gesture chain and Safari / iOS WebViews (Instagram, FB,
  // etc.) would block the link from opening. keepalive lets the request
  // survive the navigation that follows.
  function recordGoogleClick() {
    try {
      void fetch(`/api/r/${token}/google-click`, {
        method: "POST",
        keepalive: true
      });
    } catch {
      // Best-effort analytics — never block the user.
    }
  }

  const copyLabel =
    copyState === "copied" ? "Copied! Paste on Google." : "Copy";

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-base font-medium">
        Love to hear it! {aiState === "ready"
          ? "Here's a draft you can edit and paste."
          : aiState === "loading"
            ? "Drafting a review for you…"
            : "Write a quick note to paste on Google."}
      </p>

      {copyState === "failed" && (
        <div className="rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          Tap the box below, press and hold, choose <b>Select All</b>, then{" "}
          <b>Copy</b>.
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopyState("idle");
        }}
        rows={5}
        disabled={aiState === "loading"}
        placeholder={
          aiState === "loading"
            ? "Drafting…"
            : "Share what made your visit great"
        }
        className={`w-full rounded px-3 py-2 text-base ${
          copyState === "failed"
            ? "border-2 border-amber-500"
            : "border border-gray-300"
        } ${aiState === "loading" ? "animate-pulse bg-gray-50" : ""}`}
      />

      <button
        type="button"
        onClick={copy}
        disabled={aiState === "loading" || !text.trim()}
        className="w-full rounded border border-black bg-white px-4 py-3 text-base font-medium text-black disabled:opacity-40"
      >
        {copyLabel}
      </button>

      {googleReviewUrl ? (
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={recordGoogleClick}
          className="w-full rounded bg-black px-4 py-3 text-center text-base font-medium text-white"
        >
          Open Google Reviews
        </a>
      ) : (
        <>
          <button
            type="button"
            disabled
            className="w-full rounded bg-black px-4 py-3 text-base font-medium text-white opacity-40"
          >
            Open Google Reviews
          </button>
          <p className="text-center text-sm text-red-600">
            Google Reviews isn't configured for this business.
          </p>
        </>
      )}
    </div>
  );
}

// ---------- Private feedback stage ----------

function PrivateStage({
  token,
  alreadySubmitted,
  onSubmitted
}: {
  token: string;
  alreadySubmitted: boolean;
  onSubmitted: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadySubmitted) {
    return (
      <div className="mt-10 text-center">
        <h2 className="text-xl font-semibold">Thanks for the feedback.</h2>
        <p className="mt-2 text-sm text-gray-600">
          The owner has been notified and will use it to improve.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/r/${token}/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: text.trim() })
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setError(body.error ?? "Failed to submit");
      return;
    }
    onSubmitted();
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <p className="text-base">
        Sorry it wasn't a great visit. Tell us what happened — this goes
        straight to the owner and stays private.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={2000}
        placeholder="What could we have done better?"
        className="w-full rounded border border-gray-300 px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={!text.trim() || submitting}
        className="w-full rounded bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-40"
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}
