import { describe, expect, it } from "vitest";
import { type LanguageModelApi, NanoSession, type PromptSession } from "./nano-session.js";

function fakeApi(reply = "[]") {
  const log = { creates: 0, clones: 0, destroyed: 0, prompts: [] as string[] };
  const session = (): PromptSession => ({
    async prompt(input) {
      log.prompts.push(input);
      return reply;
    },
    async clone() {
      log.clones++;
      return session();
    },
    destroy() {
      log.destroyed++;
    },
  });
  const api: LanguageModelApi = {
    availability: async () => "available",
    async create() {
      log.creates++;
      return session();
    },
  };
  return { api, log };
}

describe("NanoSession", () => {
  it("creates the base session once and clones it per prompt", async () => {
    const { api, log } = fakeApi();
    const s = new NanoSession(() => api);
    expect(s.warm).toBe(false);
    await Promise.all([s.prompt("a"), s.prompt("b"), s.prompt("c")]);
    expect(log.creates).toBe(1);
    expect(log.clones).toBe(3);
    expect(log.destroyed).toBe(3); // clones freed, base kept
    expect(s.warm).toBe(true);
  });

  it("retries create after a failure", async () => {
    const { api, log } = fakeApi();
    let fail = true;
    const flaky: LanguageModelApi = { ...api, create: (o) => (fail ? Promise.reject(new Error("NotAllowedError")) : api.create(o)) };
    const s = new NanoSession(() => flaky);
    await expect(s.prompt("x")).rejects.toThrow("NotAllowedError");
    fail = false;
    await s.prompt("x");
    expect(log.creates).toBe(1);
  });

  it("reports unavailable without a Prompt API", async () => {
    const s = new NanoSession(() => undefined);
    expect(await s.availability()).toBe("unavailable");
    await expect(s.prompt("x")).rejects.toThrow(/not available/);
  });
});
