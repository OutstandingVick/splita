"use client";

import type { DetectionMode, Receipt } from "@splita/core";
import type { ReactNode } from "react";

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

const TYPE_LABEL: Record<string, string> = {
  PERSON: "People",
  ORG: "Organisations",
  MONEY: "Amounts",
  EMAIL: "Emails",
  PHONE: "Phones",
  ACCOUNT_NUMBER: "Accounts",
  LOCATION: "Locations",
  DATE_OF_BIRTH: "Birth dates",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-stone-500">{label}</dt>
      <dd className="min-w-0 text-stone-800">{children}</dd>
    </div>
  );
}

export function ReceiptCard({ receipt, mode, verify }: { receipt: Receipt; mode: DetectionMode; verify?: ReactNode }) {
  const t = receipt.timings;
  const total = Object.values(t).reduce((a, b) => a + b, 0) || 1;
  return (
    <section aria-labelledby="receipt-h" className="rounded-xl border border-stone-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-stone-100 px-6 py-3">
        <div>
          <h2 id="receipt-h" className="text-sm font-semibold text-stone-800">
            Privacy receipt
          </h2>
          <p className="text-xs text-stone-500">
            Saved to Firestore · {new Date(receipt.timestamp).toLocaleString()} · metadata only, no text
          </p>
        </div>
        {verify}
      </header>
      <dl className="divide-y divide-stone-100 px-6 py-1">
        <Row label="Payload hash">
          <code className="font-mono text-xs" title={receipt.payloadHash}>
            sha256 {short(receipt.payloadHash)}
          </code>
        </Row>
        <Row label="Identities split">
          <span className="flex flex-wrap gap-1.5">
            {Object.entries(receipt.entityCounts).map(([type, n]) => (
              <span key={type} className="rounded-md bg-stone-100 px-2 py-0.5 text-xs">
                {TYPE_LABEL[type] ?? type} <strong className="font-semibold">{n}</strong>
              </span>
            ))}
          </span>
        </Row>
        <Row label="Detection">
          {mode === "rules+nano" ? "Rules + Gemini Nano (on device)" : "Rules only (on device)"}
          <span className="text-stone-500"> · found by {receipt.detectorSources.join(" + ")}</span>
        </Row>
        <Row label="Inference">
          <span className="rounded-md bg-sky-50 px-2 py-0.5 text-xs text-sky-800">{receipt.inferenceSource === "in_cloud" ? "cloud" : "on device"}</span>{" "}
          <span className="font-mono text-xs">{receipt.cloudModel}</span>
          <span className="text-stone-500">
            {" "}
            · {receipt.cloudAttempts === 1 ? "first try" : `${receipt.cloudAttempts} attempts`}
          </span>
        </Row>
        <Row label="Timings">
          <div className="space-y-1">
            <div className="flex h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden>
              {Object.entries(t).map(([stage, ms], i) => (
                <span key={stage} style={{ width: `${(ms / total) * 100}%` }} className={["bg-accent-600", "bg-accent-600/70", "bg-accent-600/50", "bg-sky-500", "bg-accent-600/30"][i]} />
              ))}
            </div>
            <p className="font-mono text-xs text-stone-600">
              {Object.entries(t)
                .map(([stage, ms]) => `${stage} ${ms.toLocaleString()} ms`)
                .join(" · ")}
            </p>
          </div>
        </Row>
        <Row label="Chain">
          {receipt.prevReceiptHash ? (
            <span className="font-mono text-xs">
              ← {short(receipt.prevReceiptHash)} <span className="font-sans text-stone-500">(previous receipt in this matter)</span>
            </span>
          ) : (
            <span className="text-stone-600">First receipt in this matter</span>
          )}
          <span className="block font-mono text-xs text-stone-500" title={receipt.hash}>
            this receipt {short(receipt.hash)}
          </span>
        </Row>
      </dl>
    </section>
  );
}
