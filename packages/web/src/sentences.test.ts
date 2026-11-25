import { describe, expect, it } from "vitest";
import { batchSentences, splitSentences } from "./sentences.js";

describe("splitSentences", () => {
  it("splits on sentence ends and lines, not on titles", () => {
    const text = "Dear Barr. Nwosu,\n\nI act for Mr. Adebayo Ogunleye. He was fired! Why?\nYours faithfully";
    const out = splitSentences(text);
    expect(out.map((s) => s.text)).toEqual(["Dear Barr. Nwosu,", "I act for Mr. Adebayo Ogunleye.", "He was fired!", "Why?", "Yours faithfully"]);
    for (const s of out) expect(text.slice(s.offset, s.offset + s.text.length)).toBe(s.text);
  });
});

describe("batchSentences", () => {
  it("packs sentences up to the size cap", () => {
    const s = (t: string) => ({ text: t, offset: 0 });
    expect(batchSentences([s("aaaa"), s("bbbb"), s("cccc")], 9).map((b) => b.length)).toEqual([2, 1]);
  });
});
