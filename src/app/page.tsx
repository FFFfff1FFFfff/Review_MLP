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
      <Link
        href="/owner/login"
        className="mt-6 inline-block rounded bg-black px-4 py-2 text-sm text-white"
      >
        Owner login
      </Link>
    </main>
  );
}
