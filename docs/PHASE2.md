# Phase 2: Web adapters

`packages/web` connects the pure core to the browser and Firebase. `packages/core` still has no Firebase or browser imports.

| Port | Adapter | Notes |
|---|---|---|
| `DetectorPort` | `CompositeDetector` (core) = `RulesDetector` + `NanoDetector` | Rules run first (milliseconds), and their spans are passed to Nano. Spans merge longest-first, and rules win ties. If Nano is anything but `ready`, the mode drops to `rules-only`. |
| | `NanoDetector` | Firebase AI Logic `ONLY_ON_DEVICE`, behind the single-flight `OnDeviceQueue`. The text is split into sentences, and only sentences with a capitalized name not covered by a rule span or the allowlist are sent, batched into one prompt. The prompt is minimal, and the `responseConstraint` schema allows `[{text, type}]` with PERSON or ORG only, capped by `maxItems: 16` and `maxLength: 60`. The on-device API has no `maxOutputTokens`, so the schema bounds stand in for it. Names are mapped back to whole-word occurrences, so hallucinated ones are dropped. 20 s budget; never throws. `lastRun` reports warm/cold, ms, and sentences prompted. |
| `ReasonerPort` | `FirebaseReasoner` | Retries 429/500/503 with exponential backoff and ±25% jitter (~1 s, 2 s). Then, after ~4 s, it falls back once to a second `ONLY_IN_CLOUD` model (`fallbackCloudModel` or `NEXT_PUBLIC_FALLBACK_CLOUD_MODEL`, default `gemini-3.5-flash`; `gemini-2.5-flash` returns 404 for new projects) with the same anonymized payload. If that fails too, the run fails closed at `reason`: nothing is restored and no receipt is written. Attempts and model go into the receipt (`cloudAttempts`, `cloudModel`). |
| | | `ONLY_IN_CLOUD` on `gemini-3.5-flash-lite`, with a system instruction to keep placeholders verbatim and never guess real values. `source` comes from `response.inferenceSource`. |
| `VaultPort` | `IndexedDBVault` | DB `splita-vault`, one object store per workspace (`ws:<id>`), plus `clearWorkspace()`. It stays on this device and is never synced. |
| `ReceiptPort` | `FirestoreReceipts` | `users/{uid}/receipts/{receiptId}` under anonymous Auth. A field whitelist (`assertSafeReceipt`) runs before every write, so raw text and the mapping can't be stored. |
| `HasherPort` | `WebCryptoHasher` | `crypto.subtle` SHA-256, hex output. |

`createSplitaWeb({ ai, auth, firestore })` returns `{ run, explain, warmUpNano, signIn, vault, nanoStatus, nanoError }`. `run({ workspaceId, text, question })` pseudonymizes the question and the document together, so names in the question never leave the device either.

### Firebase AI Logic hybrid inference

Every call site and its `InferenceMode` is listed in the README under [How Splita uses Firebase AI Logic hybrid inference](../README.md#how-splita-uses-firebase-ai-logic-hybrid-inference).

### Public terms are never redacted

`dropPublicTerms` (core `public-terms.ts`) runs after spans are merged. It removes any span that is, or sits entirely inside, a court, agency or statute name ("National Industrial Court", "CBN", "NDPA 2023", "Lagos State Tenancy Law 2011"). A span that only overlaps one is kept, so when in doubt the text is still redacted.

Core also gained a LOCATION rule: the 36 states plus FCT, their capitals, major cities, and street addresses. Its placeholders are `CITY_NG_n`, `STATE_NG_n` and `ADDRESS_n`.

## Firebase console (manual)

- [ ] **Authentication → Get started → Sign-in method → Anonymous → Enable.** Without this, receipts fail with `auth/configuration-not-found`.
- [ ] Firestore already exists (production mode). Deploy the rules and index below.

## Deploy Firestore rules + index

The rules are in `firebase/firestore.rules`. The owner can create and read receipts; update and delete are always denied, and documents must match the receipt field whitelist. The index on `workspaceId ↑, timestamp ↓` serves `head()`.

```bash
cd firebase
```

```bash
npx firebase-tools login
```

```bash
npx firebase-tools deploy --only firestore
```

`.firebaserc` pins the `splita-ec273` project.

### Check that update/delete are rejected

1. Firebase console → Firestore → Rules → **Rules Playground**.
2. Simulate an **update** of `users/<your-uid>/receipts/<any-id>` as an authenticated user with that uid. It should be **denied**.
3. Repeat with **delete**. It should be **denied**.
4. A **get** of the same path should be **allowed**.

## Run

```bash
pnpm --filter @splita/clerk dev
```

`predev` builds `core` and `web` first. Open `http://localhost:3000/pipeline-test` in Chrome with Gemini Nano enabled (see PHASE0.md). The page warms Nano up on load and logs the cause to the console if warm-up fails. It shows the detection mode, warm/cold Nano timing, the anonymized text with each placeholder highlighted (hover for its type and whether rules or Nano found it, never the value), both answers rendered as Markdown, **Quick explain** (`PREFER_ON_DEVICE`, with an on-device/cloud badge), whole-ms stage timings and the receipt.

**Reset vault** clears this workspace's mappings, so placeholders restart at `_1`.

## Tests

- `packages/core`: public-term allowlist, rules-first composite detection, placeholder info.
- `packages/web`: single-flight on-device queue, warm-up ordering, name-candidate skip, rule-found skip list, warm/cold timing, Quick explain guard, hasher, Nano parsing, chunking and offset mapping, the Nano detector (timeout, unavailable, error, warm-up), the reasoner, receipt safety, and Firestore receipts with `firebase/firestore` mocked.
- `IndexedDBVault` has no unit tests, because that would need a fake IndexedDB dependency. `/pipeline-test` checks it in a real browser.

## Receipt fields added (redeploy rules)

Receipts now include `cloudModel` and `cloudAttempts`. The Firestore rules whitelist them, so redeploy before running:

```bash
cd firebase && npx firebase-tools deploy --only firestore:rules
```
