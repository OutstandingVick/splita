import { describe, expect, it } from "vitest";
import { type ExplainModel, explainSubject, QuickExplainer, SensitiveTermError } from "./quick-explain.js";

const model = (source?: "on_device" | "in_cloud"): ExplainModel & { prompts: string[] } => {
  const prompts: string[] = [];
  return {
    prompts,
    async generateContent(p) {
      prompts.push(p);
      return { response: { text: () => "A training bond is…", ...(source ? { inferenceSource: source } : {}) } };
    },
  };
};

describe("explainSubject", () => {
  it("reduces placeholders to their generic type", () => {
    expect(explainSubject("EMPLOYER_1")).toBe("the employer in a legal matter");
    expect(explainSubject("EMPLOYER_1's")).toBe("the employer in a legal matter");
    expect(explainSubject("AMOUNT_NGN_MID_2")).toBe("an amount of money between ₦100,000 and ₦5 million");
  });

  it("passes plain terms through", () => {
    expect(explainSubject(" training bond ")).toBe("training bond");
  });
});

describe("QuickExplainer", () => {
  it("returns the text and the SDK's inferenceSource", async () => {
    const m = model("on_device");
    const r = await new QuickExplainer(m).explain("training bond", []);
    expect(r).toMatchObject({ term: "training bond", text: "A training bond is…", source: "on_device" });
    expect(m.prompts[0]).toContain('"training bond"');
  });

  it("never sends a placeholder's number, only its type", async () => {
    const m = model("in_cloud");
    await new QuickExplainer(m).explain("EMPLOYEE_1", ["Adebayo Ogunleye"]);
    expect(m.prompts[0]).not.toContain("EMPLOYEE_1");
    expect(m.prompts[0]).toContain("employee");
  });

  it("refuses text containing a known identity and sends nothing", async () => {
    const m = model();
    await expect(new QuickExplainer(m).explain("Zenith Bank Plc's training bond", ["Zenith Bank Plc"])).rejects.toBeInstanceOf(SensitiveTermError);
    expect(m.prompts).toEqual([]);
  });

  it("refuses long selections", async () => {
    await expect(new QuickExplainer(model()).explain("x".repeat(81), [])).rejects.toBeInstanceOf(SensitiveTermError);
  });
});
