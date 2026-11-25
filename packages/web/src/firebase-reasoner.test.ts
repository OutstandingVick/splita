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
    expect(await r.reason("Does EMPLOYER_1 owe?")).toEqual({ text: "EMPLOYER_1 must pay.", source: "in_cloud", latencyMs: 250, attempts: 1, model: "gemini-3.5-flash-lite" });
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

describe("FirebaseReasoner fallback", () => {
  const base = (sleeps: number[]) => ({ sleep: async (ms: number) => void sleeps.push(ms), random: () => 0.5 });

  it("falls back to the second model with the same payload after retries run out", async () => {
    const sleeps: number[] = [];
    const primary = flaky([503, 503, 503]);
    const prompts: string[] = [];
    const fallback: CloudModel = {
      async generateContent(p) {
        prompts.push(p);
        return { response: { text: () => "EMPLOYER_1 owes.", inferenceSource: "in_cloud" } };
      },
    };
    const r = await new FirebaseReasoner(primary, { ...base(sleeps), fallback: { name: "gemini-2.5-flash", model: fallback } }).reason("anon");
    expect(r).toMatchObject({ text: "EMPLOYER_1 owes.", attempts: 4, model: "gemini-2.5-flash" });
    expect(prompts).toEqual(["anon"]);
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it("stays fail-closed when the fallback also fails", async () => {
    const r = new FirebaseReasoner(flaky([429, 429, 429]), { ...base([]), fallback: { name: "b", model: flaky([503]) } });
    await expect(r.reason("x")).rejects.toThrow("[503");
  });

  it("does not fall back on a bad request", async () => {
    const fb = flaky([]);
    await expect(new FirebaseReasoner(flaky([400]), { ...base([]), fallback: { name: "b", model: fb } }).reason("x")).rejects.toThrow("[400");
    expect(fb.calls).toBe(0);
  });
});
