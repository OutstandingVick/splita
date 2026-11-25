import type { Span } from "../types.js";
import { makeSpan, type Rule } from "./match.js";

/** States whose name is not also a city we list (bare mention ⇒ state). */
const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi",
  "Edo", "Ekiti", "Imo", "Jigawa", "Kebbi", "Kogi", "Kwara", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Taraba", "Yobe", "Zamfara", "FCT", "Federal Capital Territory",
];

/** State capitals (including those sharing a state's name) and major cities/towns/districts. */
const CITIES = [
  "Umuahia", "Yola", "Uyo", "Awka", "Bauchi", "Yenagoa", "Makurdi", "Maiduguri", "Calabar", "Asaba",
  "Abakaliki", "Benin City", "Ado-Ekiti", "Enugu", "Gombe", "Owerri", "Dutse", "Kaduna", "Kano", "Katsina",
  "Birnin Kebbi", "Lokoja", "Ilorin", "Ikeja", "Lafia", "Minna", "Abeokuta", "Akure", "Osogbo", "Ibadan",
  "Jos", "Port Harcourt", "Sokoto", "Jalingo", "Damaturu", "Gusau", "Abuja", "Lagos", "Lekki",
  "Victoria Island", "Ikoyi", "Yaba", "Surulere", "Ajah", "Apapa", "Festac", "Ikorodu", "Badagry", "Epe",
  "Warri", "Effurun", "Ughelli", "Sapele", "Onitsha", "Nnewi", "Aba", "Nsukka", "Zaria", "Ogbomoso",
  "Ile-Ife", "Ijebu-Ode", "Sagamu", "Ota", "Bonny", "Okrika", "Garki", "Wuse", "Maitama", "Asokoro",
  "Gwarinpa", "Kubwa", "Benin",
];

const alt = (xs: readonly string[]) =>
  [...xs].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")).join("|");

const PLACE = new RegExp(`(?<![A-Za-z-])(?:(?:${alt([...STATES, ...CITIES])}) State|${alt(CITIES)}|${alt(STATES)})(?![A-Za-z-])`, "g");

const STATE_SET = new Set(STATES);

/** Nigerian states, FCT, capitals and major cities. "Kano State" ⇒ state, bare "Kano" ⇒ city. */
export const detectPlaces: Rule = (text) => {
  const out: Span[] = [];
  for (const m of text.matchAll(PLACE)) {
    if (m.index !== undefined) out.push(makeSpan(text, m.index, m.index + m[0].length, "LOCATION", 0.85));
  }
  return out;
};

export type LocationKind = "STATE_NG" | "CITY_NG" | "ADDRESS";

export function isStateName(text: string): boolean {
  return / State$/.test(text) || STATE_SET.has(text);
}
