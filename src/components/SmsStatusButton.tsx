"use client";

import { useState } from "react";

interface StatusResult {
  status: string | null;
  errorCode: number | null;
  errorMessage: string | null;
  dateSent: string | null;
  dateUpdated: string | null;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: StatusResult }
  | { kind: "error"; message: string };

// Human-readable hints for the Twilio status + error codes most likely to
// trip up a pilot owner whose SMS "sent" but never arrived. These are
// explanatory only — the raw status/errorCode is shown regardless.
const ERROR_HINTS: Record<number, string> = {
  30003: "Unreachable — number off, out of service, or no signal",
  30004: "Blocked — recipient blocked this sender",
  30005: "Unknown destination — wrong / retired number",
  30006: "Landline or unreachable carrier",
  30007:
    "Carrier filtered (spam / A2P not registered). Check your 10DLC brand + campaign approval status with Twilio.",
  30032: "Toll-free number not verified",
  21211: "Invalid 'To' number (format / E.164)",
  21608: "Trial account — 'To' number not verified in Twilio console",
  21610: "Recipient previously replied STOP; Twilio permanently blocks resends"
};

export default function SmsStatusButton({ sid }: { sid: string }) {
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  async function check() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/owner/sms-status?sid=${encodeURIComponent(sid)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? "Lookup failed" });
        return;
      }
      setState({ kind: "ok", data: body as StatusResult });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Lookup failed"
      });
    }
  }

  if (state.kind === "idle" || state.kind === "loading") {
    return (
      <button
        type="button"
        onClick={check}
        disabled={state.kind === "loading"}
        className="text-xs text-blue-600 underline disabled:opacity-50"
      >
        {state.kind === "loading" ? "Checking…" : "Check delivery"}
      </button>
    );
  }

  if (state.kind === "error") {
    return (
      <span className="text-xs text-red-600">{state.message}</span>
    );
  }

  const { status, errorCode, errorMessage } = state.data;
  const isFailed =
    status === "failed" || status === "undelivered" || errorCode !== null;
  const color = isFailed
    ? "text-red-700"
    : status === "delivered"
      ? "text-green-700"
      : "text-gray-700";
  const hint = errorCode != null ? ERROR_HINTS[errorCode] : null;

  return (
    <span className={`text-xs ${color}`}>
      Twilio: <b>{status ?? "unknown"}</b>
      {errorCode != null && ` · code ${errorCode}`}
      {errorMessage && ` — ${errorMessage}`}
      {hint && <span className="mt-0.5 block text-gray-600">{hint}</span>}
    </span>
  );
}
