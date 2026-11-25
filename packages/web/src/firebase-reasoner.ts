import type { InferenceSource, ReasonerPort, ReasonerResult, ReasonOptions } from "@splita/core";
import { type AI, getGenerativeModel, InferenceMode, ThinkingLevel } from "firebase/ai";

export const CLOUD_MODEL = "gemini-3.5-flash";
/** Caps answer length (and cost). Thinking is kept low so it doesn't eat into this budget. */
export const CLOUD_MAX_OUTPUT_TOKENS = 800;
/**
 * Second cloud model, tried once the primary has exhausted its retries. A different model from the
 * primary, so an overloaded model doesn't take the request down. (gemini-2.5-flash returns 404 for
 * new projects.) Override with `fallbackCloudModel` / NEXT_PUBLIC_FALLBACK_CLOUD_MODEL.
 */
export const FALLBACK_CLOUD_MODEL = "gemini-3.5-flash-lite";

export const REASONER_SYSTEM_INSTRUCTION = `You are a careful Nigerian legal assistant helping a lawyer or a member of the public understand a document.

Placeholders
- The text was pseudonymized on the user's device. Tokens such as EMPLOYEE_1, EMPLOYER_1, PERSON_2, ORG_1, CITY_NG_1, STATE_NG_1, ADDRESS_1, PHONE_1, EMAIL_1, ACCOUNT_1, DOB_1, AMOUNT_NGN_MID_1 or AMOUNT_USD_1 stand in for real values.
- Copy every token exactly as written, including possessives (EMPLOYER_1's). Never guess, invent or ask for the real values, and never describe a token as missing or redacted.
- Amount buckets: AMOUNT_NGN_SMALL < ₦100,000; AMOUNT_NGN_MID < ₦5,000,000; AMOUNT_NGN_LARGE ≥ ₦5,000,000. Refer to amounts by their token.

Answer in Markdown, concisely: at most about 300 words in total, short bullet points rather than paragraphs, and these five sections:
1. **Short answer**: one or two sentences.
2. **Legal basis**: the Nigerian laws, court and principles that apply (for example the Labour Act, the Constitution, NDPA 2023, Lagos State Tenancy Law 2011, the National Industrial Court's jurisdiction), with the relevant section where you are confident. Say so when you are not sure of a section number.
3. **Amounts**: a list of every amount token with what it is for and whether it looks recoverable.
4. **Next steps**: concrete actions in order, such as a demand letter with a deadline, limitation periods and other timelines, and the evidence to gather (contracts, payslips, bank statements, correspondence).
5. **Confirm with a lawyer**: the points that depend on facts or law you cannot verify.

Be precise and practical; no preamble, no repetition between sections. Do not invent facts that are not in the document.`;

interface CloudResponse {
  text(): string;
  inferenceSource?: InferenceSource;
}

/** The slice of Firebase's GenerativeModel the reasoner needs. Streaming is optional. */
export interface CloudModel {
  generateContent(prompt: string): Promise<{ response: CloudResponse }>;
  generateContentStream?(prompt: string): Promise<{ stream: AsyncIterable<{ text(): string }>; response: Promise<CloudResponse> }>;
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

/** A cloud call that took longer than `timeoutMs`. Treated like a 503: retried, then the fallback. */
export class CloudTimeoutError extends Error {
  override name = "CloudTimeoutError";
}

export const isRetryable = (e: unknown): boolean =>
  e instanceof CloudTimeoutError || (RETRYABLE_STATUSES as readonly number[]).includes(errorStatus(e) ?? 0);

export interface NamedCloudModel {
  name: string;
  model: CloudModel;
}

/** One cloud call about to start: attempt 1 is the first try; `retryAfter` says why it is a retry. */
export interface CloudAttempt {
  attempt: number;
  model: string;
  retryAfter?: "rate-limit" | "server-error" | "timeout" | "unavailable";
}

export interface ReasonerOptions {
  now?: () => number;
  /** Called before every cloud call (first try, retries, fallback). */
  onAttempt?: (attempt: CloudAttempt) => void;
  /** Name of the primary model, recorded in the result. */
  modelName?: string;
  /** Tried after the primary's retries run out (or it reports 404). Same ONLY_IN_CLOUD mode, same payload. */
  fallback?: NamedCloudModel;
  /** Backoff before each retry, before jitter. Length = retries. Default ~1s, 2s. */
  backoffMs?: readonly number[];
  /** Per-call limit; a slower call is abandoned and retried. Default 35 s. */
  timeoutMs?: number;
  /** Backoff before switching to the fallback. Default ~4s. */
  fallbackDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** 0..1, for jitter. */
  random?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function safeCall(f: () => void): void {
  try {
    f();
  } catch {
    // ignore listener errors
  }
}

function retryReason(e: unknown): CloudAttempt["retryAfter"] {
  if (e instanceof CloudTimeoutError) return "timeout";
  const status = errorStatus(e);
  if (status === 429) return "rate-limit";
  if (status === 404) return "unavailable";
  return "server-error";
}

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
  private readonly modelName: string;
  private readonly fallback: NamedCloudModel | undefined;
  private readonly fallbackDelayMs: number;
  private readonly timeoutMs: number;
  private onAttempt: ((a: CloudAttempt) => void) | undefined;

