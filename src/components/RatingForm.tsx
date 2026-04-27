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

// Single low-bar threshold reused everywhere we choose between the Google-
// review prompt and the private-feedback prompt. Mirrors the rating cutoff
// in /api/r/[token]/rate.
const POSITIVE_MIN = 4;

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
  // submission didn't opt into AI). The cached draft now also seeds private-
  // feedback rows, since 1-3★ rows can be drafted with AI too.
  const initialStage: Stage = useMemo(() => {
    if (initialRouting?.routedTo === "google") {
      return {
        kind: "google",
        rating: initialRouting.rating ?? 5,
        aiSuggestedReview: initialRouting.aiSuggestedReview
      };
    }
    if (initialRouting?.routedTo === "private") {
      // Prefer the cached AI draft on revisit (so refreshes don't drop it),
      // falling back to whatever raw text the customer typed.
      const seed =
        initialRouting.aiSuggestedReview ?? initialRouting.reviewText ?? "";
      return {
        kind: "private",
        rating: initialRouting.rating ?? 1,
        alreadySubmitted: initialRouting.feedbackSubmitted,
        initialText: seed
      };
    }
    return { kind: "rate" };
  }, [initialRouting]);

  const [stage, setStage] = useState<Stage>(initialStage);

  if (stage.kind === "rate") {
    return (
      <RateStage
        token={token}
        onRouted={(routedTo, rating, rateText, aiDraft, feedbackSubmitted) => {
          if (routedTo === "google") {
            setStage({
              kind: "google",
              rating,
              aiSuggestedReview: aiDraft
            });
          } else {
            // Use the AI draft as the seed if the customer asked for one;
            // otherwise fall back to whatever they typed. When the rate-step
            // text was already auto-submitted as feedback, jump straight to
            // the Thanks view instead of asking for feedback again.
            setStage({
              kind: "private",
              rating,
              alreadySubmitted: feedbackSubmitted,
              initialText: aiDraft ?? rateText
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
        onSwitchToPrivate={(currentText) => {
          // Customer changed their mind after seeing the Google draft. Carry
          // their current textarea content over to PrivateStage so they can
          // edit/keep it instead of typing again.
          setStage({
            kind: "private",
            rating: stage.rating,
            alreadySubmitted: false,
            initialText: currentText
          });
        }}
      />
    );
  }

  return (
    <PrivateStage
      token={token}
      rating={stage.rating}
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
    aiDraft: string | null,
    feedbackSubmitted: boolean
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
      const trimmed = text.trim();

      // Call /suggest whenever the customer asked for AI, regardless of
      // routing — 1-3★ rows now get an AI-drafted private-feedback note,
      // and 4-5★ rows get the existing Google review draft. The endpoint
      // branches its prompt on rating.
      let aiDraft: string | null = null;
      if (mode === "ai") {
        try {
          const sugRes = await fetch(`/api/r/${token}/suggest`, {
            method: "POST"
          });
          const sugBody = await sugRes.json().catch(() => ({}));
          if (sugRes.ok && typeof sugBody.suggested === "string") {
            aiDraft = sugBody.suggested;
          }
        } catch {
          // Generation failure isn't fatal — both stages handle a null draft
          // gracefully (empty textarea + placeholder).
        }
      }

      // If the customer typed feedback in the rate step AND ended up on the
      // private path, that text IS their private feedback — submit it now so
      // they don't get a second "What could we have done better?" form. AI
      // mode is exempt: the customer needs a chance to review the AI draft
      // before sending. Best-effort: if /feedback fails the user falls back
      // to the existing form path.
      let feedbackSubmitted = false;
      if (mode === "plain" && routedTo === "private" && trimmed.length > 0) {
        try {
          const fbRes = await fetch(`/api/r/${token}/feedback`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: trimmed })
          });
          if (fbRes.ok) feedbackSubmitted = true;
        } catch {
          // Network blip — leave feedbackSubmitted=false and the user will
          // see PrivateStage with their text pre-filled.
        }
      }

      onRouted(routedTo, rating, trimmed, aiDraft, feedbackSubmitted);
    } finally {
      setBusy(null);
    }
  }

  // AI draft is offered at every rating: 4-5★ gets a Google review draft,
  // 1-3★ gets a constructive private-feedback draft. Only hide before the
  // user has actually picked a rating (otherwise the prompt has no signal).
  const canUseAi = rating > 0;
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
  initialDraft,
  onSwitchToPrivate
}: {
  token: string;
  googleReviewUrl: string | null;
  initialDraft: string | null;
  onSwitchToPrivate: (currentText: string) => void;
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

  const [switching, setSwitching] = useState(false);
  async function switchToPrivate() {
    if (switching) return;
    setSwitching(true);
    try {
      await fetch(`/api/r/${token}/route-to-private`, { method: "POST" });
      // We hand the parent the current textarea content so PrivateStage can
      // seed from it (don't make the customer retype). Server flip is
      // best-effort — even if it failed, switching the UI is the right thing.
      onSwitchToPrivate(text);
    } finally {
      setSwitching(false);
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

      <button
        type="button"
        onClick={switchToPrivate}
        disabled={switching}
        className="text-center text-sm text-gray-600 underline disabled:opacity-50"
      >
        {switching
          ? "Switching…"
          : "Or submit this privately to the owner only"}
      </button>
    </div>
  );
}

// ---------- Private feedback stage ----------

function PrivateStage({
  token,
  rating,
  alreadySubmitted,
  initialText,
  onSubmitted
}: {
  token: string;
  rating: number;
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

  // 4-5★ customers reach this stage via "Submit privately" / the Google-stage
  // late opt-out — they're not unhappy. Only 1-3★ rated this as a complaint.
  const positivePath = rating >= POSITIVE_MIN;
  const intro = positivePath
    ? "Thanks for the rating. Share anything you'd like the owner to know — this stays private."
    : "Sorry it wasn't a great visit. Tell us what happened — this goes straight to the owner and stays private.";
  const placeholder = positivePath
    ? "What did you enjoy? Anything to mention?"
    : "What could we have done better?";

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <p className="text-base">{intro}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={2000}
        placeholder={placeholder}
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
