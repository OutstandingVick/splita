import { describe, expect, it } from "vitest";
import { dropPublicTerms, findPublicTerms, isPublicTerm } from "./public-terms.js";
import type { Span } from "./types.js";

const span = (text: string, start: number, type: Span["type"] = "ORG", source: Span["source"] = "nano"): Span => ({
  start, end: start + text.length, text, type, confidence: 0.7, source,
});

describe("public terms", () => {
  it.each(["National Industrial Court", "Supreme Court", "High Court", "CBN", "NDPC", "EFCC", "FIRS", "Labour Act", "NDPA 2023", "Labour Act, 2004"])(
    "%s is public",
    (t) => expect(isPublicTerm(t)).toBe(true),
  );

  it.each(["Zenith Bank Plc", "Adebayo Ogunleye", "Lagos", "SECURE Ltd", "CBNX"])("%s is not public", (t) => expect(isPublicTerm(t)).toBe(false));

  it("matches whole words only, longest first", () => {
    const text = "Filed at the National Industrial Court; CBNX is not CBN.";
    expect(findPublicTerms(text).map((t) => t.text)).toEqual(["National Industrial Court", "CBN"]);
  });

  it("drops spans equal to or inside a public term and keeps real entities", () => {
    const text = "Zenith Bank Plc breached the Lagos State Tenancy Law 2011 at the High Court.";
    const spans = [
      span("Zenith Bank Plc", 0, "ORG", "rules"),
      span("Lagos State", 29, "LOCATION", "rules"),
      span("High Court", 65),
    ];
    expect(dropPublicTerms(spans, text).map((s) => s.text)).toEqual(["Zenith Bank Plc"]);
  });

  it("keeps a span that only overlaps part of a public term", () => {
    const text = "Contact CBN Holdings Ltd today.";
    expect(dropPublicTerms([span("CBN Holdings Ltd", 8)], text)).toHaveLength(1);
  });
});
