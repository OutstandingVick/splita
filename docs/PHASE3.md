# Phase 3: The Splita app

**Splita: cloud intelligence, zero-knowledge context.** A private document-review workspace for Nigerian lawyers and legal clerks. It lives in `apps/clerk` at `/`. The dev tools `/spike` and `/pipeline-test` still work.

## Screens

| Route | What it does |
|---|---|
| `/` | Hero, the three-step identity-split visual (device detects → cloud reasons on stand-ins → device restores), live on-device status, **Open workspace** (opens the demo matter). |
| `/workspace` | Matter list (stored in this browser, one identity vault per matter), document paste or `.txt` upload, question, **Ask privately**, pipeline strip, restored answer, split view, receipt. |
| `/receipts` | The user's Firestore receipts grouped by matter, with every chain verified in the browser. |

## Workspace flow

1. **Ask privately** runs `createSplitaWeb().run()` with `onStage` and `onCloudAttempt`. The strip animates through Detect (rules + Nano) → Pseudonymize → Verify (leak guard) → Cloud → Restore → Receipt, showing real timings. While the Cloud stage runs, it shows retries live ("Retry 1 on gemini-3.5-flash-lite (server busy)…").
2. **Answer**: the restored answer as Markdown. Courts, agencies and statutes are underlined; clicking one, or selecting text and choosing **Explain selection**, runs Quick explain (`PREFER_ON_DEVICE`), with a badge showing on-device or cloud. Text containing a client identity is refused before anything is sent.
3. **Show what the cloud saw**: *Your view* (original text, on device) beside *Cloud's view* (the exact payload). Placeholders are amber for rules and violet for Gemini Nano; hover shows type and detector. Hovering or focusing a placeholder highlights every real mention on the left and scrolls to it. That lookup uses `localView` spans computed on the device, never anything from the cloud.
4. **Receipt card**: payload hash, identities by type, detection mode, inference source, cloud model and attempts, per-stage timings, and the link to the previous receipt. **Verify** recomputes sha256 of the payload shown in Cloud's view, and the receipt's own hash, then shows ✓ when both match.

## Status and failure states

- The header badge shows **On-device: Gemini Nano ready**, **Rules-only mode** (hover for why), **Offline** or "Checking on-device model…".
- **Offline**: the button becomes **Preview on device**. Rules and Nano run locally, the split view shows exactly what would be sent, and the strip marks Cloud, Restore and Receipt as skipped. Nothing leaves the device.
- **Fail-closed** errors are explained in plain language and say what did and didn't leave the device (`lib/explain-failure.ts`). Errors before the cloud stage report "Nothing was sent". A receipt failure withholds the answer.

## New core and web APIs

- core: `runSplita(input, deps, { onStage })` stage events, including `verify`. `localView.spans` gives each placeholder's source position (on device only). Also `previewSplita()`, `verifyReceipt()` and `verifyChains()`.
- web: the `onCloudAttempt` callback on `run()`, `preview()` (rules + Nano, offline), and `receipts()`.

## Dev

```bash
pnpm --filter @splita/clerk dev
```

`scripts/dev.sh` builds core and web, then keeps both rebuilding (`tsc -w`) next to `next dev`. `transpilePackages` makes Next pick the changes up without a restart. Ctrl+C stops all three.

## Tests

`apps/clerk` now has vitest for its pure logic: the matters store, device badge, pipeline progress model, failure explanations and Markdown parsing.

## Not included

- PDF upload needs a parsing dependency, so it isn't in this phase. Only `.txt` upload is supported.
