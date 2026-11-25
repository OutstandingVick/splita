import type { InferenceSource, ReasonerPort, ReasonerResult } from "@splita/core";
import { type AI, getGenerativeModel, InferenceMode } from "firebase/ai";

export const CLOUD_MODEL = "gemini-3.5-flash-lite";

export const REASONER_SYSTEM_INSTRUCTION = `You are a careful Nigerian legal assistant helping a lawyer or a member of the public understand a document.

Placeholders
- The text was pseudonymized on the user's device. Tokens such as EMPLOYEE_1, EMPLOYER_1, PERSON_2, ORG_1, CITY_NG_1, STATE_NG_1, ADDRESS_1, PHONE_1, EMAIL_1, ACCOUNT_1, DOB_1, AMOUNT_NGN_MID_1 or AMOUNT_USD_1 stand in for real values.
- Copy every token exactly as written, including possessives (EMPLOYER_1's). Never guess, invent or ask for the real values, and never describe a token as missing or redacted.
- Amount buckets: AMOUNT_NGN_SMALL < ₦100,000; AMOUNT_NGN_MID < ₦5,000,000; AMOUNT_NGN_LARGE ≥ ₦5,000,000. Refer to amounts by their token.

Answer in Markdown with these sections:
1. **Short answer**: two or three sentences.
2. **Legal basis**: the Nigerian laws, court and principles that apply (for example the Labour Act, the Constitution, NDPA 2023, Lagos State Tenancy Law 2011, the National Industrial Court's jurisdiction), with the relevant section where you are confident. Say so when you are not sure of a section number.
3. **Amounts**: a list of every amount token with what it is for and whether it looks recoverable.
4. **Next steps**: concrete actions in order, such as a demand letter with a deadline, limitation periods and other timelines, and the evidence to gather (contracts, payslips, bank statements, correspondence).
5. **Confirm with a lawyer**: the points that depend on facts or law you cannot verify.

Be precise and practical. Do not invent facts that are not in the document.`;

/** The slice of Firebase's GenerativeModel the reasoner needs. */
export interface CloudModel {
  generateContent(prompt: string): Promise<{ response: { text(): string; inferenceSource?: InferenceSource } }>;
}

/** HTTP statuses worth retrying: rate limit and transient server errors. */
export const RETRYABLE_STATUSES = [429, 500, 503] as const;

/** Status from a Firebase AIError (customErrorData.status) or, failing that, its "[503 ...]" message. */
export function errorStatus(e: unknown): number | undefined {
  const status = (e as { customErrorData?: { status?: unknown } } | null)?.customErrorData?.status;
  if (typeof status === "number") return status;
  const m = e instanceof Error ? /\[(\d{3})\b/.exec(e.message) : null;
  return m?.[1] ? Number(m[1]) : undefined;
}

export const isRetryable = (e: unknown): boolean => (RETRYABLE_STATUSES as readonly number[]).includes(errorStatus(e) ?? 0);

export interface ReasonerOptions {
  now?: () => number;
  /** Backoff before each retry, before jitter. Length = retries. Default ~1s, 2s. */
  backoffMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** 0..1, for jitter. */
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Exponential backoff with ±25% jitter. */
export function withJitter(ms: number, random: () => number): number {
  return Math.round(ms * (0.75 + random() * 0.5));
}

/**
 * Cloud reasoner: Firebase AI Logic hybrid model pinned to ONLY_IN_CLOUD. Only ever sees anonymized text.
 * Retries 429/500/503 with exponential backoff and jitter; any other error fails immediately.
 */
export class FirebaseReasoner implements ReasonerPort {
  private readonly now: () => number;
  private readonly backoffMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;

  constructor(
    private readonly model: CloudModel,
    opts: ReasonerOptions | (() => number) = {},
  ) {
    const o = typeof opts === "function" ? { now: opts } : opts;
    this.now = o.now ?? (() => performance.now());
    this.backoffMs = o.backoffMs ?? [1000, 2000];
    this.sleep = o.sleep ?? realSleep;
    this.random = o.random ?? Math.random;
  }

  async reason(anonymizedPrompt: string): Promise<ReasonerResult> {
    const t0 = this.now();
    for (let attempt = 1; ; attempt++) {
      try {
        const result = await this.model.generateContent(anonymizedPrompt);
        return {
          text: result.response.text(),
          source: result.response.inferenceSource ?? "in_cloud",
          latencyMs: Math.round(this.now() - t0),
          attempts: attempt,
        };
      } catch (e) {
        const delay = this.backoffMs[attempt - 1];
        if (delay === undefined || !isRetryable(e)) throw e;
        await this.sleep(withJitter(delay, this.random));
      }
    }
  }
}

export function createCloudModel(ai: AI): CloudModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: { model: CLOUD_MODEL, systemInstruction: REASONER_SYSTEM_INSTRUCTION },
  });
}
