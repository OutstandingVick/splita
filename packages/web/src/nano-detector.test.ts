import { describe, expect, it, vi } from "vitest";
import { NanoDetector, type TextModel } from "./nano-detector.js";

const model = (reply: string | ((p: string) => string), delayMs = 0): TextModel & { prompts: string[] } => {
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
const available = () => Promise.resolve("available");

describe("NanoDetector", () => {
  it("returns nano spans in source coordinates and becomes ready", async () => {
    const d = new NanoDetector(model('[{"text":"Kunle Ajayi","type":"PERSON"}]'), { availability: available });
    const spans = await d.detect("We met Kunle Ajayi.");
    expect(spans).toEqual([{ start: 7, end: 18, text: "Kunle Ajayi", type: "PERSON", confidence: 0.7, source: "nano" }]);
    expect(d.status).toBe("ready");
  });

  it("prompts once per chunk and offsets later chunks", async () => {
    const m = model((p) => (p.includes("Ikoyi") ? '[{"text":"Ikoyi","type":"LOCATION"}]' : "[]"));
    const text = `${"a".repeat(40)}\n\nMoved to Ikoyi.`;
    const d = new NanoDetector(m, { availability: available, chunkChars: 45 });
    const [span] = await d.detect(text);
    expect(m.prompts).toHaveLength(2);
    expect(text.slice(span?.start, span?.end)).toBe("Ikoyi");
  });

  it("is unavailable (and never prompts) when the Prompt API is not available", async () => {
    const m = model("[]");
    const d = new NanoDetector(m, { availability: () => Promise.resolve("downloadable") });
    expect(await d.detect("x")).toEqual([]);
    expect(d.status).toBe("unavailable");
    expect(m.prompts).toEqual([]);
  });

  it("times out to [] with status timeout", async () => {
    vi.useFakeTimers();
    const d = new NanoDetector(model("[]", 60_000), { availability: available, timeoutMs: 20_000 });
    const p = d.detect("Kunle");
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await p).toEqual([]);
    expect(d.status).toBe("timeout");
    vi.useRealTimers();
  });

  it("never throws past the detector", async () => {
    const broken: TextModel = { generateContent: () => Promise.reject(new Error("AI/unsupported")) };
    const d = new NanoDetector(broken, { availability: available });
    await expect(d.detect("x")).resolves.toEqual([]);
    expect(d.status).toBe("error");
    expect(d.lastError).toContain("AI/unsupported");
  });

  it("treats a missing LanguageModel global as unavailable", async () => {
    const d = new NanoDetector(model("[]"));
    expect(await d.detect("x")).toEqual([]);
    expect(d.status).toBe("unavailable");
  });
});

describe("NanoDetector.warmUp", () => {
  it("sends one trivial prompt and reports ready", async () => {
    const m = model("[]");
    const d = new NanoDetector(m, { availability: available });
    expect(await d.warmUp()).toBe("ready");
    expect(m.prompts).toHaveLength(1);
  });

  it("reports unavailable without prompting", async () => {
    const m = model("[]");
    expect(await new NanoDetector(m, { availability: () => Promise.resolve("unavailable") }).warmUp()).toBe("unavailable");
    expect(m.prompts).toEqual([]);
  });
});
