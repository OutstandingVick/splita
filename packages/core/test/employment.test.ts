import { describe, expect, it } from "vitest";
import type { DetectorPort } from "../src/ports.js";
import { fixtureSuite, runFixture } from "./fixture-suite.js";
import { employmentDispute } from "./fixtures/employment.js";

describe("fixture: employment contract dispute", () => {
  fixtureSuite({
    text: employmentDispute,
    placeholders: {
      "Mr. Adebayo Ogunleye": "EMPLOYEE_1",
      "Mr. Ogunleye": "EMPLOYEE_1",
      Adebayo: "EMPLOYEE_1",
      "Zenith Bank Plc": "EMPLOYER_1",
      "Barr. Chukwuemeka Nwosu": "PERSON_1",
      "Mrs. Funmilayo Bello": "PERSON_2",
      "₦850,000": "AMOUNT_NGN_MID_1",
      "N12.5m": "AMOUNT_NGN_LARGE_1",
      "₦75k": "AMOUNT_NGN_SMALL_1",
      "400,000 naira": "AMOUNT_NGN_MID_2",
      "14/06/1988": "DOB_1",
      "+234 803 123 4567": "PHONE_1",
      "adebayo.ogunleye@gmail.com": "EMAIL_1",
      "0123456789": "ACCOUNT_1",
      "12 Adeola Odeku Street": "ADDRESS_1",
      "Victoria Island": "CITY_NG_1",
      Lagos: "CITY_NG_2",
    },
    secrets: ["Ogunleye", "Zenith", "Nwosu", "Funmilayo", "1988", "4567", "Adeola Odeku", "Victoria Island", "Lagos"],
  });

  it("keeps public institutions visible even when a detector flags them", async () => {
    const court = "National Industrial Court";
    const overEager: DetectorPort = {
      detect: async (text) => {
        const start = text.indexOf(court);
        return [{ start, end: start + court.length, text: court, type: "ORG", confidence: 0.7, source: "nano" }];
      },
    };
    const { result } = await runFixture(employmentDispute, [overEager]);
    expect(result.cloudView.anonymizedText).toContain(court);
  });

  it("describes each placeholder by type and detector, never by value", async () => {
    const { result } = await runFixture(employmentDispute);
    const info = result.cloudView.placeholders;
    expect(info.find((p) => p.placeholder === "EMPLOYEE_1")).toEqual({ placeholder: "EMPLOYEE_1", type: "PERSON", role: "employee", sources: ["rules"] });
    expect(JSON.stringify(info)).not.toMatch(/Ogunleye|Zenith|Lagos|0123456789/);
  });

  it("records stage timings as whole milliseconds", async () => {
    const { result } = await runFixture(employmentDispute);
    for (const ms of Object.values(result.receipt.timings)) expect(Number.isInteger(ms)).toBe(true);
  });

  it("anonymized output matches the reviewed snapshot", async () => {
    const { result } = await runFixture(employmentDispute);
    expect(result.cloudView.anonymizedText).toMatchSnapshot();
  });
});
