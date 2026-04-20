"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewRequestPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
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
      body: JSON.stringify({ phone, override })
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

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">New review request</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm text-gray-700">Client phone</span>
          <input
            type="tel"
            required
            placeholder="(512) 555-1234"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setWarning(null);
              setOverride(false);
            }}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

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
              : "Schedule SMS"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
