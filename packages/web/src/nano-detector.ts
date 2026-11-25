import type { DetectorStatus, OptionalDetector, Span } from "@splita/core";
import { chunkText, locateEntities, NANO_RESPONSE_SCHEMA, parseNanoEntities } from "./nano-parse.js";
import { mapLimit } from "./concurrency.js";
import type { PromptOptions } from "./nano-session.js";

/** The slice of NanoSession the detector needs (mockable in tests). */
export interface NanoPrompter {
  readonly warm: boolean;
  availability(): Promise<string>;
  ready(): Promise<unknown>;
  prompt(input: string, options?: PromptOptions): Promise<string>;
}

export interface NanoDetectorOptions {
  /** Budget for one whole detect() or warmUp(). */
  timeoutMs?: number;
  chunkChars?: number;
  /** Chunks prompted at once (each on its own clone of the warm session). */
  concurrency?: number;
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

async function withTimeout<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new NanoTimeoutError(`Nano timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Gemini Nano (on-device) entity detector on one warm Prompt API session.
 * Best-effort: never throws; failures return [] and set `status`.
 */
export class NanoDetector implements OptionalDetector {
  private _status: DetectorStatus = "idle";
  private _lastError: string | undefined;
  private readonly timeoutMs: number;
  private readonly chunkChars: number;
  private readonly concurrency: number;

  constructor(
    private readonly session: NanoPrompter,
    opts: NanoDetectorOptions = {},
  ) {
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.chunkChars = opts.chunkChars ?? 2_000;
    this.concurrency = opts.concurrency ?? 2;
  }

  get status(): DetectorStatus {
    return this._status;
  }

  /** Diagnostic message for the last failure (never contains document text). */
  get lastError(): string | undefined {
    return this._lastError;
  }

  async detect(text: string): Promise<Span[]> {
    return this.guard(async (signal) => {
      const perChunk = await mapLimit(chunkText(text, this.chunkChars), this.concurrency, async (chunk) => {
        const raw = await this.session.prompt(nanoPrompt(chunk.text), { responseConstraint: NANO_RESPONSE_SCHEMA, signal });
        return locateEntities(chunk, parseNanoEntities(raw));
      });
      return perChunk.flat();
    }, []);
  }

  /** Creates the warm base session on page load so the first real detect skips session setup. */
  async warmUp(): Promise<DetectorStatus> {
    await this.guard(async () => {
      await this.session.ready();
      return true;
    }, false);
    return this._status;
  }

  private async guard<T>(work: (signal: AbortSignal) => Promise<T>, fallback: T): Promise<T> {
    try {
      const availability = await this.session.availability();
      if (availability !== "available") {
        this.fail("unavailable", `LanguageModel.availability() = ${availability}`);
        return fallback;
      }
      const out = await withTimeout(work, this.timeoutMs);
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
