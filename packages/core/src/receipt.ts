import type { HasherPort, ReceiptPort } from "./ports.js";
import type { DetectorSource, EntityType, Mapping, Receipt, ReceiptBody, Span } from "./types.js";

/** Deterministic JSON: object keys sorted recursively, undefined fields dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

/** Hash of a receipt's body (its `hash` field, if any, is excluded). */
export async function receiptHash(r: ReceiptBody | Receipt, hasher: HasherPort): Promise<string> {
  const { hash: _ignored, ...body } = r as Receipt;
  return hasher.sha256(canonicalJson(body));
}

export async function sealReceipt(body: ReceiptBody, hasher: HasherPort): Promise<Receipt> {
  return { ...body, hash: await receiptHash(body, hasher) };
}

export function countEntities(mapping: Mapping): Partial<Record<EntityType, number>> {
  const counts: Partial<Record<EntityType, number>> = {};
  for (const e of Object.values(mapping)) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}

export function detectorSources(spans: readonly Span[]): DetectorSource[] {
  return [...new Set(spans.map((s) => s.source))].sort();
}

/** In-memory ReceiptPort for tests. */
export class InMemoryReceiptLog implements ReceiptPort {
  private readonly logs = new Map<string, Receipt[]>();

  async append(receipt: Receipt): Promise<void> {
    const log = this.logs.get(receipt.workspaceId) ?? [];
    log.push(receipt);
    this.logs.set(receipt.workspaceId, log);
  }

  async head(workspaceId: string): Promise<Receipt | undefined> {
    return this.logs.get(workspaceId)?.at(-1);
  }

  all(workspaceId: string): readonly Receipt[] {
    return this.logs.get(workspaceId) ?? [];
  }
}
