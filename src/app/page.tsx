import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-md p-8">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="h-8 w-8" />
        <h1 className="text-2xl font-semibold">Alauda Review</h1>
      </div>
      <p className="mt-2 text-sm text-gray-600">SMS or email review requests.</p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/owner/signup"
          className="inline-block rounded bg-black px-4 py-2 text-sm text-white"
        >
          Create account
        </Link>
        <Link
          href="/owner/login"
          className="inline-block rounded border border-gray-300 px-4 py-2 text-sm"
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
