import type { DetectionMode, InferenceSource } from "@splita/core";
import { hybridSummary } from "@/lib/hybrid-summary";

export function HybridLine({ mode, inferenceSource, cloudModel }: { mode: DetectionMode; inferenceSource: InferenceSource; cloudModel: string }) {
  const parts = hybridSummary(mode, inferenceSource, cloudModel);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-600" data-testid="hybrid-line">
      {parts.map((p, i) => (
        <span key={p.label} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-stone-300">—</span>}
          <span className={`h-2 w-2 rounded-full ${p.where === "device" ? "bg-accent-600" : "bg-sky-500"}`} aria-hidden />
          <span>
            <strong className="font-medium text-stone-800">{p.label}:</strong> {p.stages}
          </span>
        </span>
      ))}
    </p>
  );
}