  constructor(
    private readonly model: CloudModel,
    opts: ReasonerOptions | (() => number) = {},
  ) {
    const o = typeof opts === "function" ? { now: opts } : opts;
    this.now = o.now ?? (() => performance.now());
    this.backoffMs = o.backoffMs ?? [1000, 2000];
    this.sleep = o.sleep ?? realSleep;
    this.random = o.random ?? Math.random;
    this.modelName = o.modelName ?? CLOUD_MODEL;
    this.fallback = o.fallback;
    this.fallbackDelayMs = o.fallbackDelayMs ?? 4000;
    this.timeoutMs = o.timeoutMs ?? 35_000;
    this.onAttempt = o.onAttempt;
  }

  private async withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new CloudTimeoutError(`Cloud call timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Replace the attempt listener (e.g. per run). */
  setAttemptListener(listener: ((a: CloudAttempt) => void) | undefined): void {
    this.onAttempt = listener;
  }

  /**
   * Streams the answer; each chunk (and the first) must arrive within the timeout. Returns the
   * full text and the SDK's inferenceSource.
   */
  private async streamOnce(model: CloudModel, prompt: string, onText: (t: string) => void): Promise<{ text: string; source: InferenceSource }> {
    if (!model.generateContentStream) throw new Error("streaming not supported");
    const result = await this.withTimeout(model.generateContentStream(prompt));
    const it = result.stream[Symbol.asyncIterator]();
    let text = "";
    for (;;) {
      const next = await this.withTimeout(it.next());
      if (next.done) break;
      const piece = next.value.text();
      if (piece) {
        text += piece;
        onText(text);
      }
    }
    const response = await this.withTimeout(result.response);
    return { text: text || response.text(), source: response.inferenceSource ?? "in_cloud" };
  }

  async reason(anonymizedPrompt: string, options: ReasonOptions = {}): Promise<ReasonerResult> {
    const t0 = this.now();
    let attempts = 0;
    let lastError: unknown;
    const onText = options.onText;
    const announce = (name: string) => {
      attempts++;
      const retryAfter = lastError === undefined ? undefined : retryReason(lastError);
      try {
        this.onAttempt?.({ attempt: attempts, model: name, ...(retryAfter ? { retryAfter } : {}) });
      } catch {
        // UI listeners must not affect the call.
      }
    };
    const done = (text: string, source: InferenceSource, name: string): ReasonerResult => ({
      text,
      source,
      latencyMs: Math.round(this.now() - t0),
      attempts,
      model: name,
    });
    const call = async (model: CloudModel, name: string): Promise<ReasonerResult> => {
      announce(name);
      if (onText && model.generateContentStream) {
        try {
          const r = await this.streamOnce(model, anonymizedPrompt, onText);
          return done(r.text, r.source, name);
        } catch (e) {
          // Streaming failed: discard any partial text and make the same request without streaming.
          lastError = e;
          safeCall(() => onText(""));
          announce(name);
        }
      }
      const result = await this.withTimeout(model.generateContent(anonymizedPrompt));
      const text = result.response.text();
      if (onText) safeCall(() => onText(text));
      return done(text, result.response.inferenceSource ?? "in_cloud", name);
    };

    for (let retry = 0; ; retry++) {
      try {
        return await call(this.model, this.modelName);
      } catch (e) {
        lastError = e;
        const delay = this.backoffMs[retry];
        if (delay !== undefined && isRetryable(e)) {
          await this.sleep(withJitter(delay, this.random));
          continue;
        }
        // Same anonymized payload, second model. Fail-closed: if it also fails, the error propagates.
        if (!this.fallback || !(isRetryable(e) || errorStatus(e) === 404)) throw e;
        await this.sleep(withJitter(this.fallbackDelayMs, this.random));
        return call(this.fallback.model, this.fallback.name);
      }
    }
  }
}

export function createCloudModel(ai: AI, model: string = CLOUD_MODEL): CloudModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_IN_CLOUD,
    inCloudParams: {
      model,
      systemInstruction: REASONER_SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: CLOUD_MAX_OUTPUT_TOKENS, thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
    },
  });
}
