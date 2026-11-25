import { describe, expect, it } from "vitest";
import { matchKey, resolveEntities } from "./resolver.js";
import { RulesDetector } from "./rules-detector.js";
import type { Entity } from "./types.js";

async function resolve(text: string, existing: Entity[] = []) {
  const spans = await new RulesDetector().detect(text);
  const r = resolveEntities(text, spans, existing);
  const byId = new Map(r.entities.map((e) => [e.id, e]));
  const placeholderOf = (alias: string) => byId.get(r.mentions.find((m) => m.span.text === alias)?.entityId ?? "")?.placeholder;
  return { ...r, placeholderOf };
}

const TEXT =
  "Mr. Adebayo Ogunleye (the Employee) sued Zenith Bank Plc (the Employer). Adebayo says Mr. Ogunleye was owed ₦400k, i.e. 400,000 naira. Mrs. Funmilayo Bello and Aisha Bello witnessed.";

describe("resolveEntities", () => {
  it("links aliases of one person to one entity", async () => {
    const r = await resolve(TEXT);
    const p = r.placeholderOf("Mr. Adebayo Ogunleye");
    expect(p).toBe("EMPLOYEE_1");
    expect(r.placeholderOf("Adebayo")).toBe(p);
    expect(r.placeholderOf("Mr. Ogunleye")).toBe(p);
  });

  it("keeps people who only share a surname apart", async () => {
    const r = await resolve(TEXT);
    expect(r.placeholderOf("Mrs. Funmilayo Bello")).toBe("PERSON_1");
    expect(r.placeholderOf("Aisha Bello")).toBe("PERSON_2");
  });

  it("uses roles for orgs", async () => {
    expect((await resolve(TEXT)).placeholderOf("Zenith Bank Plc")).toBe("EMPLOYER_1");
  });

  it("merges equal money amounts written differently", async () => {
    const r = await resolve(TEXT);
    expect(r.placeholderOf("₦400k")).toBe("AMOUNT_NGN_MID_1");
    expect(r.placeholderOf("400,000 naira")).toBe("AMOUNT_NGN_MID_1");
  });

  it("canonical is the longest alias", async () => {
    const e = (await resolve(TEXT)).entities.find((x) => x.placeholder === "EMPLOYEE_1");
    expect(e?.canonical).toBe("Mr. Adebayo Ogunleye");
    expect(e?.aliases).toEqual(expect.arrayContaining(["Adebayo", "Mr. Ogunleye"]));
  });

  it("reuses vault entities across calls and continues numbering", async () => {
    const first = await resolve(TEXT);
    const second = await resolve("Mr. Ogunleye met Chief Emeka Eze.", first.entities);
    expect(second.placeholderOf("Mr. Ogunleye")).toBe("EMPLOYEE_1");
    expect(second.placeholderOf("Chief Emeka Eze")).toBe("PERSON_3");
  });

  it("does not mutate existing entities", async () => {
    const first = await resolve(TEXT);
    const before = JSON.stringify(first.entities);
    await resolve("Adebayo Ogunleye again", first.entities);
    expect(JSON.stringify(first.entities)).toBe(before);
  });
});

describe("matchKey", () => {
  it("normalizes phones, orgs and money", () => {
    expect(matchKey("PHONE", "+234 803 123 4567")).toBe(matchKey("PHONE", "08031234567"));
    expect(matchKey("ORG", "Zenith Bank Plc")).toBe(matchKey("ORG", "Zenith Bank"));
    expect(matchKey("MONEY", "₦1.2m")).toBe(matchKey("MONEY", "1,200,000 naira"));
  });
});
