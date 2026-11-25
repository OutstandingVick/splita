import type { StageEvent } from "@splita/core";
import { describe, expect, it } from "vitest";
import { applyStage, cloudStatusText, initialProgress, markSkipped, previewProgress } from "./pipeline-progress";

const run = (events: StageEvent[]) => events.reduce(applyStage, initialProgress());

describe("pipeline progress", () => {
  it("folds resolve into pseudonymize and keeps verify separate", () => {
    const p = run([
      { stage: "detect", phase: "start" },
      { stage: "detect", phase: "done", ms: 40 },
      { stage: "resolve", phase: "start" },
      { stage: "resolve", phase: "done", ms: 3 },
      { stage: "pseudonymize", phase: "start" },
      { stage: "verify", phase: "start" },
      { stage: "verify", phase: "done", ms: 1 },
      { stage: "pseudonymize", phase: "done", ms: 3 },
      { stage: "reason", phase: "start" },
    ]);
    expect(p.steps.detect).toEqual({ status: "done", ms: 40 });
    expect(p.steps.pseudonymize).toEqual({ status: "done", ms: 5 });
    expect(p.steps.verify).toEqual({ status: "done", ms: 1 });
    expect(p.steps.reason.status).toBe("active");
  });

  it("marks steps after a failure as skipped", () => {
    const p = markSkipped(run([{ stage: "detect", phase: "done", ms: 1 }, { stage: "reason", phase: "error" }]));
    expect(p.steps.reason.status).toBe("error");
    expect(p.steps.restore.status).toBe("skipped");
    expect(p.steps.receipt.status).toBe("skipped");
  });

  it("describes cloud retries", () => {
    expect(cloudStatusText({ attempt: 1, model: "m" })).toBe("Asking m…");
    expect(cloudStatusText({ attempt: 3, model: "m", retryAfter: "rate-limit" })).toBe("Retry 2 on m (rate limited)…");
  });

  it("shows an offline preview as on-device steps done and the rest skipped", () => {
    const p = previewProgress();
    expect(p.steps.verify.status).toBe("done");
    expect(p.steps.reason.status).toBe("skipped");
  });
});
