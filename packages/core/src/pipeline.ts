import { assertNoLeak } from "./leak.js";
import { resolveOverlaps } from "./overlap.js";
import type { DetectorPort, HasherPort, ReasonerPort, ReceiptPort, VaultPort } from "./ports.js";
import { pseudonymize } from "./pseudonymize.js";
import { countEntities, detectorSources, receiptHash, sealReceipt } from "./receipt.js";
import { resolveEntities } from "./resolver.js";
import { mappingFromEntities, restore } from "./restore.js";
import type { Receipt, Stage, StageTimings } from "./types.js";

export interface SplitaDeps {
  detectors: readonly DetectorPort[];
  vault: VaultPort;
  reasoner: ReasonerPort;
  receipts: ReceiptPort;
  hasher: HasherPort;
  /** Monotonic-ish ms clock for stage timings. Defaults to Date.now. */
  now?: () => number;
  /** Wall clock for receipt timestamps. Defaults to new Date(). */
  clock?: () => Date;
}

export interface SplitaInput {
  workspaceId: string;
  text: string;
}

export interface SplitaSuccess {
  ok: true;
  /** Cloud answer with real identities restored on-device. */
  answer: string;
  /** Exactly what the cloud saw and said. */
  cloudView: { anonymizedText: string; cloudAnswer: string };
  receipt: Receipt;
}

export interface SplitaFailure {
  ok: false;
  stage: Stage;
  error: Error;
}

export type SplitaResult = SplitaSuccess | SplitaFailure;

/**
 * detect → resolve → pseudonymize → reason → restore → receipt.
 * Fail-closed: any error before `reason` returns a failure and the reasoner is never called.
 */
export async function runSplita(input: SplitaInput, deps: SplitaDeps): Promise<SplitaResult> {
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => new Date());
  const timings: StageTimings = { detect: 0, resolve: 0, pseudonymize: 0, reason: 0, restore: 0 };
  let stage: Stage = "detect";

  const timed = async <T>(s: Exclude<Stage, "receipt">, fn: () => Promise<T> | T): Promise<T> => {
    stage = s;
    const t0 = now();
    const out = await fn();
    timings[s] = now() - t0;
    return out;
  };

  try {
    const { workspaceId, text } = input;

    const spans = await timed("detect", async () =>
      resolveOverlaps((await Promise.all(deps.detectors.map((d) => d.detect(text)))).flat()),
    );

    const { entities, mentions } = await timed("resolve", async () => {
      const r = resolveEntities(text, spans, await deps.vault.list(workspaceId));
      for (const e of r.entities) await deps.vault.put(workspaceId, e);
      return r;
    });

    const pseudo = await timed("pseudonymize", () => {
      const p = pseudonymize(text, mentions, entities);
      assertNoLeak(p.anonymizedText, p.mapping);
      return p;
    });

    const payloadHash = await deps.hasher.sha256(pseudo.anonymizedText);
    const cloud = await timed("reason", () => deps.reasoner.reason(pseudo.anonymizedText));

    const answer = await timed("restore", async () =>
      restore(cloud.text, mappingFromEntities(await deps.vault.list(workspaceId))),
    );

    stage = "receipt";
    const prev = await deps.receipts.head(workspaceId);
    const prevReceiptHash = prev ? await receiptHash(prev, deps.hasher) : null;
    const timestamp = clock().toISOString();
    const id = (await deps.hasher.sha256(`${prevReceiptHash ?? ""}|${timestamp}|${payloadHash}`)).slice(0, 32);
    const receipt = await sealReceipt(
      {
        id,
        timestamp,
        workspaceId,
        payloadHash,
        entityCounts: countEntities(pseudo.mapping),
        detectorSources: detectorSources(pseudo.spans),
        inferenceSource: cloud.source,
        timings,
        prevReceiptHash,
      },
      deps.hasher,
    );
    await deps.receipts.append(receipt);

    return { ok: true, answer, cloudView: { anonymizedText: pseudo.anonymizedText, cloudAnswer: cloud.text }, receipt };
  } catch (e) {
    return { ok: false, stage, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
