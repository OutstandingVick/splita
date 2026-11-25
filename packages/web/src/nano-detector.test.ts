import { describe, expect, it, vi } from "vitest";
import { NanoDetector, nanoPrompt, type TextModel } from "./nano-detector.js";

type Fake = TextModel & { prompts: string[] };
const fake = (reply: string | ((p: string) => string), delayMs = 0): Fake => {
  const prompts: string[] = [];
  return {
    prompts,
    async generateContent(p) {
      prompts.push(p);
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const text = typeof reply === "string" ? reply : reply(p);
      return { response: { text: () => text } };
    },
  };
};
const failing = (err: unknown): TextModel => ({ generateContent: () => Promise.reject(err) });
const NOT_ENABLED = Object.assign(new Error("Local LanguageModel API not available in this environment."), {
  name: "FirebaseError",
  code: "AI/api-not-enabled",
});

describe("NanoDetector", () => {
  it("returns nano spans in source coordinates and becomes ready", async () => {
    const d = new NanoDetector(fake('[{"text":"Kunle Ajayi","type":"PERSON"}]'));
    expect(await d.detect("We met Kunle Ajayi.")).toEqual([
      { start: 7, end: 18, text: "Kunle Ajayi", type: "PERSON", confidence: 0.7, source: "nano" },
    ]);
    expect(d.status).toBe("ready");
  });

  it("prompts once per chunk, one after another, and offsets later chunks", async () => {
    const m = fake((p) => (p.includes("Paid Kunle") ? '[{"text":"Kunle","type":"PERSON"}]' : "[]"));
    const text = `Met Tobenna Okafor here.\n\nPaid Kunle.`;
    const [span] = await new NanoDetector(m, { chunkChars: 26 }).detect(text);
    expect(m.prompts).toHaveLength(2);
    expect(text.slice(span?.start, span?.end)).toBe("Kunle");
  });

  it("lists the rule-found names in each chunk's prompt", async () => {
    const m = fake("[]");
    await new NanoDetector(m).detect("Mr. Adebayo Ogunleye paid Kunle Ajayi in Lagos.", [
      { start: 0, end: 20, text: "Mr. Adebayo Ogunleye", type: "PERSON", confidence: 1, source: "rules" },
      { start: 41, end: 46, text: "Lagos", type: "LOCATION", confidence: 1, source: "rules" },
    ]);
    expect(m.prompts[0]).toContain('ALREADY FOUND: ["Mr. Adebayo Ogunleye"]');
  });

  it("skips the pass when rules already cover every name candidate", async () => {
    const m = fake("[]");
    const d = new NanoDetector(m);
    const spans = await d.detect("Paid Zenith Bank Plc on 3 October.", [
      { start: 5, end: 20, text: "Zenith Bank Plc", type: "ORG", confidence: 1, source: "rules" },
    ]);
    expect(spans).toEqual([]);
    expect(m.prompts).toEqual([]);
    expect(d.status).toBe("ready");
    expect(d.lastRun?.prompted).toBe(0);
  });

  it("maps Firebase api-not-enabled to unavailable", async () => {
    const d = new NanoDetector(failing(NOT_ENABLED));
    expect(await d.detect("Kunle")).toEqual([]);
    expect(d.status).toBe("unavailable");
  });

  it("times out to [] with status timeout", async () => {
    vi.useFakeTimers();
    const d = new NanoDetector(fake("[]", 60_000), { timeoutMs: 20_000 });
    const p = d.detect("Kunle");
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await p).toEqual([]);
    expect(d.status).toBe("timeout");
    vi.useRealTimers();
  });

  it("never throws past the detector", async () => {
    const d = new NanoDetector(failing(new Error("InvalidStateError: session destroyed")));
    await expect(d.detect("Kunle")).resolves.toEqual([]);
    expect(d.status).toBe("error");
    expect(d.lastError).toContain("InvalidStateError");
  });
});

describe("NanoDetector.lastRun", () => {
  it("marks the first run cold and later runs warm", async () => {
    let t = 0;
    const d = new NanoDetector(fake("[]"), { now: () => (t += 100) });
    await d.detect("Kunle");
    expect(d.lastRun).toEqual({ warm: false, ms: 100, chunks: 1, prompted: 1 });
    await d.detect("Kunle");
    expect(d.lastRun?.warm).toBe(true);
  });

  it("is undefined when Nano is unavailable", async () => {
    const d = new NanoDetector(failing(NOT_ENABLED));
    await d.detect("Kunle");
    expect(d.lastRun).toBeUndefined();
  });
});

describe("NanoDetector.warmUp", () => {
  it("sends one trivial prompt and reports ready", async () => {
    const m = fake("[]");
    expect(await new NanoDetector(m).warmUp()).toBe("ready");
    expect(m.prompts).toHaveLength(1);
  });

  it("is shared, and a detect started during warm-up waits for it", async () => {
    const order: string[] = [];
    const m: TextModel = {
      async generateContent(p) {
        const tag = p.includes("Warm-up.") ? "warm-up" : "detect";
        order.push(`${tag}:start`);
        await new Promise((r) => setTimeout(r, tag === "warm-up" ? 20 : 1));
        order.push(`${tag}:end`);
        return { response: { text: () => "[]" } };
      },
    };
    const d = new NanoDetector(m);
    const w1 = d.warmUp();
    expect(d.warmUp()).toBe(w1);
    await d.detect("Kunle");
    expect(order).toEqual(["warm-up:start", "warm-up:end", "detect:start", "detect:end"]);
    expect(d.lastRun?.warm).toBe(true);
  });

  it("surfaces the SDK error", async () => {
    const d = new NanoDetector(failing(new Error("NotSupportedError: bad expectedOutputs")));
    expect(await d.warmUp()).toBe("error");
    expect(d.lastError).toBe("Error: NotSupportedError: bad expectedOutputs");
  });
});

describe("nanoPrompt", () => {
  it("asks only for PERSON and ORG", () => {
    expect(nanoPrompt("x")).toContain("PERSON name and ORG");
  });
});
