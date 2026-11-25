/**
 * One long-lived Gemini Nano session via Chrome's Prompt API.
 *
 * Firebase AI Logic's on-device adapter creates a new LanguageModel session on every
 * generateContent() and destroys the previous one, so overlapping calls kill each other's
 * sessions and nothing stays warm. Detection instead keeps one base session (system prompt
 * already processed) and clones it per chunk: clones share the warm prefix and are independent.
 */

export interface PromptOptions {
  responseConstraint?: object;
  signal?: AbortSignal;
}

export interface PromptSession {
  prompt(input: string, options?: PromptOptions): Promise<string>;
  clone(options?: { signal?: AbortSignal }): Promise<PromptSession>;
  destroy(): void;
}

export interface LanguageModelApi {
  availability(options?: object): Promise<string>;
  create(options?: object): Promise<PromptSession>;
}

/** Chrome's global `LanguageModel`, if this browser has the Prompt API. */
export function chromeLanguageModel(): LanguageModelApi | undefined {
  return (globalThis as { LanguageModel?: LanguageModelApi }).LanguageModel;
}

export const NANO_SYSTEM_PROMPT = [
  "You find the names of people and organisations in Nigerian legal and business documents.",
  "Copy each name exactly as written. Reply only with JSON.",
].join(" ");

export function nanoCreateOptions(systemPrompt = NANO_SYSTEM_PROMPT): object {
  return {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
    initialPrompts: [{ role: "system", content: systemPrompt }],
  };
}

export class NanoSession {
  private base: Promise<PromptSession> | undefined;
  private created = false;

  constructor(
    private readonly api: () => LanguageModelApi | undefined = chromeLanguageModel,
    private readonly createOptions: object = nanoCreateOptions(),
  ) {}

  /** True once the base session exists, i.e. the next prompt is a warm one. */
  get warm(): boolean {
    return this.created;
  }

  availability(): Promise<string> {
    const lm = this.api();
    return lm ? lm.availability(this.createOptions) : Promise.resolve("unavailable");
  }

  /** Creates the base session once; a failed create is retried on the next call. */
  ready(): Promise<PromptSession> {
    if (!this.base) {
      const lm = this.api();
      if (!lm) return Promise.reject(new Error("LanguageModel (Prompt API) is not available in this browser"));
      this.base = lm.create(this.createOptions).then(
        (s) => {
          this.created = true;
          return s;
        },
        (e: unknown) => {
          this.base = undefined;
          throw e;
        },
      );
    }
    return this.base;
  }

  /** Runs one prompt on a fresh clone of the warm base session, then frees the clone. */
  async prompt(input: string, options: PromptOptions = {}): Promise<string> {
    const base = await this.ready();
    const session = await base.clone(options.signal ? { signal: options.signal } : {});
    try {
      return await session.prompt(input, options);
    } finally {
      session.destroy();
    }
  }

  destroy(): void {
    void this.base?.then((s) => s.destroy(), () => undefined);
    this.base = undefined;
    this.created = false;
  }
}
