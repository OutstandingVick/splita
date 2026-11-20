import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Splita</h1>
      <p className="mt-2 text-neutral-600">Phase 0 spike.</p>
      <Link href="/spike" className="mt-4 inline-block text-blue-700 underline">
        Open /spike
      </Link>
    </main>
  );
}
