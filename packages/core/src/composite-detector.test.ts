import { describe, expect, it } from "vitest";
import { CompositeDetector, type DetectorStatus, type OptionalDetector } from "./composite-detector.js";
import { RulesDetector } from "./rules-detector.js";
import type { Span } from "./types.js";

const nanoSpan = (text: string, start: number, type: Span["type"] = "PERSON"): Span => ({
  start, end: start + text.length, text, type, confidence: 0.7, source: "nano",
});

function fakeNano(spans: Span[], status: DetectorStatus, fail = false): OptionalDetector {
  return {
    status,
    detect: () => (fail ? Promise.reject(new Error("boom")) : Promise.resolve(spans)),
  };
}

const TEXT = "Mr. Adebayo Ogunleye met Kunle Ajayi at Zenith Bank Plc.";

describe("CompositeDetector", () => {
  it("passes the rule-found spans to the optional detector", async () => {
    let known: readonly Span[] | undefined;
    const nano: OptionalDetector = {
      status: "ready",
      detect: async (_text, k) => {
        known = k;
        return [];
      },
    };
    await new CompositeDetector(new RulesDetector(), nano).detect(TEXT);
    expect(known?.map((s) => s.text)).toEqual(["Mr. Adebayo Ogunleye", "Zenith Bank Plc"]);
  });

  it("adds nano-only entities in rules+nano mode", async () => {
    const d = new CompositeDetector(new RulesDetector(), fakeNano([nanoSpan("Kunle Ajayi", 25)], "ready"));
    const spans = await d.detect(TEXT);
    expect(spans.map((s) => [s.text, s.source])).toEqual([
      ["Mr. Adebayo Ogunleye", "rules"],
      ["Kunle Ajayi", "nano"],
      ["Zenith Bank Plc", "rules"],
    ]);
    expect(d.lastMode).toBe("rules+nano");
  });

  it("rules win ties with nano", async () => {
    const d = new CompositeDetector(new RulesDetector(), fakeNano([nanoSpan("Zenith Bank Plc", 40, "ORG")], "ready"));
    const zenith = (await d.detect(TEXT)).find((s) => s.text === "Zenith Bank Plc");
    expect(zenith?.source).toBe("rules");
  });

  it("longer nano span beats a shorter rules span", async () => {
    const d = new CompositeDetector(new RulesDetector(), fakeNano([nanoSpan("Mr. Adebayo Ogunleye met", 0)], "ready"));
    expect((await d.detect(TEXT))[0]?.source).toBe("nano");
  });

  it.each<DetectorStatus>(["unavailable", "timeout", "error"])("degrades to rules-only when nano is %s", async (status) => {
    const d = new CompositeDetector(new RulesDetector(), fakeNano([nanoSpan("Kunle Ajayi", 25)], status));
    const spans = await d.detect(TEXT);
    expect(spans.every((s) => s.source === "rules")).toBe(true);
    expect(d.lastMode).toBe("rules-only");
  });

  it("survives a nano detector that throws", async () => {
    const d = new CompositeDetector(new RulesDetector(), fakeNano([], "ready", true));
    expect((await d.detect(TEXT)).length).toBe(2);
  });

  it("works with no optional detector", async () => {
    const d = new CompositeDetector(new RulesDetector());
    expect((await d.detect(TEXT)).length).toBe(2);
    expect(d.lastMode).toBe("rules-only");
  });
});
