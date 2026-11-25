import { EMPLOYMENT_FIXTURE, EMPLOYMENT_QUESTION } from "./fixtures";

/**
 * Matters (workspaces) live on this device only. Each matter id is also its vault workspace id,
 * so every matter has its own placeholder mapping. Ids match the receipt workspaceId rule.
 */
export interface Matter {
  id: string;
  title: string;
  document: string;
  question: string;
  createdAt: string;
  updatedAt: string;
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const MATTERS_KEY = "splita:matters:v1";
export const DEMO_MATTER_ID = "demo-ogunleye-v-zenith";

const WORKSPACE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function newMatterId(random: () => number = Math.random): string {
  return `m-${Date.now().toString(36)}-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
}

function isMatter(v: unknown): v is Matter {
  const m = v as Partial<Matter> | null;
  return (
    typeof m === "object" && m !== null && typeof m.id === "string" && WORKSPACE_ID.test(m.id) &&
    typeof m.title === "string" && typeof m.document === "string" && typeof m.question === "string" &&
    typeof m.createdAt === "string" && typeof m.updatedAt === "string"
  );
}

/** Reads matters, dropping anything malformed. Never throws (corrupt storage = empty list). */
export function loadMatters(store: KeyValueStore): Matter[] {
  try {
    const data: unknown = JSON.parse(store.getItem(MATTERS_KEY) ?? "[]");
    return Array.isArray(data) ? data.filter(isMatter) : [];
  } catch {
    return [];
  }
}

export function saveMatters(store: KeyValueStore, matters: readonly Matter[]): void {
  store.setItem(MATTERS_KEY, JSON.stringify(matters));
}

export function demoMatter(now = new Date()): Matter {
  const t = now.toISOString();
  return {
    id: DEMO_MATTER_ID,
    title: "Ogunleye v. Zenith Bank",
    document: EMPLOYMENT_FIXTURE,
    question: EMPLOYMENT_QUESTION,
    createdAt: t,
    updatedAt: t,
  };
}

/** Adds the demo matter if it isn't there, so judges can try Splita in one click. */
export function withDemo(matters: readonly Matter[], now = new Date()): Matter[] {
  return matters.some((m) => m.id === DEMO_MATTER_ID) ? [...matters] : [demoMatter(now), ...matters];
}

export function createMatter(title: string, now = new Date(), random?: () => number): Matter {
  const t = now.toISOString();
  return { id: newMatterId(random), title: title.trim() || "Untitled matter", document: "", question: "", createdAt: t, updatedAt: t };
}

export function updateMatter(matters: readonly Matter[], id: string, patch: Partial<Pick<Matter, "title" | "document" | "question">>, now = new Date()): Matter[] {
  return matters.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: now.toISOString() } : m));
}

export function removeMatter(matters: readonly Matter[], id: string): Matter[] {
  return matters.filter((m) => m.id !== id);
}
