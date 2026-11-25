import { assertNoLeak } from "./leak.js";
import { resolveOverlaps } from "./overlap.js";
import type { DetectorPort, HasherPort, ReasonerPort, ReceiptPort, VaultPort } from "./ports.js";
import { dropPublicTerms } from "./public-terms.js";
import { pseudonymize } from "./pseudonymize.js";
import { restorePartial } from "./stream-restore.js";
import { countEntities, detectorSources, receiptHash, sealReceipt } from "./receipt.js";
import { type Mention, resolveEntities } from "./resolver.js";
import { mappingFromEntities, restore } from "./restore.js";
import type { DetectorSource, Entity, EntityType, Mapping, Receipt, Span, Stage, StageTimings } from "./types.js";

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

/** What the UI may show about a placeholder. Deliberately carries no real value. */
export interface PlaceholderInfo {
  placeholder: string;
  type: EntityType;
  role?: string;
  sources: DetectorSource[];
}

/** Which detectors found each placeholder in this run. */
export function placeholderInfo(mapping: Mapping, spans: readonly Span[]): PlaceholderInfo[] {
  return Object.values(mapping).map((e) => {
    const aliases = new Set(e.aliases.map((a) => a.toLowerCase()));
    const sources = [...new Set(spans.filter((s) => aliases.has(s.text.toLowerCase())).map((s) => s.source))].sort();
    return { placeholder: e.placeholder, type: e.type, ...(e.role ? { role: e.role } : {}), sources };
  });
}

/** Where a placeholder's real value sits in the text that was anonymized. On-device only: never sent or stored. */
export interface SourceSpan {
  start: number;
  end: number;
  placeholder: string;
}

export function sourceSpans(mentions: readonly Mention[], entities: readonly Entity[]): SourceSpan[] {
  const byId = new Map(entities.map((e) => [e.id, e.placeholder]));
  return mentions
    .flatMap((m) => {
      const placeholder = byId.get(m.entityId);
      return placeholder ? [{ start: m.span.start, end: m.span.end, placeholder }] : [];
    })
    .sort((a, b) => a.start - b.start);
}

export interface SplitaSuccess {
  ok: true;
  /** Cloud answer with real identities restored on-device. */
  answer: string;
  /** Exactly what the cloud saw and said. */
  cloudView: { anonymizedText: string; cloudAnswer: string; placeholders: PlaceholderInfo[] };
  /** The original text and where each placeholder came from. Stays on this device. */
  localView: { text: string; spans: SourceSpan[] };
  receipt: Receipt;
}

export interface SplitaFailure {
  ok: false;
  stage: Stage;
  error: Error;
}

export type SplitaResult = SplitaSuccess | SplitaFailure;

/** Stages a UI can show. `verify` is the leak guard (timed inside `pseudonymize` in the receipt). */
export type ProgressStage = Stage | "verify";

export type StageEvent =
  | { stage: ProgressStage; phase: "start" }
  | { stage: ProgressStage; phase: "done"; ms: number }
  | { stage: ProgressStage; phase: "error" };

export interface SplitaHooks {
  /** Called as each stage starts and finishes. Must not throw (errors are ignored). */
  onStage?: (event: StageEvent) => void;
  /**
   * Streaming answer: the anonymized text received so far, and that text restored on the device
   * (complete placeholders only). Provisional; the final `answer` is authoritative.
   */
  onAnswer?: (partial: { cloud: string; restored: string }) => void;
}

/**
 * detect → resolve → pseudonymize → reason → restore → receipt.
 * Fail-closed: any error before `reason` returns a failure and the reasoner is never called.
 */
export async function runSplita(input: SplitaInput, deps: SplitaDeps, hooks: SplitaHooks = {}): Promise<SplitaResult> {
  const now = deps.now ?? Date.now;
  const clock = deps.clock ?? (() => new Date());
  const timings: StageTimings = { detect: 0, resolve: 0, pseudonymize: 0, reason: 0, restore: 0 };
  let stage: Stage = "detect";
  let current: ProgressStage = "detect";
  const emit = (event: StageEvent) => {
    try {
      hooks.onStage?.(event);
    } catch {
      // A UI callback must never break the pipeline.
    }
  };
  const track = async <T>(s: ProgressStage, fn: () => Promise<T> | T): Promise<{ out: T; ms: number }> => {
    current = s;
    emit({ stage: s, phase: "start" });
    const t0 = now();
    const out = await fn();
    const ms = Math.round(now() - t0);
    emit({ stage: s, phase: "done", ms });
    return { out, ms };
  };

  const timed = async <T>(s: Exclude<Stage, "receipt">, fn: () => Promise<T> | T): Promise<T> => {
    stage = s;
    const t0 = now();
    const { out } = await track(s, fn);
    timings[s] = Math.round(now() - t0);
    return out;
  };

  try {
    const { workspaceId, text } = input;

    // Merge every detector's spans, then un-redact public institutions and statutes.
    const spans = await timed("detect", async () =>
      dropPublicTerms(resolveOverlaps((await Promise.all(deps.detectors.map((d) => d.detect(text)))).flat()), text),
    );

    const { entities, mentions } = await timed("resolve", async () => {
      const r = resolveEntities(text, spans, await deps.vault.list(workspaceId));
      for (const e of r.entities) await deps.vault.put(workspaceId, e);
      return r;
    });

    const pseudo = await timed("pseudonymize", async () => {
      const p = pseudonymize(text, mentions, entities);
      await track("verify", () => assertNoLeak(p.anonymizedText, p.mapping));
      current = "pseudonymize";
      return p;
    });

    // Hash exactly what is sent, before sending; streaming does not change the payload.
    const payloadHash = await deps.hasher.sha256(pseudo.anonymizedText);
    const onAnswer = hooks.onAnswer;
    const streamMapping = onAnswer ? mappingFromEntities(await deps.vault.list(workspaceId)) : undefined;
    const cloud = await timed("reason", () =>
      deps.reasoner.reason(
        pseudo.anonymizedText,
        onAnswer && streamMapping
          ? {
              onText: (t) => {
                try {
                  onAnswer({ cloud: t, restored: restorePartial(t, streamMapping) });
                } catch {
                  // UI callback errors never affect the run.
                }
              },
            }
          : undefined,
      ),
    );

    const answer = await timed("restore", async () =>
      restore(cloud.text, mappingFromEntities(await deps.vault.list(workspaceId))),
    );

    stage = "receipt";
    current = "receipt";
    emit({ stage: "receipt", phase: "start" });
    const tReceipt = now();
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
        cloudModel: cloud.model ?? "unknown",
        cloudAttempts: cloud.attempts ?? 1,
        timings,
        prevReceiptHash,
      },
      deps.hasher,
    );
    await deps.receipts.append(receipt);
    emit({ stage: "receipt", phase: "done", ms: Math.round(now() - tReceipt) });

    return { ok: true, answer, cloudView: {
        anonymizedText: pseudo.anonymizedText,
        cloudAnswer: cloud.text,
        placeholders: placeholderInfo(pseudo.mapping, pseudo.spans),
      },
      localView: { text, spans: sourceSpans(mentions, entities) },
      receipt,
    };
  } catch (e) {
    emit({ stage: current, phase: "error" });
    return { ok: false, stage, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
