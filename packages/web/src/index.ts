// Browser + Firebase adapters for @splita/core.
export { createSplitaWeb, composePrompt, type SplitaWeb, type SplitaWebOptions, type SplitaRunInput, type SplitaRunResult } from "./splita-web.js";
export { WebCryptoHasher } from "./hasher.js";
export { NanoDetector, NanoTimeoutError, nanoPrompt, type NanoDetectorOptions, type NanoRun, type TextModel, isOnDeviceUnavailable } from "./nano-detector.js";
export { createNanoDetector, createNanoModel, warmUpNano } from "./nano-model.js";
export { chunkText, locateEntities, parseNanoEntities, NANO_RESPONSE_SCHEMA } from "./nano-parse.js";
export { FirebaseReasoner, createCloudModel, CLOUD_MODEL, FALLBACK_CLOUD_MODEL, REASONER_SYSTEM_INSTRUCTION, errorStatus, isRetryable, type ReasonerOptions, type NamedCloudModel } from "./firebase-reasoner.js";
export { IndexedDBVault, VAULT_DB } from "./indexeddb-vault.js";
export { FirestoreReceipts, ensureAnonymousUser } from "./firestore-receipts.js";
export { assertSafeReceipt, ReceiptSafetyError, RECEIPT_FIELDS } from "./receipt-safety.js";
export { OnDeviceQueue, queued } from "./on-device-queue.js";
export { QuickExplainer, createExplainModel, explainSubject, SensitiveTermError, EXPLAIN_SYSTEM_INSTRUCTION, type Explanation, type ExplainModel } from "./quick-explain.js";
