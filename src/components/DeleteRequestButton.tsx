"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Small trash-icon button rendered next to each row in the dashboard's
// Recent requests list. Browser confirm() is fine for MLP — owner will
// almost always be deleting their own test rows; an undo flow can come
// later if real customer rows start getting nuked accidentally.
export default function DeleteRequestButton({
  id,
  label
}: {
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
    if (!confirm(`Delete request to ${label}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/owner/review-request/${id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
      alert("Delete failed.");
    }
  }

  return (
    <button
      type="button"
      onClick={del}
      disabled={busy}
      aria-label="Delete request"
      title="Delete request"
      className="text-gray-400 hover:text-red-600 disabled:opacity-40"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      </svg>
    </button>
  );
}
