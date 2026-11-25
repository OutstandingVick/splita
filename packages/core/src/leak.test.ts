import { describe, expect, it } from "vitest";
import { assertNoLeak, IdentityLeakError } from "./leak.js";
import type { Mapping } from "./types.js";

const mapping: Mapping = {
  PERSON_1: { id: "e", type: "PERSON", canonical: "Ngozi Okafor", aliases: ["Ngozi Okafor", "Ngozi"], placeholder: "PERSON_1" },
};

describe("assertNoLeak", () => {
  it("passes when no alias remains", () => {
    expect(() => assertNoLeak("PERSON_1 paid.", mapping)).not.toThrow();
  });

  it("throws on any surviving alias, case-insensitively", () => {
    expect(() => assertNoLeak("PERSON_1 aka NGOZI paid.", mapping)).toThrow(IdentityLeakError);
  });

  it("does not leak the value in the error message", () => {
    try {
      assertNoLeak("Ngozi", mapping);
    } catch (e) {
      expect(String(e)).not.toContain("Ngozi");
    }
  });

  it("ignores aliases embedded in longer words", () => {
    expect(() => assertNoLeak("Ngozis-are-fine? no: PERSON_1", { PERSON_1: { ...mapping.PERSON_1!, aliases: ["Ngozi"] } })).not.toThrow();
  });
});
