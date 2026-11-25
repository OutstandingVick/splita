"use client";

import type { Receipt } from "@splita/core";
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

export default function ReceiptsPage() {
  const { uid, online } = useDeviceStatus();
  const [receipts, setReceipts] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    setTitles(matterTitles());
    if (!uid) return;
    getSplita()
      .receipts()
      .then(setReceipts, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
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
            <span className="text-xs text-stone-500">{list.length} receipts</span>
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
