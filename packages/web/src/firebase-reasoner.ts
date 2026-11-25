import type { InferenceSource, ReasonerPort, ReasonerResult } from "@splita/core";
import { type AI, getGenerativeModel, InferenceMode } from "firebase/ai";

export const CLOUD_MODEL = "gemini-3.5-flash-lite";

export const REASONER_SYSTEM_INSTRUCTION = [
  "You are a careful assistant for Nigerian legal and financial documents.",
  "The text has been pseudonymized on the user's device. Tokens such as EMPLOYEE_1, EMPLOYER_1, PERSON_2, ORG_1,",
  "CITY_NG_1, ADDRESS_1, PHONE_1, ACCOUNT_1, DOB_1, AMOUNT_NGN_MID_1 or AMOUNT_USD_1 are intentional stand-ins for real values.",
  "Keep every such token verbatim in your answer, including possessives like EMPLOYER_1's.",
  "Never guess, invent or ask for the real values behind them. Amount buckets: SMALL < ₦100k, MID < ₦5m, LARGE ≥ ₦5m.",
].join(" ");

/** The slice of Firebase's GenerativeModel the reasoner needs. */
export interface CloudModel {
  generateContent(prompt: string): Promise<{ response: { text(): string; inferenceSource?: InferenceSource } }>;
}

/** Cloud reasoner: Firebase AI Logic hybrid model pinned to ONLY_IN_CLOUD. Only ever sees anonymized text. */
export class FirebaseReasoner implements ReasonerPort {
  constructor(
    private readonly model: CloudModel,
    private readonly now: () => number = () => performance.now(),
  ) {}

  async reason(anonymizedPrompt: string): Promise<ReasonerResult> {
    const t0 = this.now();
    const result = await this.model.generateContent(anonymizedPrompt);
    return {
      text: result.response.text(),
      source: result.response.inferenceSource ?? "in_cloud",
      latencyMs: Math.round(this.now() - t0),
    };
  }
}

export function createCloudModel(ai: AI): CloudModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: REASONER_SYSTEM_INSTRUCTION },
  });
}
