"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_LEN = 50;

export default function OwnerNameForm({
  initialValue
}: {
  initialValue: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/owner/business", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerFirstName: trimmed })
    });
    setStatus("idle");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    setSavedAt(Date.now());
    router.refresh();
  }

  const dirty = name.trim() !== initialValue.trim();

  return (
    <form onSubmit={save} className="mt-4 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
          setSavedAt(null);
        }}
        maxLength={MAX_LEN}
        placeholder="e.g. Cici"
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Used in the SMS sender line: &ldquo;Hi! [Your name] from {`{`}business{`}`} here.&rdquo;</span>
        <button
          type="submit"
          disabled={!dirty || !name.trim() || status === "saving"}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && !dirty && <p className="text-xs text-green-700">Saved.</p>}
    </form>
  );
}
