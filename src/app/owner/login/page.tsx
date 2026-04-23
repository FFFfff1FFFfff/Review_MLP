"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (res.ok) {
      setStatus("sent");
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to send link");
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto max-w-md p-8">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-7 w-7" />
        <h1 className="text-2xl font-semibold">Alauda Review</h1>
      </div>
      <h2 className="mt-6 text-lg font-semibold">Owner login</h2>
      {status === "sent" ? (
        <p className="mt-6 text-sm text-gray-700">
          Check <b>{email}</b> for a login link. It expires in 15 minutes.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <button
            disabled={status === "sending"}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send login link"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
