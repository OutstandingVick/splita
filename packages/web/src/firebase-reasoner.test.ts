import { describe, expect, it } from "vitest";
import { FirebaseReasoner, REASONER_SYSTEM_INSTRUCTION } from "./firebase-reasoner.js";

describe("FirebaseReasoner", () => {
  it("returns text, the reported inference source and latency", async () => {
    let t = 1000;
    const prompts: string[] = [];
    const r = new FirebaseReasoner(
      {
        async generateContent(p) {
          prompts.push(p);
          t += 250;
          return { response: { text: () => "EMPLOYER_1 must pay.", inferenceSource: "in_cloud" } };
        },
      },
      () => t,
    );
    expect(await r.reason("Does EMPLOYER_1 owe?")).toEqual({ text: "EMPLOYER_1 must pay.", source: "in_cloud", latencyMs: 250 });
    expect(prompts).toEqual(["Does EMPLOYER_1 owe?"]);
  });

  it("defaults the source to in_cloud when the SDK omits it", async () => {
    const r = new FirebaseReasoner({ generateContent: async () => ({ response: { text: () => "ok" } }) });
    expect((await r.reason("x")).source).toBe("in_cloud");
  });

  it("instructs the model to keep placeholders verbatim", () => {
    expect(REASONER_SYSTEM_INSTRUCTION).toMatch(/Copy every token exactly as written/);
    for (const section of ["Legal basis", "Amounts", "Next steps", "Confirm with a lawyer"]) {
      expect(REASONER_SYSTEM_INSTRUCTION).toContain(section);
    }
    expect(REASONER_SYSTEM_INSTRUCTION).toMatch(/Never guess/);
  });
});
