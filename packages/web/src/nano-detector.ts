import type { DetectorStatus, OptionalDetector, Span } from "@splita/core";
import { chunkText, locateEntities, parseNanoEntities } from "./nano-parse.js";

/** The slice of Firebase's GenerativeModel the detector needs (mockable in tests). */
export interface TextModel {
  generateContent(prompt: string): Promise<{ response: { text(): string } }>;
}

export interface NanoDetectorOptions {
  timeoutMs?: number;
  chunkChars?: number;
  /** Chrome's LanguageModel.availability(); defaults to the global Prompt API. */
  availability?: () => Promise<string>;
}

export class NanoTimeoutError extends Error {
  override name = "NanoTimeoutError";
}

export function nanoPrompt(chunk: string): string {
  return [
    "Extract every PERSON name, ORG (company, bank, firm) name and LOCATION (city, state, street address) in the text.",
    "Copy each exactly as it appears. Do not include money, emails, phone numbers, dates, or role words like Employer or Tenant.",
    'Return only a JSON array like [{"text":"...","type":"PERSON"}]. Return [] if there are none.',
    "",
    "TEXT:",
    "<<<",
    chunk,
    ">>>",
  ].join("\n");
}

export function defaultAvailability(): Promise<string> {
  const lm = (globalThis as { LanguageModel?: { availability(): Promise<string> } }).LanguageModel;
  return lm ? lm.availability() : Promise.resolve("unavailable");
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new NanoTimeoutError(`Nano timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Gemini Nano (on-device, via Firebase AI Logic ONLY_ON_DEVICE) entity detector.
 * Best-effort: never throws; failures return [] and set `status`.
 */
export class NanoDetector implements OptionalDetector {
  private _status: DetectorStatus = "idle";
  private _lastError: string | undefined;
  private readonly timeoutMs: number;
  private readonly chunkChars: number;
  private readonly availability: () => Promise<string>;

  constructor(
    private readonly model: TextModel,
    opts: NanoDetectorOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.chunkChars = opts.chunkChars ?? 2_000;
    this.availability = opts.availability ?? defaultAvailability;
  }

  get status(): DetectorStatus {
    return this._status;
  }

  /** Diagnostic message for the last failure (never contains document text). */
  get lastError(): string | undefined {
    return this._lastError;
  }

  async detect(text: string): Promise<Span[]> {
    return this.guard(async () => {
      const spans: Span[] = [];
      for (const chunk of chunkText(text, this.chunkChars)) {
        const res = await this.model.generateContent(nanoPrompt(chunk.text));
        spans.push(...locateEntities(chunk, parseNanoEntities(res.response.text())));
      }
      return spans;
    }, []);
  }

  /** Creates the on-device session and runs a trivial prompt so the first real call is fast. */
  async warmUp(): Promise<DetectorStatus> {
    await this.guard(async () => {
      await this.model.generateContent(nanoPrompt("Warm-up."));
      return true;
    }, false);
    return this._status;
  }

  private async guard<T>(work: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const availability = await this.availability();
      if (availability !== "available") {
        this.fail("unavailable", `LanguageModel.availability() = ${availability}`);
        return fallback;
      }
      const out = await withTimeout(work(), this.timeoutMs);
      this._status = "ready";
      this._lastError = undefined;
      return out;
    } catch (e) {
      if (e instanceof NanoTimeoutError) this.fail("timeout", e.message);
      else this.fail("error", e instanceof Error ? `${e.name}: ${e.message}` : "unknown error");
      return fallback;
    }
  }

  private fail(status: DetectorStatus, message: string): void {
    this._status = status;
    this._lastError = message;
  }
}
