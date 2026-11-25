import type { HasherPort } from "./ports.js";
import { receiptHash } from "./receipt.js";
import type { Receipt } from "./types.js";

export interface ReceiptCheck {
  /** sha256(payload) equals the receipt's payloadHash: this is exactly what the cloud received. */
  payloadMatches: boolean;
  /** The receipt's own hash recomputes: nothing in it was altered. */
  hashMatches: boolean;
}

export async function verifyReceipt(receipt: Receipt, payload: string, hasher: HasherPort): Promise<ReceiptCheck> {
  const [payloadHash, hash] = await Promise.all([hasher.sha256(payload), receiptHash(receipt, hasher)]);
  return { payloadMatches: payloadHash === receipt.payloadHash, hashMatches: hash === receipt.hash };
}

export type ChainProblem = "tampered" | "broken-link" | "missing-genesis";

export interface ChainCheck {
  workspaceId: string;
  ok: boolean;
  length: number;
  /** First receipt that fails, and why. */
  problem?: { receiptId: string; kind: ChainProblem };
}

/**
 * Checks each workspace's chain: every receipt hash recomputes, the first has no predecessor, and
 * each prevReceiptHash equals the hash of the receipt before it (in timestamp order).
 */
export async function verifyChains(receipts: readonly Receipt[], hasher: HasherPort): Promise<ChainCheck[]> {
  const byWorkspace = new Map<string, Receipt[]>();
  for (const r of receipts) byWorkspace.set(r.workspaceId, [...(byWorkspace.get(r.workspaceId) ?? []), r]);
  const checks: ChainCheck[] = [];
  for (const [workspaceId, list] of [...byWorkspace].sort(([a], [b]) => a.localeCompare(b))) {
    const chain = [...list].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    let problem: ChainCheck["problem"];
    for (const [i, r] of chain.entries()) {
      if ((await receiptHash(r, hasher)) !== r.hash) problem = { receiptId: r.id, kind: "tampered" };
      else if (i === 0 && r.prevReceiptHash !== null) problem = { receiptId: r.id, kind: "missing-genesis" };
      else if (i > 0 && r.prevReceiptHash !== chain[i - 1]?.hash) problem = { receiptId: r.id, kind: "broken-link" };
      if (problem) break;
    }
    checks.push({ workspaceId, ok: !problem, length: chain.length, ...(problem ? { problem } : {}) });
  }
  return checks;
}
