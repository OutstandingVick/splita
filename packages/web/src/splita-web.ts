import {
  CompositeDetector,
  type DetectionMode,
  type DetectorStatus,
  RulesDetector,
  runSplita,
  type SplitaDeps,
  type SplitaResult,
} from "@splita/core";
import type { AI } from "firebase/ai";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { createCloudModel, FirebaseReasoner } from "./firebase-reasoner.js";
import { ensureAnonymousUser, FirestoreReceipts } from "./firestore-receipts.js";
import { WebCryptoHasher } from "./hasher.js";
import { IndexedDBVault } from "./indexeddb-vault.js";
import type { NanoDetector, NanoDetectorOptions, NanoRun } from "./nano-detector.js";
import { createNanoDetector, warmUpNano } from "./nano-model.js";

export interface SplitaWebOptions {
  ai: AI;
  firestore: Firestore;
  auth: Auth;
  /** Nano options, or false to run rules-only. */
  nano?: NanoDetectorOptions | false;
}

export interface SplitaRunInput {
  workspaceId: string;
  text: string;
  question?: string;
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

/** Wires the web adapters into the core pipeline. */
export function createSplitaWeb(opts: SplitaWebOptions): SplitaWeb {
  const nano: NanoDetector | undefined = opts.nano === false ? undefined : createNanoDetector(opts.nano);
  const detector = new CompositeDetector(new RulesDetector(), nano);
  const vault = new IndexedDBVault();

  let uidPromise: Promise<string> | undefined;
  const signIn = () => {
    uidPromise ??= ensureAnonymousUser(opts.auth).catch((e: unknown) => {
      uidPromise = undefined;
      throw e;
    });
    return uidPromise;
  };

  const deps: SplitaDeps = {
    detectors: [detector],
    vault,
    reasoner: new FirebaseReasoner(createCloudModel(opts.ai)),
    receipts: new FirestoreReceipts(opts.firestore, signIn),
    hasher: new WebCryptoHasher(),
    now: () => performance.now(),
  };

  return {
    vault,
    signIn,
    get nanoStatus() {
      return nano?.status ?? "unavailable";
    },
    get nanoError() {
      return nano?.lastError;
    },
    warmUpNano: () => (nano ? warmUpNano(nano) : Promise.resolve<DetectorStatus>("unavailable")),
    async run({ workspaceId, text, question }) {
      const result = await runSplita({ workspaceId, text: composePrompt(question, text) }, deps);
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
