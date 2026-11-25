/**
 * Single-flight queue for on-device calls.
 *
 * Firebase AI Logic's Chrome adapter creates a LanguageModel session per generateContent() and
 * destroys the previous one, so two on-device calls in flight at once can kill each other's
 * session. Every on-device request (warm-up, detection chunks, Quick explain) goes through one
 * queue and runs strictly one after another.
 */
export class OnDeviceQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private _pending = 0;

  /** Calls queued or running. */
  get pending(): number {
    return this._pending;
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    this._pending++;
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result.finally(() => {
      this._pending--;
    });
  }
}

/** Wraps any model so each generateContent() waits its turn in `queue`. */
export function queued<M extends { generateContent(prompt: string): Promise<unknown> }>(model: M, queue: OnDeviceQueue): M {
  return new Proxy(model, {
    get(target, prop, receiver) {
      if (prop === "generateContent") return (prompt: string) => queue.run(() => target.generateContent(prompt));
      return Reflect.get(target, prop, receiver) as unknown;
    },
  });
}
