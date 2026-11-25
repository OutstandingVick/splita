import { parseMoney } from "./money.js";
import { isSamePerson, personTokens } from "./names.js";
import { nextPlaceholder, placeholderPrefix } from "./placeholders.js";
import { detectRole } from "./roles.js";
import type { Entity, EntityType, Span } from "./types.js";

export interface Mention {
  span: Span;
  entityId: string;
}

export interface Resolution {
  /** Entities mentioned in this text (new or updated), ready to store in the vault. */
  entities: Entity[];
  mentions: Mention[];
}

interface Working {
  entity: Entity;
  isNew: boolean;
  firstStart: number;
}

const ORG_SUFFIXES = new Set(["ltd", "limited", "plc", "inc", "llc", "&", "co", "bank"]);

/** Normalized identity key for non-person types: same key ⇒ same entity. */
export function matchKey(type: EntityType, text: string): string {
  switch (type) {
    case "EMAIL":
      return text.toLowerCase();
    case "PHONE": {
      const d = text.replace(/\D/g, "");
      return d.startsWith("234") ? `0${d.slice(3)}` : d;
    }
    case "ACCOUNT_NUMBER":
      return text.replace(/\D/g, "");
    case "MONEY": {
      const v = parseMoney(text);
      return v ? `${v.currency}:${v.amount}` : text;
    }
    case "ORG": {
      const toks = text.toLowerCase().split(/\s+/);
      const core = toks.filter((t) => !ORG_SUFFIXES.has(t));
      return (core.length > 0 ? core : toks).join(" ");
    }
    default:
      return text.trim().toLowerCase();
  }
}

const longest = (xs: readonly string[]): string => xs.reduce((a, b) => (b.length > a.length ? b : a), "");

function findMatch(span: Span, pool: readonly Working[]): Working | undefined {
  const same = pool.filter((w) => w.entity.type === span.type);
  if (span.type === "PERSON") return same.find((w) => isSamePerson(span.text, longest(w.entity.aliases)));
  const key = matchKey(span.type, span.text);
  return same.find((w) => w.entity.aliases.some((a) => matchKey(span.type, a) === key));
}

/** Full names first so short aliases ("Adebayo", "Mr. Ogunleye") link to them. */
function processingOrder(spans: readonly Span[]): Span[] {
  const weight = (s: Span) => (s.type === "PERSON" ? -personTokens(s.text).length : 0);
  return [...spans].sort((a, b) => weight(a) - weight(b) || a.start - b.start);
}

/**
 * Links spans to entities (existing vault entities first), detects roles for new entities and
 * assigns stable placeholders. Pure: returns updated copies, never mutates inputs.
 */
export function resolveEntities(text: string, spans: readonly Span[], existing: readonly Entity[]): Resolution {
  const pool: Working[] = existing.map((e) => ({
    entity: { ...e, aliases: [...e.aliases] },
    isNew: false,
    firstStart: Number.POSITIVE_INFINITY,
  }));
  const assigned: { span: Span; w: Working }[] = [];

  for (const span of processingOrder(spans)) {
    let w = findMatch(span, pool);
    if (!w) {
      w = {
        entity: { id: "", type: span.type, canonical: span.text, aliases: [], placeholder: "" },
        isNew: true,
        firstStart: span.start,
      };
      pool.push(w);
    }
    if (!w.entity.aliases.includes(span.text)) w.entity.aliases.push(span.text);
    w.firstStart = Math.min(w.firstStart, span.start);
    assigned.push({ span, w });
  }

  assigned.sort((a, b) => a.span.start - b.span.start);
  for (const { span, w } of assigned) {
    if (!w.isNew || w.entity.role !== undefined || (span.type !== "PERSON" && span.type !== "ORG")) continue;
    const role = detectRole(text, span);
    if (role) w.entity.role = role;
  }

  for (const w of pool) w.entity.canonical = longest(w.entity.aliases);
  const fresh = pool.filter((w) => w.isNew).sort((a, b) => a.firstStart - b.firstStart);
  for (const w of fresh) {
    const taken = pool.map((p) => p.entity.placeholder).filter(Boolean);
    w.entity.placeholder = nextPlaceholder(placeholderPrefix(w.entity), taken);
    w.entity.id = `ent_${w.entity.placeholder.toLowerCase()}`;
  }

  const touched = [...new Set(assigned.map((a) => a.w))];
  return {
    entities: touched.map((w) => w.entity),
    mentions: assigned.map(({ span, w }) => ({ span, entityId: w.entity.id })),
  };
}
