import { describe, expect, it } from "vitest";
import { detectRole } from "./roles.js";

const roleOf = (text: string, mention: string) => {
  const start = text.indexOf(mention);
  return detectRole(text, { start, end: start + mention.length });
};

describe("detectRole", () => {
  it.each([
    ["employed by Zenith Bank Plc (the Employer) as", "Zenith Bank Plc", "employer"],
    ['Ngozi Okafor (hereinafter referred to as "the Tenant")', "Ngozi Okafor", "tenant"],
    ["Ikenga Ltd, the Client, agrees", "Ikenga Ltd", "client"],
    ["served on the Defendant, Musa Garba, today", "Musa Garba", "defendant"],
    ["my client Chief Eze", "Chief Eze", "client"],
  ])("%s", (t, m, role) => {
    expect(roleOf(t, m)).toBe(role);
  });

  it("prefers the trailing parenthetical over a leading role", () => {
    expect(roleOf("my client, Chief Emeka Eze (the Landlord), says", "Chief Emeka Eze")).toBe("landlord");
  });

  it("returns undefined without an adjacent role", () => {
    expect(roleOf("Dear Barr. Nwosu,\n\nI act for the Employee", "Barr. Nwosu")).toBeUndefined();
  });
});
