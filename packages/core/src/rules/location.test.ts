import { describe, expect, it } from "vitest";
import { detectPlaces, isStateName } from "./location.js";

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
