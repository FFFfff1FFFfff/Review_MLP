"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_LEN = 500;

export default function OwnerDescriptionForm({
  initialValue
}: {
  initialValue: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/owner/business", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ownerDescription: text.trim() })
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

  const dirty = text.trim() !== initialValue.trim();

  return (
    <form onSubmit={save} className="mt-4 space-y-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
          setSavedAt(null);
        }}
        rows={3}
        maxLength={MAX_LEN}
        placeholder="e.g. Family-run salon, specialize in extensions and color, vintage chairs."
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{text.length}/{MAX_LEN}</span>
        <button
          type="submit"
          disabled={!dirty || status === "saving"}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {savedAt && !dirty && (
        <p className="text-xs text-green-700">Saved.</p>
      )}
    </form>
  );
}
