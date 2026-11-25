import { describe, expect, it } from "vitest";
import { chunkText, locateEntities, parseNanoEntities } from "./nano-parse.js";

describe("chunkText", () => {
  it("keeps short text as one chunk", () => {
    expect(chunkText("a\n\nb")).toEqual([{ text: "a\n\nb", offset: 0 }]);
  });

  it("splits on paragraph boundaries and keeps offsets", () => {
    const text = `${"a".repeat(30)}\n\n${"b".repeat(30)}\n\n${"c".repeat(10)}`;
    const chunks = chunkText(text, 50);
    expect(chunks.map((c) => c.text)).toEqual(["a".repeat(30), `${"b".repeat(30)}\n\n${"c".repeat(10)}`]);
    for (const c of chunks) expect(text.slice(c.offset, c.offset + c.text.length)).toBe(c.text);
  });

  it("hard-splits a paragraph longer than the limit", () => {
    const chunks = chunkText("x".repeat(120), 50);
    expect(chunks.map((c) => [c.offset, c.text.length])).toEqual([[0, 50], [50, 50], [100, 20]]);
  });
});

describe("parseNanoEntities", () => {
  it("parses a clean array", () => {
    expect(parseNanoEntities('[{"text":"Kunle Ajayi","type":"PERSON"}]')).toEqual([{ text: "Kunle Ajayi", type: "PERSON" }]);
  });

  it("tolerates fences, prose and bad items", () => {
    const raw = 'Sure!\n```json\n[{"text":" Ikoyi ","type":"LOCATION"},{"text":"x","type":"MONEY"},5,null]\n```';
    expect(parseNanoEntities(raw)).toEqual([{ text: "Ikoyi", type: "LOCATION" }]);
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
