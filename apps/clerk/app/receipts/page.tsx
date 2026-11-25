"use client";

import { type ChainCheck, type Receipt, verifyChains } from "@splita/core";
import { WebCryptoHasher } from "@splita/web";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDeviceStatus } from "@/components/device-status";
import { loadMatters, withDemo } from "@/lib/matters";
import { getSplita } from "@/lib/splita";

const short = (h: string) => `${h.slice(0, 8)}…`;

function matterTitles(): Map<string, string> {
  try {
    return new Map(withDemo(loadMatters(window.localStorage)).map((m) => [m.id, m.title]));
  } catch {
    return new Map();
  }
}

const PROBLEM: Record<NonNullable<ChainCheck["problem"]>["kind"], string> = {
  tampered: "a receipt's hash doesn't recompute",
  "broken-link": "a receipt doesn't link to the one before it",
  "missing-genesis": "the first receipt links to one that is missing",
};

function ChainBadge({ check }: { check: ChainCheck | undefined }) {
  if (!check) return <span className="text-xs text-stone-400">Checking chain…</span>;
  return check.ok ? (
    <span data-testid="chain-ok" className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-800">
      ✓ Unbroken chain
    </span>
  ) : (
    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800" title={check.problem ? PROBLEM[check.problem.kind] : ""}>
      ✗ Chain broken at {check.problem?.receiptId.slice(0, 8)}
    </span>
  );
}

function ChainSummary({ checks }: { checks: ChainCheck[] }) {
  const broken = checks.filter((c) => !c.ok);
  const total = checks.reduce((n, c) => n + c.length, 0);
  return (
    <div className={`rounded-xl border p-4 text-sm ${broken.length ? "border-red-200 bg-red-50 text-red-900" : "border-accent-100 bg-accent-50 text-accent-800"}`}>
      {broken.length
        ? `${broken.length} of ${checks.length} chains failed verification: ${broken.map((c) => (c.problem ? PROBLEM[c.problem.kind] : "")).join("; ")}.`
        : `✓ All ${total} receipts across ${checks.length} matter${checks.length === 1 ? "" : "s"} verified in this browser: every hash recomputes and every link is unbroken.`}
    </div>
  );
}

export default function ReceiptsPage() {
  const { uid, online } = useDeviceStatus();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [chains, setChains] = useState<Map<string, ChainCheck> | null>(null);

  useEffect(() => {
    setTitles(matterTitles());
    if (!uid) return;
    getSplita()
      .receipts()
      .then(async (list) => {
        setReceipts(list);
        const checks = await verifyChains(list, new WebCryptoHasher());
        setChains(new Map(checks.map((c) => [c.workspaceId, c])));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [uid]);

  const groups = new Map<string, Receipt[]>();
  for (const r of receipts ?? []) groups.set(r.workspaceId, [...(groups.get(r.workspaceId) ?? []), r]);

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Receipts</h1>
        <p className="text-sm text-stone-600">
          Every answer writes a hash-chained receipt to Firestore: hashes, counts and timings only, never text. Receipts can be created but
          never edited or deleted.
        </p>
      </header>

      {chains && chains.size > 0 && <ChainSummary checks={[...chains.values()]} />}
      {!online && <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-600">You&apos;re offline. Receipts load when you reconnect.</p>}
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Couldn&apos;t load receipts: {error}
        </p>
      )}
      {online && !error && receipts === null && <div className="h-40 animate-pulse rounded-xl bg-stone-100" />}
      {receipts?.length === 0 && (
        <p className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
          No receipts yet. <Link href="/workspace" className="font-medium text-accent-700 underline">Ask a question</Link> to create one.
        </p>
      )}

      {[...groups].map(([workspaceId, list]) => (
        <section key={workspaceId} className="rounded-xl border border-stone-200 bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold">{titles.get(workspaceId) ?? "Matter not on this device"}</h2>
              <p className="font-mono text-xs text-stone-500">{workspaceId}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-stone-500">{list.length} receipts</span>
              <ChainBadge check={chains?.get(workspaceId)} />
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="px-5 py-2 font-medium">Time</th>
                  <th className="px-3 py-2 font-medium">Identities</th>
                  <th className="px-3 py-2 font-medium">Detectors</th>
                  <th className="px-3 py-2 font-medium">Cloud</th>
                  <th className="px-3 py-2 font-medium">Payload</th>
                  <th className="px-5 py-2 font-medium">Links to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-5 py-2.5">{new Date(r.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2.5">{Object.values(r.entityCounts).reduce((a, b) => a + (b ?? 0), 0)}</td>
                    <td className="px-3 py-2.5">{r.detectorSources.join(" + ")}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">
                      {r.cloudModel ?? "—"}
                      {r.cloudAttempts && r.cloudAttempts > 1 ? ` ×${r.cloudAttempts}` : ""}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs" title={r.payloadHash}>
                      {short(r.payloadHash)}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-xs text-stone-500" title={r.prevReceiptHash ?? "first receipt"}>
                      {r.prevReceiptHash ? short(r.prevReceiptHash) : "genesis"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
