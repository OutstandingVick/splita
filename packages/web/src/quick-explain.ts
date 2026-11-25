import type { InferenceSource } from "@splita/core";
import { type AI, getGenerativeModel, InferenceMode } from "firebase/ai";
import { CLOUD_MODEL } from "./firebase-reasoner.js";

/**
 * "Quick explain": a short definition of a legal term or placeholder type, through Firebase AI
 * Logic hybrid inference (PREFER_ON_DEVICE). Gemini Nano answers when it is available, and the
 * cloud model otherwise; the response says which. Because it may go to the cloud, only
 * non-sensitive text is allowed: placeholders are reduced to their type, and any term containing a
 * known identity from the vault is refused.
 */

export const EXPLAIN_SYSTEM_INSTRUCTION =
  "You explain Nigerian legal and financial terms in plain English for a non-lawyer. Answer in two or three sentences. Do not give advice about a specific case.";

export interface ExplainModel {
  generateContent(prompt: string): Promise<{ response: { text(): string; inferenceSource?: InferenceSource } }>;
}

export interface Explanation {
  term: string;
  text: string;
  source: InferenceSource;
  latencyMs: number;
}

export class SensitiveTermError extends Error {
  override name = "SensitiveTermError";
}

const PLACEHOLDER = /^([A-Z]+(?:_[A-Z]+)*)_\d+$/;

const PLACEHOLDER_MEANING: Record<string, string> = {
  AMOUNT_NGN_SMALL: "an amount of money under ₦100,000",
  AMOUNT_NGN_MID: "an amount of money between ₦100,000 and ₦5 million",
  AMOUNT_NGN_LARGE: "an amount of money of ₦5 million or more",
  DOB: "a date of birth",
  ACCOUNT: "a NUBAN bank account number",
  CITY_NG: "a Nigerian city",
  STATE_NG: "a Nigerian state",
};

/** What actually gets sent: a placeholder becomes its generic type ("EMPLOYER_1" → "employer"). */
export function explainSubject(term: string): string {
  const t = term.trim().replace(/['’]s$/, "");
  const m = PLACEHOLDER.exec(t);
  if (!m?.[1]) return t;
  return PLACEHOLDER_MEANING[m[1]] ?? `the ${m[1].toLowerCase().replace(/_/g, " ")} in a legal matter`;
}

export function explainPrompt(subject: string): string {
  return `What does "${subject}" mean in a Nigerian legal context?`;
}

export class QuickExplainer {
  constructor(
    private readonly model: ExplainModel,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** `knownValues`: real identity values from the vault; a term containing one is refused. */
  async explain(term: string, knownValues: readonly string[]): Promise<Explanation> {
    const subject = explainSubject(term);
    if (!subject || subject.length > 80) throw new SensitiveTermError("Select a short term (up to 80 characters) to explain.");
    const lower = subject.toLowerCase();
    if (knownValues.some((v) => v.length >= 2 && lower.includes(v.toLowerCase()))) {
      throw new SensitiveTermError("That text contains a real identity, so it can't be sent. Select a term from the anonymized answer.");
    }
    const t0 = this.now();
    const res = await this.model.generateContent(explainPrompt(subject));
    return {
      term: subject,
      text: res.response.text(),
      source: res.response.inferenceSource ?? "in_cloud",
      latencyMs: Math.round(this.now() - t0),
    };
  }
}

/** Firebase AI Logic hybrid model in PREFER_ON_DEVICE: Nano when available, cloud otherwise. */
export function createExplainModel(ai: AI): ExplainModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.PREFER_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      },
    },
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: EXPLAIN_SYSTEM_INSTRUCTION },
  });
}
