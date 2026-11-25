import { describe, expect, it } from "vitest";
import { NANO_RESPONSE_SCHEMA, locateEntities, parseNanoEntities } from "./nano-parse.js";

describe("parseNanoEntities", () => {
  it("parses a clean array", () => {
    expect(parseNanoEntities('[{"text":"Kunle Ajayi","type":"PERSON"}]')).toEqual([{ text: "Kunle Ajayi", type: "PERSON" }]);
  });

  it("tolerates fences, prose and bad items", () => {
    const raw = 'Sure!\n```json\n[{"text":" Kunle ","type":"PERSON"},{"text":"Ikoyi","type":"LOCATION"},{"text":"x","type":"MONEY"},5,null]\n```';
    expect(parseNanoEntities(raw)).toEqual([{ text: "Kunle", type: "PERSON" }]);
  });

  it("returns [] for garbage", () => {
    expect(parseNanoEntities("no entities")).toEqual([]);
    expect(parseNanoEntities("[not json]")).toEqual([]);
  });
});

describe("locateEntities", () => {
  it("maps every whole-word occurrence to source offsets", () => {
    const chunk = { text: "Kunle met Kunle. Kunleye no.", offset: 100 };
    const spans = locateEntities(chunk, [{ text: "Kunle", type: "PERSON" }]);
    expect(spans.map((s) => [s.start, s.end, s.source])).toEqual([[100, 105, "nano"], [110, 115, "nano"]]);
  });

  it("drops role words, placeholders and lowercase junk", () => {
    const chunk = { text: "the Employer EMPLOYEE_1 and someone", offset: 0 };
    const spans = locateEntities(chunk, [
      { text: "Employer", type: "ORG" },
      { text: "EMPLOYEE_1", type: "PERSON" },
      { text: "someone", type: "PERSON" },
    ]);
    expect(spans).toEqual([]);
  });

  it("ignores entities not present in the text (hallucinations)", () => {
    expect(locateEntities({ text: "hello", offset: 0 }, [{ text: "Tinubu", type: "PERSON" }])).toEqual([]);
  });
});

describe("NANO_RESPONSE_SCHEMA", () => {
  it("allows only PERSON|ORG and bounds the reply size", () => {
    expect(NANO_RESPONSE_SCHEMA.items.properties.type.enum).toEqual(["PERSON", "ORG"]);
    expect(NANO_RESPONSE_SCHEMA.maxItems * NANO_RESPONSE_SCHEMA.items.properties.text.maxLength).toBeLessThanOrEqual(1000);
  });
});
