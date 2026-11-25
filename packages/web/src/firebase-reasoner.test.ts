import { describe, expect, it } from "vitest";
import { type CloudModel, errorStatus, FirebaseReasoner, REASONER_SYSTEM_INSTRUCTION, withJitter } from "./firebase-reasoner.js";

const httpError = (status: number) =>
  Object.assign(new Error(`AI: Error fetching from https://x: [${status} Err] boom (AI/fetch-error)`), { customErrorData: { status } });

/** Fails with each given status in turn, then answers. */
const flaky = (statuses: number[]): CloudModel & { calls: number } => {
  const m = {
    calls: 0,
    async generateContent() {
      const status = statuses[m.calls++];
      if (status) throw httpError(status);
      return { response: { text: () => "ok", inferenceSource: "in_cloud" as const } };
    },
  };
  return m;
};

describe("FirebaseReasoner", () => {
  it("returns text, the reported inference source and latency", async () => {
    let t = 1000;
    const prompts: string[] = [];
    const r = new FirebaseReasoner(
      {
        async generateContent(p) {
          prompts.push(p);
          t += 250;
          return { response: { text: () => "EMPLOYER_1 must pay.", inferenceSource: "in_cloud" } };
        },
      },
      () => t,
    );
    expect(await r.reason("Does EMPLOYER_1 owe?")).toEqual({ text: "EMPLOYER_1 must pay.", source: "in_cloud", latencyMs: 250, attempts: 1 });
    expect(prompts).toEqual(["Does EMPLOYER_1 owe?"]);
  });

  it("defaults the source to in_cloud when the SDK omits it", async () => {
    const r = new FirebaseReasoner({ generateContent: async () => ({ response: { text: () => "ok" } }) });
    expect((await r.reason("x")).source).toBe("in_cloud");
  });

  it("instructs the model to keep placeholders verbatim", () => {
    expect(REASONER_SYSTEM_INSTRUCTION).toMatch(/Copy every token exactly as written/);
    for (const section of ["Legal basis", "Amounts", "Next steps", "Confirm with a lawyer"]) {
      expect(REASONER_SYSTEM_INSTRUCTION).toContain(section);
    }
    expect(REASONER_SYSTEM_INSTRUCTION).toMatch(/Never guess/);
  });
});

describe("FirebaseReasoner retries", () => {
  const opts = (sleeps: number[]) => ({ sleep: async (ms: number) => void sleeps.push(ms), random: () => 0.5 });

  it("retries 429/500/503 with exponential backoff", async () => {
    const sleeps: number[] = [];
    const m = flaky([503, 429]);
    const r = await new FirebaseReasoner(m, opts(sleeps)).reason("x");
    expect(r.attempts).toBe(3);
    expect(sleeps).toEqual([1000, 2000]);
  });

  it("gives up after the last retry and rethrows", async () => {
    const m = flaky([500, 500, 500]);
    await expect(new FirebaseReasoner(m, opts([])).reason("x")).rejects.toThrow("[500");
    expect(m.calls).toBe(3);
  });

  it("does not retry other errors", async () => {
    const m = flaky([400]);
    await expect(new FirebaseReasoner(m, opts([])).reason("x")).rejects.toThrow("[400");
    expect(m.calls).toBe(1);
  });

  it("reads the status from customErrorData or the message", () => {
    expect(errorStatus(httpError(429))).toBe(429);
    expect(errorStatus(new Error("Error fetching: [503 Service Unavailable]"))).toBe(503);
    expect(errorStatus(new Error("nope"))).toBeUndefined();
  });

  it("jitters within ±25%", () => {
    expect(withJitter(1000, () => 0)).toBe(750);
    expect(withJitter(1000, () => 1)).toBe(1250);
  });
});
