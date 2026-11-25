import { describe, expect, it } from "vitest";
import {
  createMatter, DEMO_MATTER_ID, type KeyValueStore, loadMatters, MATTERS_KEY, removeMatter, saveMatters, updateMatter, withDemo,
} from "./matters";

const memory = (init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } => ({
  data: { ...init },
  getItem(k) {
    return this.data[k] ?? null;
  },
  setItem(k, v) {
    this.data[k] = v;
  },
});
const now = new Date("2026-11-25T12:00:00Z");

describe("matters", () => {
  it("round-trips through storage", () => {
    const store = memory();
    const m = createMatter("  Bello tenancy ", now, () => 0.5);
    saveMatters(store, [m]);
    expect(loadMatters(store)).toEqual([m]);
    expect(m.title).toBe("Bello tenancy");
    expect(m.id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it("treats corrupt or malformed storage as empty, dropping bad entries", () => {
    expect(loadMatters(memory({ [MATTERS_KEY]: "{nope" }))).toEqual([]);
    const good = createMatter("ok", now);
    const bad = { ...good, id: "has spaces" };
    expect(loadMatters(memory({ [MATTERS_KEY]: JSON.stringify([good, bad, 5]) }))).toEqual([good]);
  });

  it("adds the demo matter once, first", () => {
    const list = withDemo([createMatter("a", now)], now);
    expect(list[0]?.id).toBe(DEMO_MATTER_ID);
    expect(list[0]?.document).toContain("Kwame Mensah of Lighthouse Advisory");
    expect(withDemo(list, now)).toHaveLength(2);
  });

  it("updates and removes by id", () => {
    const a = createMatter("a", now);
    const later = new Date("2026-11-26T00:00:00Z");
    const [u] = updateMatter([a], a.id, { question: "Q?" }, later);
    expect(u).toMatchObject({ question: "Q?", updatedAt: later.toISOString() });
    expect(removeMatter([a], a.id)).toEqual([]);
  });
});
