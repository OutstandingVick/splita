import { ENTITY_TYPES, type Receipt } from "@splita/core";

export const RECEIPT_FIELDS = [
  "id", "timestamp", "workspaceId", "payloadHash", "entityCounts", "detectorSources",
  "inferenceSource", "timings", "prevReceiptHash", "hash",
] as const;

const TIMING_KEYS = ["detect", "resolve", "pseudonymize", "reason", "restore"];
const HEX64 = /^[0-9a-f]{64}$/;

export class ReceiptSafetyError extends Error {
  override name = "ReceiptSafetyError";
}

function fail(field: string): never {
  throw new ReceiptSafetyError(`Refusing to write receipt: unexpected or unsafe "${field}"`);
}

const isCountMap = (v: unknown, keys: readonly string[]) =>
  typeof v === "object" && v !== null && !Array.isArray(v) &&
  Object.entries(v).every(([k, n]) => keys.includes(k) && typeof n === "number" && Number.isFinite(n) && n >= 0);

/**
 * A receipt must be metadata only: hashes, counts, enums, timings. This whitelist makes it
 * impossible to persist raw text or the placeholder mapping, even by accident.
 */
export function assertSafeReceipt(r: Receipt): void {
  const keys = Object.keys(r);
  for (const k of keys) if (!(RECEIPT_FIELDS as readonly string[]).includes(k)) fail(k);
  for (const k of RECEIPT_FIELDS) if (!keys.includes(k)) fail(k);
  if (!/^[0-9a-f]{32}$/.test(r.id)) fail("id");
  if (!HEX64.test(r.hash)) fail("hash");
  if (!HEX64.test(r.payloadHash)) fail("payloadHash");
  if (r.prevReceiptHash !== null && !HEX64.test(r.prevReceiptHash)) fail("prevReceiptHash");
  if (Number.isNaN(Date.parse(r.timestamp)) || r.timestamp.length > 30) fail("timestamp");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(r.workspaceId)) fail("workspaceId");
  if (r.inferenceSource !== "in_cloud" && r.inferenceSource !== "on_device") fail("inferenceSource");
  if (!Array.isArray(r.detectorSources) || !r.detectorSources.every((s) => s === "rules" || s === "nano")) fail("detectorSources");
  if (!isCountMap(r.entityCounts, ENTITY_TYPES)) fail("entityCounts");
  if (!isCountMap(r.timings, TIMING_KEYS)) fail("timings");
}
