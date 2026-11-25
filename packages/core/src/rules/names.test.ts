import { describe, expect, it } from "vitest";
import { isKnownName } from "./names.js";

describe("isKnownName", () => {
  it.each(["Adebayo", "Ngozi", "Abubakar", "Tamunosiki"])("knows %s", (n) => {
    expect(isKnownName(n)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isKnownName("OKAFOR")).toBe(true);
  });

  it("rejects ordinary words", () => {
    expect(isKnownName("Bank")).toBe(false);
  });
});
