import {
  CompositeDetector,
  type DetectionMode,
  type DetectorStatus,
  RulesDetector,
  runSplita,
  type SplitaDeps,
  type SplitaResult,
  type PreviewResult,
  previewSplita,
  type Receipt,
  type StageEvent,
} from "@splita/core";
import type { AI } from "firebase/ai";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore/lite";
import { CLOUD_MODEL, type CloudAttempt, createCloudModel, FALLBACK_CLOUD_MODEL, FirebaseReasoner } from "./firebase-reasoner.js";
import { ensureAnonymousUser, FirestoreReceipts } from "./firestore-receipts.js";
import { WebCryptoHasher } from "./hasher.js";
import { IndexedDBVault } from "./indexeddb-vault.js";
import type { NanoDetector, NanoDetectorOptions, NanoRun } from "./nano-detector.js";
import { createNanoDetector, createNanoModel, warmUpNano } from "./nano-model.js";
import { OnDeviceQueue, queued } from "./on-device-queue.js";
import { createExplainModel, type Explanation, QuickExplainer } from "./quick-explain.js";

export interface SplitaWebOptions {
  ai: AI;
  firestore: Firestore;
  auth: Auth;
  /** Primary cloud model (ONLY_IN_CLOUD). */
  cloudModel?: string;
  /** Cloud model tried after the primary's retries run out, or false for none. */
  fallbackCloudModel?: string | false;
  /** Nano options, or false to run rules-only. */
  nano?: NanoDetectorOptions | false;
}

export interface SplitaRunInput {
  workspaceId: string;
  text: string;
  question?: string;
  /** Live stage progress (detect, pseudonymize, verify, reason, restore, receipt). */
  onStage?: (event: StageEvent) => void;
  /** Every cloud call: first try, retries (with reason) and the fallback. */
  onCloudAttempt?: (attempt: CloudAttempt) => void;
  /** Streaming answer: anonymized text so far and its on-device restoration (complete placeholders only). */
  onAnswer?: (partial: { cloud: string; restored: string }) => void;
}

export type SplitaRunResult = SplitaResult & {
  mode: DetectionMode;
  nanoStatus: DetectorStatus;
  nanoError?: string;
  /** Nano pass timing (warm vs cold), when Nano ran. */
  nanoRun?: NanoRun;
};

export interface SplitaWeb {
  run(input: SplitaRunInput): Promise<SplitaRunResult>;
  warmUpNano(): Promise<DetectorStatus>;
  /** Quick explain (PREFER_ON_DEVICE). Refuses text containing a known identity from this workspace. */
  explain(workspaceId: string, term: string): Promise<Explanation>;
  /** Anonymize on the device only, rules + Nano (no cloud, no receipt, no vault writes). Works offline. */
  preview(input: { workspaceId: string; text: string; question?: string }): Promise<PreviewResult>;
  /** This user's receipts from Firestore, newest first. */
  receipts(workspaceId?: string): Promise<Receipt[]>;
  /**
   * Call on app load: signs in anonymously and fetches the matter's latest receipt, so the
   * Receipt stage later is a single write. Never throws.
   */
  warmUpCloud(workspaceId?: string): Promise<void>;
  /** Anonymous sign-in; call on app start. Resolves to the uid. */
  signIn(): Promise<string>;
  readonly vault: IndexedDBVault;
  readonly nanoStatus: DetectorStatus;
  /** Why Nano last failed (never contains document text). */
  readonly nanoError: string | undefined;
}

/** The question is pseudonymized together with the document, so names in it never leave either. */
export function composePrompt(question: string | undefined, text: string): string {
  const q = question?.trim();
  return q ? `Question:\n${q}\n\nDocument:\n${text}` : text;
}

const KEEP_WARM_MS = 8_000;

/** Wires the web adapters into the core pipeline. */
export function createSplitaWeb(opts: SplitaWebOptions): SplitaWeb {
  // Every on-device call (warm-up, detection, Quick explain) shares one single-flight queue.
  const onDevice = new OnDeviceQueue();
  const nano: NanoDetector | undefined =
    opts.nano === false ? undefined : createNanoDetector(queued(createNanoModel(opts.ai), onDevice), opts.nano);
  const explainer = new QuickExplainer(queued(createExplainModel(opts.ai), onDevice));
  const detector = new CompositeDetector(new RulesDetector(), nano);
  const vault = new IndexedDBVault();
  const cloudModel = opts.cloudModel ?? CLOUD_MODEL;
  const fallbackName = opts.fallbackCloudModel === false ? undefined : (opts.fallbackCloudModel ?? FALLBACK_CLOUD_MODEL);

  let uidPromise: Promise<string> | undefined;
  const signIn = () => {
    uidPromise ??= ensureAnonymousUser(opts.auth).catch((e: unknown) => {
      uidPromise = undefined;
      throw e;
    });
    return uidPromise;
  };

  const reasoner = new FirebaseReasoner(createCloudModel(opts.ai, cloudModel), {
      modelName: cloudModel,
      ...(fallbackName ? { fallback: { name: fallbackName, model: createCloudModel(opts.ai, fallbackName) } } : {}),
    });
  const receipts = new FirestoreReceipts(opts.firestore, signIn);
  const deps: SplitaDeps = {
    detectors: [detector],
    vault,
    reasoner,
    receipts,
    hasher: new WebCryptoHasher(),
    now: () => performance.now(),
  };

  return {
    vault,
    signIn,
    preview: ({ workspaceId, text, question }) =>
      previewSplita({ workspaceId, text: composePrompt(question, text) }, { detectors: [detector], vault }),
    receipts: (workspaceId) => receipts.list(workspaceId),
    async warmUpCloud(workspaceId) {
      try {
        await signIn();
        if (workspaceId) await receipts.head(workspaceId);
        else await receipts.list(undefined, 1);
      } catch {
        // Offline or not configured yet: the run reports any real problem.
      }
    },
    async explain(workspaceId, term) {
      const known = (await vault.list(workspaceId)).flatMap((e) => e.aliases);
      return explainer.explain(term, known);
    },
    get nanoStatus() {
      return nano?.status ?? "unavailable";
    },
    get nanoError() {
      return nano?.lastError;
    },
    warmUpNano: () => (nano ? warmUpNano(nano) : Promise.resolve<DetectorStatus>("unavailable")),
    async run({ workspaceId, text, question, onStage, onCloudAttempt, onAnswer }) {
      reasoner.setAttemptListener(onCloudAttempt);
      // While the cloud model thinks, keep the Firestore connection warm with a tiny read, so the
      // receipt write right after does not pay for a fresh connection.
      let keepWarm: ReturnType<typeof setInterval> | undefined;
      const stopWarm = () => clearInterval(keepWarm);
      const hooks = {
        onStage: (e: StageEvent) => {
          if (e.stage === "reason" && e.phase === "start") {
            keepWarm = setInterval(() => void receipts.list(workspaceId, 1).catch(() => undefined), KEEP_WARM_MS);
          } else if (e.stage === "reason") stopWarm();
          onStage?.(e);
        },
        ...(onAnswer ? { onAnswer } : {}),
      };
      const result = await runSplita({ workspaceId, text: composePrompt(question, text) }, deps, hooks).finally(() => {
        stopWarm();
        reasoner.setAttemptListener(undefined);
      });
      const nanoError = nano?.lastError;
      const nanoRun = nano?.lastRun;
      return {
        ...(nanoRun ? { nanoRun } : {}),
        ...result,
        mode: detector.lastMode,
        nanoStatus: nano?.status ?? "unavailable",
        ...(nanoError ? { nanoError } : {}),
      };
    },
  };
}
