import { describe, expect, it } from "vitest";
import { restorePartial, safeStreamPrefix } from "./stream-restore.js";
import type { Mapping } from "./types.js";

const mapping: Mapping = {
  EMPLOYEE_1: { id: "e1", type: "PERSON", role: "employee", canonical: "Mr. Adebayo Ogunleye", aliases: ["Mr. Adebayo Ogunleye"], placeholder: "EMPLOYEE_1" },
};

describe("streaming restore", () => {
  it("holds back a trailing partial placeholder", () => {
    expect(safeStreamPrefix("Yes, EMPLOY")).toBe("Yes, ");
    expect(safeStreamPrefix("Yes, EMPLOYEE_")).toBe("Yes, ");
    expect(safeStreamPrefix("Yes, EMPLOYEE_1")).toBe("Yes, ");
    expect(safeStreamPrefix("Yes, EMPLOYEE_1 has")).toBe("Yes, EMPLOYEE_1 has");
  });

  it("restores only placeholders that are fully received", () => {
    expect(restorePartial("Yes, EMPLOYEE_1 has a claim against EMPLO", mapping)).toBe("Yes, Mr. Adebayo Ogunleye has a claim against ");
  });

  it("never emits a partial real value for an unknown or partial token", () => {
    expect(restorePartial("Pay EMPLOYEE_", mapping)).toBe("Pay ");
  });
});
