"use client";

import Link from "next/link";
import { useState } from "react";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), businessName: businessName.trim() })
    });
    if (res.ok) {
      setStatus("sent");
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Signup failed");
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
      <h2 className="mt-6 text-lg font-semibold">Create an account</h2>

      {status === "sent" ? (
        <>
          <p className="mt-6 text-sm text-gray-700">
            Check <b>{email}</b> for a login link. It expires in 15 minutes.
          </p>
          <p className="mt-3 text-sm text-gray-600">
            Once you log in, you&apos;ll be guided to connect your Google business
            listing so review requests can send.
          </p>
        </>
      ) : (
        <>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-gray-700">Business name</span>
              <input
                type="text"
                required
                maxLength={256}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your business"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm text-gray-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@yourbusiness.com"
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <button
              disabled={
                status === "sending" || !email.trim() || !businessName.trim()
              }
              className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send login link"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </form>
          <p className="mt-6 text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/owner/login" className="underline">
              Log in
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
