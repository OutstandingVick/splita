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

const STREET = "(?:(?:Street|Road|Avenue|Close|Crescent|Way|Drive|Lane|Estate|Boulevard|Expressway)\\b|(?:St|Rd|Ave|Cres)\\.)";
const WORDS = "(?:[A-Z][A-Za-z'-]*[ ]+){1,4}";
const FLAT = "(?:Flat[ ]+\\d+[A-Za-z]?,[ ]*)?";
const ADDRESS = new RegExp(
  `\\b${FLAT}(?:(?:No\\.?[ ]*)?\\d{1,4}[A-Za-z]?,?[ ]+${WORDS}${STREET}|Plot[ ]+\\d+[A-Za-z]?(?:,?[ ]+${WORDS}${STREET})?)`,
  "g",
);
const ADDRESS_START = /^(?:Flat|Plot|No\.?|\d)/;

/** Street addresses: "12 Adeola Odeku Street", "Plot 5, Admiralty Way", "Flat 3, Plot 5". */
export const detectAddresses: Rule = (text) => {
  const out: Span[] = [];
  for (const m of text.matchAll(ADDRESS)) {
    if (m.index !== undefined) out.push(makeSpan(text, m.index, m.index + m[0].length, "LOCATION", 0.9));
  }
  return out;
};

export function locationKind(text: string): LocationKind {
  if (ADDRESS_START.test(text)) return "ADDRESS";
  return isStateName(text) ? "STATE_NG" : "CITY_NG";
}
