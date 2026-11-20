# Splita

Identity-split inference for Firebase AI Logic. Identities are detected and pseudonymized on-device (Gemini Nano in Chrome), the cloud model reasons only on anonymized text, and real identities are restored on-device. Every request writes a hash-chained privacy receipt.

Status: Phase 0 (de-risk spike). See [docs/PHASE0.md](docs/PHASE0.md).

## Layout

- `packages/core` — pure TypeScript pipeline core (no Firebase/browser/Next imports)
- `packages/web` — browser/Firebase adapters
- `packages/sdk` — public SDK
- `apps/clerk` — Next.js demo app (`/spike` hosts the Phase 0 spike)
- `firebase/` — rules and Firebase config

## License

Apache-2.0
