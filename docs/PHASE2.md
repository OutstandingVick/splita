# Phase 2: Web adapters

`packages/web` connects the pure core to the browser and Firebase. `packages/core` still has no Firebase or browser imports.

| Port | Adapter | Notes |
|---|---|---|
| `DetectorPort` | `CompositeDetector` (core) = `RulesDetector` + `NanoDetector` | Spans merge longest-first, and rules win ties. If Nano is anything but `ready`, the mode drops to `rules-only`. |
| | `NanoDetector` | Firebase AI Logic `ONLY_ON_DEVICE`, constrained by a JSON Schema (`promptOptions.responseConstraint`). Returns PERSON / ORG / LOCATION only. Text is chunked at about 2,000 chars on paragraph breaks. Each answer is mapped back to every whole-word occurrence, so hallucinated entities find no match and are dropped. It has a 20 s timeout and never throws. `status` is `ready`, `unavailable`, `timeout` or `error`. |
| `ReasonerPort` | `FirebaseReasoner` | `ONLY_IN_CLOUD` on `gemini-3.5-flash-lite`, with a system instruction to keep placeholders verbatim and never guess real values. `source` comes from `response.inferenceSource`. |
| `VaultPort` | `IndexedDBVault` | DB `splita-vault`, one object store per workspace (`ws:<id>`), plus `clearWorkspace()`. It stays on this device and is never synced. |
| `ReceiptPort` | `FirestoreReceipts` | `users/{uid}/receipts/{receiptId}` under anonymous Auth. A field whitelist (`assertSafeReceipt`) runs before every write, so raw text and the mapping can't be stored. |
| `HasherPort` | `WebCryptoHasher` | `crypto.subtle` SHA-256, hex output. |

`createSplitaWeb({ ai, auth, firestore })` returns `{ run, warmUpNano, signIn, vault, nanoStatus }`. `run({ workspaceId, text, question })` pseudonymizes the question and the document together, so names in the question never leave the device either.

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

`predev` builds `core` and `web` first. Open `http://localhost:3000/pipeline-test` in Chrome with Gemini Nano enabled (see PHASE0.md). The page warms Nano up on load, shows the detection mode, the anonymized text (all the cloud sees), the raw cloud answer, the restored answer, per-stage timings and the receipt.

**Reset vault** clears this workspace's mappings, so placeholders restart at `_1`.

## Tests

- `packages/web`: hasher, Nano parsing, chunking and offset mapping, the Nano detector (timeout, unavailable, error, warm-up), the reasoner, receipt safety, and Firestore receipts with `firebase/firestore` mocked.
- `IndexedDBVault` has no unit tests, because that would need a fake IndexedDB dependency. `/pipeline-test` checks it in a real browser.
