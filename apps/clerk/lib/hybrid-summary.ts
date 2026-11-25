import type { DetectionMode, InferenceSource } from "@splita/core";

export interface HybridPart {
  where: "device" | "cloud";
  label: string;
  stages: string;
}

/**
 * Where each part of a run actually executed, from the detection mode and the reasoner's
 * reported inferenceSource (never assumed).
 */
export function hybridSummary(mode: DetectionMode, inferenceSource: InferenceSource, cloudModel: string): HybridPart[] {
  const detect: HybridPart = {
    where: "device",
    label: `On-device (${mode === "rules+nano" ? "Gemini Nano + rules" : "rules"})`,
    stages: "detect · pseudonymize · restore",
  };
  const reason: HybridPart =
    inferenceSource === "in_cloud"
      ? { where: "cloud", label: `Cloud (Gemini, ${cloudModel})`, stages: "reasoning only" }
      : { where: "device", label: `On-device (${cloudModel})`, stages: "reasoning" };
  return [detect, reason];
}

export function hybridSummaryText(parts: readonly HybridPart[]): string {
  return parts.map((p) => `${p.label}: ${p.stages}`).join(" — ");
}
