import { assertNoLeak } from "./leak.js";
import { resolveOverlaps } from "./overlap.js";
import { placeholderInfo, type PlaceholderInfo, type SourceSpan, sourceSpans } from "./pipeline.js";
import type { DetectorPort, VaultPort } from "./ports.js";
import { dropPublicTerms } from "./public-terms.js";
import { pseudonymize } from "./pseudonymize.js";
import { resolveEntities } from "./resolver.js";

export interface PreviewResult {
  anonymizedText: string;
  placeholders: PlaceholderInfo[];
  localView: { text: string; spans: SourceSpan[] };
}

/**
 * Detect → resolve → pseudonymize → leak guard, entirely on the device: no reasoner, no receipt,
 * and no vault writes (placeholders reuse the matter's existing ones). Used offline, so the user
 * still sees exactly what would be sent.
 */
export async function previewSplita(
  input: { workspaceId: string; text: string },
  deps: { detectors: readonly DetectorPort[]; vault: VaultPort },
): Promise<PreviewResult> {
  const { workspaceId, text } = input;
  const spans = dropPublicTerms(resolveOverlaps((await Promise.all(deps.detectors.map((d) => d.detect(text)))).flat()), text);
  const { entities, mentions } = resolveEntities(text, spans, await deps.vault.list(workspaceId));
  const p = pseudonymize(text, mentions, entities);
  assertNoLeak(p.anonymizedText, p.mapping);
  return {
    anonymizedText: p.anonymizedText,
    placeholders: placeholderInfo(p.mapping, p.spans),
    localView: { text, spans: sourceSpans(mentions, entities) },
  };
}
