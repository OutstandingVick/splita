import { moneyPlaceholderPrefix } from "./money.js";
import { locationKind } from "./rules/location.js";
import type { Entity, EntityType } from "./types.js";

const TYPE_PREFIX: Record<EntityType, string> = {
  PERSON: "PERSON",
  ORG: "ORG",
  MONEY: "AMOUNT",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  ACCOUNT_NUMBER: "ACCOUNT",
  LOCATION: "LOCATION",
  DATE_OF_BIRTH: "DOB",
};

/** EMPLOYER / TENANT for role-tagged people and orgs, AMOUNT_NGN_MID for money, CITY_NG / STATE_NG / ADDRESS for places. */
export function placeholderPrefix(e: Pick<Entity, "type" | "role" | "canonical">): string {
  if (e.type === "MONEY") return moneyPlaceholderPrefix(e.canonical);
  if (e.type === "LOCATION") return locationKind(e.canonical);
  if (e.role && (e.type === "PERSON" || e.type === "ORG")) return e.role.toUpperCase();
  return TYPE_PREFIX[e.type];
}

/** Next free `${prefix}_N`, continuing after any already-taken placeholders. */
export function nextPlaceholder(prefix: string, taken: Iterable<string>): string {
  let max = 0;
  for (const p of taken) {
    if (!p.startsWith(`${prefix}_`)) continue;
    const n = Number(p.slice(prefix.length + 1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}_${max + 1}`;
}
