"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Channel = "sms" | "email";
type Timing = "window" | "now";

export default function NewRequestPage() {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("sms");
  const [timing, setTiming] = useState<Timing>("window");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [override, setOverride] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/review-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel,
        phone: channel === "sms" ? phone : undefined,
        email: channel === "email" ? email : undefined,
        override,
        sendNow: timing === "now"
      })
    });
    const body = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.ok) {
      router.push("/owner/dashboard");
      return;
    }
    if (res.status === 409 && body.code === "DUPLICATE") {
      setWarning(body.error ?? "Duplicate within 30 days. Submit again to override.");
      setOverride(true);
      return;
    }
    setError(body.error ?? "Failed to submit");
  }

  function resetWarnings() {
    setWarning(null);
    setOverride(false);
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">New review request</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm text-gray-700">Send via</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="channel"
                value="sms"
                checked={channel === "sms"}
                onChange={() => {
                  setChannel("sms");
                  resetWarnings();
                }}
              />
              SMS
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="channel"
                value="email"
                checked={channel === "email"}
                onChange={() => {
                  setChannel("email");
                  resetWarnings();
                }}
              />
              Email
            </label>
          </div>
        </fieldset>

        {channel === "sms" ? (
          <label className="block">
            <span className="text-sm text-gray-700">Client phone</span>
            <input
              type="tel"
              required
              placeholder="(512) 555-1234"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                resetWarnings();
              }}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ) : (
          <label className="block">
            <span className="text-sm text-gray-700">Client email</span>
            <input
              type="email"
              required
              placeholder="client@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                resetWarnings();
              }}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm text-gray-700">When to send</legend>
          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="timing"
                value="window"
                checked={timing === "window"}
                onChange={() => setTiming("window")}
              />
              Default window <span className="text-gray-500">(1-3h delay, 9am-9pm CT)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="timing"
                value="now"
                checked={timing === "now"}
                onChange={() => setTiming("now")}
              />
              Send now <span className="text-gray-500">(within ~1 minute)</span>
            </label>
          </div>
        </fieldset>

        {warning && (
          <div className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
            {warning}
          </div>
        )}

        <button
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting
            ? "Submitting…"
            : override
              ? "Submit anyway"
              : timing === "now"
                ? channel === "sms"
                  ? "Send SMS now"
                  : "Send Email now"
                : channel === "sms"
                  ? "Schedule SMS"
                  : "Schedule Email"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
