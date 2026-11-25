# Splita

Identity-split inference for Firebase AI Logic. Identities are detected and pseudonymized on-device (Gemini Nano in Chrome), the cloud model reasons only on anonymized text, and real identities are restored on-device. Every request writes a hash-chained privacy receipt.

Status: Phase 2 (web adapters). See [docs/PHASE0.md](docs/PHASE0.md), [docs/PHASE1.md](docs/PHASE1.md) and [docs/PHASE2.md](docs/PHASE2.md).

## How Splita uses Firebase AI Logic hybrid inference

All model calls go through the Firebase JS SDK (`firebase/ai`, `getGenerativeModel` with an `InferenceMode`), with App Check enforced. On-device means Gemini Nano in Chrome; cloud means `gemini-3.5-flash-lite` on the Gemini Developer API.

| Call site | InferenceMode | What it does | Sees real identities? |
|---|---|---|---|
| [`createNanoModel`](packages/web/src/nano-model.ts) → [`NanoDetector.detect`](packages/web/src/nano-detector.ts) | `ONLY_ON_DEVICE` | Finds PERSON/ORG names the rules missed. JSON-schema constrained. Never falls back to cloud. | Yes, and they never leave the device |
| [`NanoDetector.warmUp`](packages/web/src/nano-detector.ts) via [`warmUpNano`](packages/web/src/nano-model.ts) | `ONLY_ON_DEVICE` | One trivial call on page load so the model is loaded before the first run. | No |
| [`createCloudModel`](packages/web/src/firebase-reasoner.ts) → `FirebaseReasoner.reason` | `ONLY_IN_CLOUD` | Legal reasoning on the pseudonymized prompt. Retries 429/500/503, then falls back to a second cloud model, also `ONLY_IN_CLOUD`. | No: placeholders only, checked by the leak guard |
| [`createExplainModel`](packages/web/src/quick-explain.ts) → `QuickExplainer.explain` | `PREFER_ON_DEVICE` | **Quick explain** on `/pipeline-test`: defines a term or placeholder type. Nano when available, cloud otherwise. The UI shows the SDK's `response.inferenceSource` as a badge. | No: placeholders become their type, and terms containing a vault identity are refused |
| [`getHybridModel` / `runHybrid`](apps/clerk/lib/hybrid.ts) on `/spike` | all four modes | Phase 0 spike: runs one prompt in each mode, reports `inferenceSource`, and triggers the model download (`initializeDeviceModel`). | No |

**On-device calls never overlap.** The SDK's Chrome adapter creates a new session for each `generateContent()` and destroys the previous one, so two calls in flight at once can kill each other's session. Every on-device-capable call (warm-up, detection chunks, Quick explain) goes through one single-flight [`OnDeviceQueue`](packages/web/src/on-device-queue.ts) and runs one after another. A run that starts during warm-up waits for warm-up to finish.

**Keeping sequential calls fast.** Rules run first, in milliseconds. Nano only looks for PERSON/ORG names the rules didn't find. Only sentences with a capitalized name that rules and the allowlist don't cover are sent, batched into one prompt; if there are none, the Nano pass is skipped ([`name-candidates.ts`](packages/web/src/name-candidates.ts)). `/pipeline-test` shows warm vs cold time and how many sentences were sent to Nano.

## Layout

- `packages/core` — pure TypeScript pipeline core (no Firebase/browser/Next imports)
- `packages/web` — browser/Firebase adapters
- `packages/sdk` — public SDK
- `apps/clerk` — Next.js demo app (`/spike` hosts the Phase 0 spike)
- `firebase/` — rules and Firebase config

## License

Apache-2.0
