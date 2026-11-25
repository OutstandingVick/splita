import { describe, expect, it } from "vitest";
import { detectEmails } from "./email.js";

const texts = (t: string) => detectEmails(t).map((s) => s.text);

describe("detectEmails", () => {
  it("finds emails, including multi-part TLDs", () => {
    expect(texts("Mail adebayo.ogunleye@gmail.com or legal@ikenga.com.ng.")).toEqual([
      "adebayo.ogunleye@gmail.com",
      "legal@ikenga.com.ng",
    ]);
  });

  it("ignores bare @handles", () => {
    expect(texts("ping @ngozi on X")).toEqual([]);
  });
});
