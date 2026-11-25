"use client";

import { type Receipt, type ReceiptCheck, verifyReceipt } from "@splita/core";
import { WebCryptoHasher } from "@splita/web";
import { useState } from "react";

/**
 * Recomputes sha256 of the exact anonymized payload shown in Cloud's view and the receipt's own
 * hash, in this browser, and compares them with what was stored.
 */
export function VerifyButton({ receipt, payload }: { receipt: Receipt; payload: string }) {
  const [check, setCheck] = useState<ReceiptCheck | "checking" | null>(null);

  async function verify() {
    setCheck("checking");
    setCheck(await verifyReceipt(receipt, payload, new WebCryptoHasher()));
  }

  if (check && check !== "checking") {
    const ok = check.payloadMatches && check.hashMatches;
    return (
      <span
        role="status"
        data-testid="verify-result"
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${ok ? "bg-accent-50 text-accent-800" : "bg-red-50 text-red-800"}`}
        title="sha256 of the payload in Cloud's view, recomputed in this browser"
      >
        <span aria-hidden>{ok ? "✓" : "✗"}</span>
        {ok ? "Payload matches · receipt intact" : !check.payloadMatches ? "Payload does not match" : "Receipt was altered"}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => void verify()}
      disabled={check === "checking"}
      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-60"
    >
      {check === "checking" ? "Verifying…" : "Verify"}
    </button>
  );
}
