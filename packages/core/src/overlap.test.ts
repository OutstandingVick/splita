import { describe, expect, it } from "vitest";
import { resolveOverlaps } from "./overlap.js";
import type { Span } from "./types.js";

const s = (start: number, end: number, confidence = 0.9, type: Span["type"] = "PERSON"): Span => ({
  start, end, text: "x".repeat(end - start), type, confidence, source: "rules",
});

describe("resolveOverlaps", () => {
  it("keeps the longest of overlapping spans", () => {
    expect(resolveOverlaps([s(4, 11), s(0, 11, 0.5)])).toEqual([s(0, 11, 0.5)]);
  });

  it("breaks length ties by confidence", () => {
    expect(resolveOverlaps([s(0, 5, 0.6), s(2, 7, 0.9)])).toEqual([s(2, 7, 0.9)]);
  });

  it("keeps adjacent spans and sorts by start", () => {
    expect(resolveOverlaps([s(5, 8), s(0, 5)])).toEqual([s(0, 5), s(5, 8)]);
  });

  it("does not mutate input", () => {
    const input = [s(5, 8), s(0, 5)];
    resolveOverlaps(input);
    expect(input[0]?.start).toBe(5);
  });
});
