import { describe, expect, it } from "vitest";
import { detectAddresses, detectPlaces, isStateName, locationKind } from "./location.js";

const texts = (t: string) => detectPlaces(t).map((s) => s.text);

describe("detectPlaces", () => {
  it.each(["Lagos", "Ikeja", "Lekki", "Port Harcourt", "Yenagoa", "Warri", "Abuja", "Kano", "Ibadan", "Enugu", "Onitsha", "Victoria Island", "Benin City"])(
    "finds %s",
    (p) => {
      expect(texts(`based in ${p}, Nigeria`)).toEqual([p]);
    },
  );

  it("prefers 'X State' and multi-word names", () => {
    expect(texts("Yenagoa, Bayelsa State and Cross River")).toEqual(["Yenagoa", "Bayelsa State", "Cross River"]);
  });

  it("covers all 36 states + FCT as bare names or with 'State'", () => {
    const states = "Abia Adamawa Anambra Bauchi Bayelsa Benue Borno Delta Ebonyi Edo Ekiti Enugu Gombe Imo Jigawa Kaduna Kano Katsina Kebbi Kogi Kwara Lagos Nasarawa Niger Ogun Ondo Osun Oyo Plateau Rivers Sokoto Taraba Yobe Zamfara".split(" ");
    for (const s of [...states, "Akwa Ibom", "Cross River"]) expect(texts(`${s} State`), s).toEqual([`${s} State`]);
    expect(texts("FCT")).toEqual(["FCT"]);
  });

  it("ignores places inside other words and lowercase", () => {
    expect(texts("Ogunleye from lagos, Kanobi")).toEqual([]);
  });

  it("classifies states", () => {
    expect(isStateName("Bayelsa State")).toBe(true);
    expect(isStateName("Delta")).toBe(true);
    expect(isStateName("Kano")).toBe(false);
  });
});

describe("detectAddresses", () => {
  const addr = (t: string) => detectAddresses(t).map((s) => s.text);

  it.each([
    ["lives at 12 Adeola Odeku Street, Victoria Island", "12 Adeola Odeku Street"],
    ["the flat at Flat 3, Plot 5, Admiralty Way, Lekki", "Flat 3, Plot 5, Admiralty Way"],
    ["office: No. 7 Mbiama Road, Yenagoa", "No. 7 Mbiama Road"],
    ["Plot 14B is vacant", "Plot 14B"],
    ["at 3 Bourdillon Cres. Ikoyi", "3 Bourdillon Cres."],
  ])("%s", (t, want) => {
    expect(addr(t)).toEqual([want]);
  });

  it("ignores numbers that are not addresses", () => {
    expect(addr("within 30 days, on 5 November 2026 between parties")).toEqual([]);
  });
});

describe("locationKind", () => {
  it.each([
    ["12 Adeola Odeku Street", "ADDRESS"],
    ["Plot 5", "ADDRESS"],
    ["Bayelsa State", "STATE_NG"],
    ["FCT", "STATE_NG"],
    ["Lekki", "CITY_NG"],
  ])("%s → %s", (t, k) => {
    expect(locationKind(t)).toBe(k);
  });
});
