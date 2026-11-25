// Pure TypeScript core. Must never import Firebase, browser globals, or Next.js.
export const SPLITA_CORE_VERSION = "0.1.0";

export * from "./types.js";
export * from "./ports.js";
export { runSplita, type SplitaDeps, type SplitaFailure, type SplitaInput, type SplitaResult, type SplitaSuccess } from "./pipeline.js";
export { RulesDetector, DEFAULT_RULES } from "./rules-detector.js";
export type { Rule } from "./rules/match.js";
export { resolveOverlaps } from "./overlap.js";
export { resolveEntities, matchKey, type Mention, type Resolution } from "./resolver.js";
export { pseudonymize } from "./pseudonymize.js";
export { assertNoLeak, IdentityLeakError } from "./leak.js";
export { restore, mappingFromEntities } from "./restore.js";
export { canonicalJson, countEntities, detectorSources, receiptHash, sealReceipt, InMemoryReceiptLog } from "./receipt.js";
export { InMemoryVault } from "./memory-vault.js";
export { parseMoney, ngnBucket, moneyPlaceholderPrefix, type Currency, type MoneyValue, type NgnBucket } from "./money.js";
export { detectRole, ROLES, type Role } from "./roles.js";
export { CompositeDetector, type DetectionMode, type DetectorStatus, type OptionalDetector } from "./composite-detector.js";
export { detectAddresses, detectPlaces, locationKind, type LocationKind } from "./rules/location.js";
export { PUBLIC_TERMS, dropPublicTerms, findPublicTerms, isPublicTerm } from "./public-terms.js";
