import type { StageEvent } from "@splita/core";
import type { CloudAttempt } from "@splita/web";

/** Steps shown in the progress strip (resolve is folded into Pseudonymize). */
export const STEPS = [
  { id: "detect", label: "Detect", hint: "Rules + Gemini Nano, on device" },
  { id: "pseudonymize", label: "Pseudonymize", hint: "Swap identities for stand-ins" },
  { id: "verify", label: "Verify", hint: "Leak guard: no real value may remain" },
  { id: "reason", label: "Cloud", hint: "Gemini reasons on stand-ins only" },
  { id: "restore", label: "Restore", hint: "Real values back, on device" },
  { id: "receipt", label: "Receipt", hint: "Hash-chained proof of what was sent" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type StepStatus = "pending" | "active" | "done" | "error" | "skipped";

export interface Progress {
  steps: Record<StepId, { status: StepStatus; ms?: number }>;
  cloud: CloudAttempt | null;
}

export function initialProgress(): Progress {
  const steps = {} as Progress["steps"];
  for (const s of STEPS) steps[s.id] = { status: "pending" };
  return { steps, cloud: null };
}

const set = (p: Progress, id: StepId, v: Progress["steps"][StepId]): Progress => ({ ...p, steps: { ...p.steps, [id]: v } });

/** Folds a pipeline event into the strip. `resolve` counts toward Pseudonymize; Verify's time is not double-counted. */
export function applyStage(p: Progress, e: StageEvent): Progress {
  switch (e.stage) {
    case "resolve":
      if (e.phase === "start") return set(p, "pseudonymize", { status: "active" });
      if (e.phase === "done") return set(p, "pseudonymize", { status: "active", ms: e.ms });
      return set(p, "pseudonymize", { status: "error" });
    case "pseudonymize":
      if (e.phase === "start") return p;
      if (e.phase === "done") {
        const own = e.ms - (p.steps.verify.ms ?? 0);
        return set(p, "pseudonymize", { status: "done", ms: (p.steps.pseudonymize.ms ?? 0) + Math.max(0, own) });
      }
      return set(p, p.steps.verify.status === "active" ? "verify" : "pseudonymize", { status: "error" });
    case "verify":
      if (e.phase === "start") return set(set(p, "pseudonymize", { ...p.steps.pseudonymize, status: "done" }), "verify", { status: "active" });
      return set(p, "verify", e.phase === "done" ? { status: "done", ms: e.ms } : { status: "error" });
    default: {
      const id = e.stage as StepId;
      if (e.phase === "start") return set(p, id, { status: "active" });
      return set(p, id, e.phase === "done" ? { status: "done", ms: e.ms } : { status: "error" });
    }
  }
}

export function applyCloudAttempt(p: Progress, a: CloudAttempt): Progress {
  return { ...p, cloud: a };
}

/** After a fail-closed error, later steps never ran. */
export function markSkipped(p: Progress): Progress {
  const failed = STEPS.findIndex((s) => p.steps[s.id].status === "error");
  if (failed < 0) return p;
  let out = p;
  for (const s of STEPS.slice(failed + 1)) out = set(out, s.id, { status: "skipped" });
  return out;
}

export function cloudStatusText(a: CloudAttempt | null): string | null {
  if (!a) return null;
  if (a.attempt === 1) return `Asking ${a.model}…`;
  const why = { "rate-limit": "rate limited", "server-error": "server busy", timeout: "slow response", unavailable: "model unavailable" }[
    a.retryAfter ?? "server-error"
  ];
  return `Retry ${a.attempt - 1} on ${a.model} (${why})…`;
}
