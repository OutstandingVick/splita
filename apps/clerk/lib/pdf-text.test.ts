import { describe, expect, it } from "vitest";
import { joinItems, summarizePages } from "./pdf-text";

describe("joinItems", () => {
  it("keeps line breaks and collapses spacing", () => {
    expect(joinItems([{ str: "RE:  WRONGFUL", hasEOL: false }, { str: " TERMINATION", hasEOL: true }, { str: "Dear Barr. Nwosu," }, {}])).toBe(
      "RE: WRONGFUL TERMINATION\nDear Barr. Nwosu,",
    );
  });
});

describe("summarizePages", () => {
  it("counts pages and flags a PDF with no text layer as scanned", () => {
    expect(summarizePages(["", " ", ""])).toMatchObject({ pages: 3, emptyPages: 3, scanned: true });
  });

  it("joins text pages and counts image-only pages without calling it scanned", () => {
    const r = summarizePages(["Page one has plenty of real text in it.", ""]);
    expect(r).toMatchObject({ pages: 2, emptyPages: 1, scanned: false, text: "Page one has plenty of real text in it." });
  });
});
