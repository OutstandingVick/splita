import { describe, expect, it } from "vitest";
import { detectDatesOfBirth } from "./dob.js";

const texts = (t: string) => detectDatesOfBirth(t).map((s) => s.text);

describe("detectDatesOfBirth", () => {
  it.each([
    ["He was born on 14/06/1988.", "14/06/1988"],
    ["Date of Birth: 3rd March, 1990", "3rd March, 1990"],
    ["DOB - June 5, 1975", "June 5, 1975"],
    ["d.o.b. 01-02-99", "01-02-99"],
  ])("%s", (t, want) => {
    expect(texts(t)).toEqual([want]);
  });

  it("only spans the date, not the context words", () => {
    const [s] = detectDatesOfBirth("born on 14/06/1988");
    expect(s).toMatchObject({ start: 8, end: 18 });
  });

  it("ignores dates without birth context", () => {
    expect(texts("Terminated on 3 October 2026, dated 01/01/2024.")).toEqual([]);
  });
});
