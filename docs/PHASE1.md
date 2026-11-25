# Phase 1: Core pipeline

`packages/core` is pure TypeScript: no Firebase, browser, IndexedDB or Next.js imports, and `lib` is `ES2022` with no DOM types. All I/O goes through ports.

```
detect → resolve → pseudonymize → [leak guard] → reason → restore → receipt
```

| Stage | Module | Notes |
|---|---|---|
| Detect | `rules-detector.ts`, `rules/*` | Email, Nigerian phone (+234/0), 10-digit NUBAN, ₦/N/NGN/naira and USD amounts, DOB (only with birth context), titled names, a name dictionary (Yoruba/Igbo/Hausa/Ijaw), ORG suffixes. Overlaps: longest wins. |
| Resolve | `resolver.ts`, `names.ts`, `roles.ts` | Person aliases link by name-token subset ("Mr. Ogunleye" ⊂ "Adebayo Ogunleye"). A shared surname alone doesn't link. Other types link by normalized key. Vault entities are matched first, so placeholders stay stable across calls. |
| Placeholders | `placeholders.ts`, `money.ts` | Role-aware (`EMPLOYER_1`, `TENANT_1`, `CLIENT_1`…). Naira is bucketed: `AMOUNT_NGN_SMALL` (<₦100k), `_MID` (<₦5m), `_LARGE`. |
| Leak guard | `leak.ts` | Throws if any known alias survives (case-insensitive). The error never contains the value. |
| Restore | `restore.ts` | Only placeholders in this workspace's mapping are restored. Possessives and plurals are kept. Sentences asking for a real name ("reveal", "real name of…") are returned verbatim. |
| Receipt | `receipt.ts` | `payloadHash` = sha256 of exactly what was sent. Canonical-JSON body hash. `prevReceiptHash` chains to the previous receipt. |
| Orchestrate | `pipeline.ts` | `runSplita()`. **Fail-closed**: any error before `reason` returns `{ ok: false, stage }` and the reasoner is never called. |

## Interface notes

- `ReceiptPort` has `head(workspaceId)` as well as `append`. The chain needs the previous receipt, and this keeps chaining inside the core.
- `runSplita` takes an array of detectors (rules now, Nano in Phase 2) and merges their spans.
- `now` and `clock` are injectable for deterministic tests.

## Employment fixture: what the cloud sees

`test/fixtures/employment.ts` → `cloudView.anonymizedText` (snapshot in `test/__snapshots__`):

```
RE: WRONGFUL TERMINATION — EMPLOYEE_1 v. EMPLOYER_1

Dear PERSON_1,

I act for EMPLOYEE_1 (the Employee), who was employed by EMPLOYER_1 (the Employer) as a relationship manager from March 2019. EMPLOYEE_1 was born on DOB_1 and earned a monthly salary of AMOUNT_NGN_MID_1.

On 3 October 2026, EMPLOYER_1 terminated EMPLOYEE_1's appointment without notice. His end-of-service benefit of AMOUNT_NGN_LARGE_1 and an outstanding leave allowance of AMOUNT_NGN_SMALL_1 remain unpaid. The Employer also withheld AMOUNT_NGN_MID_2 as a "training bond".

EMPLOYEE_1 can be reached on PHONE_1 or EMAIL_1. His salary account is ACCOUNT_1.

Please advise on the prospects of a claim at the National Industrial Court.

Yours faithfully,
PERSON_2
```

## Known limits (Phase 2 targets)

- Rules only. Names outside the dictionary are caught only when they have a title. Gemini Nano detection comes in `packages/web`.
- No LOCATION rule yet. Addresses and cities pass through.
- Restoring writes the canonical (longest) alias, so "Adebayo's" comes back as "Mr. Adebayo Ogunleye's".

## Run

```bash
pnpm --filter @splita/core test
```

```bash
pnpm build
```
