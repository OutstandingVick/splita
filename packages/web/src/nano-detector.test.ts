import { describe, expect, it, vi } from "vitest";
import { NanoDetector, type NanoPrompter, nanoPrompt } from "./nano-detector.js";

type Fake = NanoPrompter & { prompts: string[]; readies: number };
const fake = (reply: string | ((p: string) => string), opts: { delayMs?: number; availability?: string } = {}): Fake => {
  const f: Fake = {
    prompts: [],
    readies: 0,
    warm: false,
    availability: async () => opts.availability ?? "available",
    async ready() {
      f.readies++;
      f.warm = true;
    },
    async prompt(p) {
      f.prompts.push(p);
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      return typeof reply === "string" ? reply : reply(p);
    },
  };
  return f;
};

describe("NanoDetector", () => {
  it("returns nano spans in source coordinates and becomes ready", async () => {
    const d = new NanoDetector(fake('[{"text":"Kunle Ajayi","type":"PERSON"}]'));
    const spans = await d.detect("We met Kunle Ajayi.");
    expect(spans).toEqual([{ start: 7, end: 18, text: "Kunle Ajayi", type: "PERSON", confidence: 0.7, source: "nano" }]);
    expect(d.status).toBe("ready");
  });

  it("prompts once per chunk and offsets later chunks", async () => {
    const s = fake((p) => (p.includes("Kunle") ? '[{"text":"Kunle","type":"PERSON"}]' : "[]"));
    const text = `${"a".repeat(40)}\n\nPaid Kunle.`;
    const [span] = await new NanoDetector(s, { chunkChars: 45 }).detect(text);
    expect(s.prompts).toHaveLength(2);
    expect(text.slice(span?.start, span?.end)).toBe("Kunle");
  });

  it("prompts at most two chunks at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const s = fake("[]");
    s.prompt = async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return "[]";
    };
    await new NanoDetector(s, { chunkChars: 10 }).detect(["aaaa", "bbbb", "cccc", "dddd", "eeee"].join("\n\n"));
    expect(peak).toBe(2);
  });

  it("lists the rule-found names in each chunk's prompt", async () => {
    const s = fake("[]");
    const text = "Mr. Adebayo Ogunleye paid Kunle Ajayi in Lagos.";
    await new NanoDetector(s).detect(text, [
      { start: 0, end: 20, text: "Mr. Adebayo Ogunleye", type: "PERSON", confidence: 1, source: "rules" },
      { start: 41, end: 46, text: "Lagos", type: "LOCATION", confidence: 1, source: "rules" },
    ]);
    expect(s.prompts[0]).toContain('ALREADY FOUND: ["Mr. Adebayo Ogunleye"]');
    expect(s.prompts[0]).not.toContain("LOCATION");
  });

  it("is unavailable (and never prompts) when the Prompt API is not available", async () => {
    const s = fake("[]", { availability: "downloadable" });
    const d = new NanoDetector(s);
    expect(await d.detect("x")).toEqual([]);
    expect(d.status).toBe("unavailable");
    expect(s.prompts).toEqual([]);
  });

  it("times out to [] with status timeout", async () => {
    vi.useFakeTimers();
    const d = new NanoDetector(fake("[]", { delayMs: 60_000 }), { timeoutMs: 20_000 });
    const p = d.detect("Kunle");
    await vi.advanceTimersByTimeAsync(20_001);
    expect(await p).toEqual([]);
    expect(d.status).toBe("timeout");
    vi.useRealTimers();
  });

  it("never throws past the detector", async () => {
    const broken = { ...fake("[]"), prompt: () => Promise.reject(new Error("InvalidStateError: session destroyed")) };
    const d = new NanoDetector(broken);
    await expect(d.detect("x")).resolves.toEqual([]);
    expect(d.status).toBe("error");
    expect(d.lastError).toContain("InvalidStateError");
  });
});

describe("NanoDetector.warmUp", () => {
  it("creates the base session without prompting and reports ready", async () => {
    const s = fake("[]");
    expect(await new NanoDetector(s).warmUp()).toBe("ready");
    expect(s.readies).toBe(1);
    expect(s.prompts).toEqual([]);
  });

  it("reports unavailable without creating a session", async () => {
    const s = fake("[]", { availability: "unavailable" });
    expect(await new NanoDetector(s).warmUp()).toBe("unavailable");
    expect(s.readies).toBe(0);
  });

  it("surfaces the create error", async () => {
    const s = { ...fake("[]"), ready: () => Promise.reject(new Error("NotSupportedError: bad expectedOutputs")) };
    const d = new NanoDetector(s);
    expect(await d.warmUp()).toBe("error");
    expect(d.lastError).toBe("Error: NotSupportedError: bad expectedOutputs");
  });
});

describe("nanoPrompt", () => {
  it("asks only for PERSON and ORG", () => {
    const p = nanoPrompt("x");
    expect(p).toContain("PERSON name and ORG");
    expect(p).toContain("ALREADY FOUND: []");
  });
});
