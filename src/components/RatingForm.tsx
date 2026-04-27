"use client";

import { useMemo, useRef, useState } from "react";

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
  | {
      kind: "private";
      rating: number;
      alreadySubmitted: boolean;
      // The text the customer typed in the rate step's optional textarea.
      // We seed PrivateStage with this so their first, most candid comment
      // isn't silently overwritten when they submit the private feedback form.
      initialText: string;
    };

export default function RatingForm({
  token,
  businessName: _businessName,
  googleReviewUrl,
  initialRouting
}: Props) {
  // If the row is already rated, resume where the client left off. On revisit
  // we use whatever AI draft was cached previously (or null if the first
  // submission didn't opt into AI).
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
        alreadySubmitted: initialRouting.feedbackSubmitted,
        // On revisit before submitting feedback, reviewText holds the rate-
        // step textarea content. After feedback is submitted it holds the
        // feedback body — but in that case we render the Thanks view and
        // initialText is ignored anyway.
        initialText: initialRouting.reviewText ?? ""
      };
    }
    return { kind: "rate" };
  }, [initialRouting]);

  const [stage, setStage] = useState<Stage>(initialStage);

  if (stage.kind === "rate") {
    return (
      <RateStage
        token={token}
        onRouted={(routedTo, rating, rateText, aiDraft) => {
          if (routedTo === "google") {
            setStage({
              kind: "google",
              rating,
              aiSuggestedReview: aiDraft
            });
          } else {
            setStage({
              kind: "private",
              rating,
              alreadySubmitted: false,
              initialText: rateText
            });
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
        initialDraft={stage.aiSuggestedReview}
      />
    );
  }

  return (
    <PrivateStage
      token={token}
      alreadySubmitted={stage.alreadySubmitted}
      initialText={stage.initialText}
      onSubmitted={() =>
        setStage({
          kind: "private",
          rating: stage.rating,
          alreadySubmitted: true,
          initialText: stage.initialText
        })
      }
    />
  );
}

// ---------- Rate stage ----------

type RateSubmitMode = "plain" | "ai";

function RateStage({
  token,
  onRouted
}: {
  token: string;
  onRouted: (
    routedTo: Routed,
    rating: number,
    rateText: string,
    aiDraft: string | null
  ) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [keepPrivate, setKeepPrivate] = useState(false);
  const [busy, setBusy] = useState<RateSubmitMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(mode: RateSubmitMode) {
    if (rating === 0 || busy) return;
    setBusy(mode);
    setError(null);
    try {
      const res = await fetch(`/api/r/${token}/rate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rating,
          text: text.trim() || undefined,
          keepPrivate
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Failed to submit");
        return;
      }
      const routedTo: Routed = body.routedTo === "google" ? "google" : "private";

      // Only call /suggest when the customer asked for AI AND we're on the
      // Google path — low ratings don't need a Google draft.
      let aiDraft: string | null = null;
      if (mode === "ai" && routedTo === "google") {
        try {
          const sugRes = await fetch(`/api/r/${token}/suggest`, {
            method: "POST"
          });
          const sugBody = await sugRes.json().catch(() => ({}));
          if (sugRes.ok && typeof sugBody.suggested === "string") {
            aiDraft = sugBody.suggested;
          }
        } catch {
          // Generation failure isn't fatal — GoogleStage handles a null draft
          // gracefully (empty textarea + placeholder). No loading spinner.
        }
      }
      onRouted(routedTo, rating, text.trim(), aiDraft);
    } finally {
      setBusy(null);
    }
  }

  // Only offer AI draft for ratings that would route to Google. Avoids the
  // "I asked for AI but ended up in private feedback" surprise. keepPrivate
  // forces the private path, so suppress AI in that case too.
  const canUseAi = rating >= 4 && !keepPrivate;
  const isBusy = busy !== null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit("plain");
      }}
      className="mt-6 flex flex-col gap-6"
    >
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

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={keepPrivate}
          onChange={(e) => setKeepPrivate(e.target.checked)}
          className="mt-1"
        />
        <span>Submit privately — only the owner sees this, not Google.</span>
      </label>

      {canUseAi && (
        <button
          type="button"
          onClick={() => void submit("ai")}
          disabled={isBusy}
          className="w-full rounded border border-black bg-white px-4 py-3 text-base font-medium text-black disabled:opacity-40"
        >
          {busy === "ai" ? "Drafting with AI…" : "Draft my review with AI"}
        </button>
      )}

      <button
        type="submit"
        disabled={rating === 0 || isBusy}
        className="w-full rounded bg-black px-4 py-3 text-base font-medium text-white disabled:opacity-40"
      >
        {busy === "plain" ? "Submitting…" : "Submit"}
      </button>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </form>
  );
}

// ---------- Google routing stage ----------

function GoogleStage({
  token,
  googleReviewUrl,
  initialDraft
}: {
  token: string;
  googleReviewUrl: string | null;
  initialDraft: string | null;
}) {
  // Textarea is seeded from whatever the rate submit returned (AI draft or
  // empty). GoogleStage no longer fetches /suggest on mount — generation
  // happens synchronously during rate submit when the customer opts in.
  const [text, setText] = useState(initialDraft ?? "");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
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

  const hasDraft = !!initialDraft;
  const copyLabel =
    copyState === "copied" ? "Copied! Paste on Google." : "Copy";

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-base font-medium">
        {hasDraft
          ? "Thanks for the rating. Feel free to edit this before sharing."
          : "Thanks for the rating. Write a quick note to share on Google."}
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
        placeholder="Share what made your visit great"
        className={`w-full rounded px-3 py-2 text-base ${
          copyState === "failed"
            ? "border-2 border-amber-500"
            : "border border-gray-300"
        }`}
      />

      <button
        type="button"
        onClick={copy}
        disabled={!text.trim()}
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
            Google Reviews isn&apos;t configured for this business.
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
  initialText,
  onSubmitted
}: {
  token: string;
  alreadySubmitted: boolean;
  initialText: string;
  onSubmitted: () => void;
}) {
  // Seed from whatever the customer wrote in the rate step's optional
  // textarea. The /feedback endpoint overwrites reviewText, so without this
  // seed their first candid comment would be silently lost the moment they
  // submit the private-feedback form.
  const [text, setText] = useState(initialText);
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
        Sorry it wasn&apos;t a great visit. Tell us what happened — this goes
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
