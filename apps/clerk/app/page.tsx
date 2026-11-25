import Link from "next/link";
import { StatusBadge } from "@/components/device-status";
import { DEMO_MATTER_ID } from "@/lib/matters";

const STEPS = [
  {
    n: "1",
    where: "On your device",
    title: "Detect",
    body: "Rules and Gemini Nano find names, companies, amounts, accounts and addresses.",
    from: "Mr. Adebayo Ogunleye",
    to: "EMPLOYEE_1",
  },
  {
    n: "2",
    where: "In the cloud",
    title: "Reason on stand-ins",
    body: "Gemini reads only placeholders, and every request is checked for leaks first.",
    from: "EMPLOYEE_1 is owed",
    to: "AMOUNT_NGN_LARGE_1",
  },
  {
    n: "3",
    where: "On your device",
    title: "Restore",
    body: "Real values come back from the local vault. A receipt proves what was sent.",
    from: "AMOUNT_NGN_LARGE_1",
    to: "N12.5m",
  },
] as const;

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center px-6 py-12">
      <div className="max-w-3xl space-y-6">
        <StatusBadge />
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          Cloud intelligence,
          <br />
          zero-knowledge context.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-stone-600">
          Splita lets Nigerian lawyers ask a cloud model about confidential documents without revealing who they are about.
          Identities are split off on your device, the cloud reasons on stand-ins, and the answer is restored locally.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/workspace?matter=${DEMO_MATTER_ID}`}
            className="rounded-lg bg-accent-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-accent-800"
          >
            Open workspace
          </Link>
          <span className="text-sm text-stone-500">Opens the demo matter, Ogunleye v. Zenith Bank.</span>
        </div>
      </div>

      <ol className="mt-14 grid gap-4 md:grid-cols-3" aria-label="How identity-split inference works">
        {STEPS.map((s, i) => (
          <li key={s.n} className="relative rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-stone-400">0{s.n}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${s.where === "In the cloud" ? "bg-sky-50 text-sky-800" : "bg-accent-50 text-accent-800"}`}
              >
                {s.where}
              </span>
            </div>
            <h2 className="mt-3 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.body}</p>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 font-mono text-xs">
              <span className="truncate text-stone-500">{s.from}</span>
              <span aria-hidden className="text-stone-400">
                →
              </span>
              <span className={`truncate ${i === 2 ? "text-stone-900" : "rounded bg-rules px-1 text-rules-ink"}`}>{s.to}</span>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-xs text-stone-500">
        Built on Firebase AI Logic hybrid inference: Gemini Nano on-device for detection, Gemini in the cloud for reasoning.
      </p>
    </main>
  );
}
