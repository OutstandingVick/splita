import { describe, expect, it } from "vitest";
import { OnDeviceQueue, queued } from "./on-device-queue.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("OnDeviceQueue", () => {
  it("never runs two tasks at once and keeps order", async () => {
    const q = new OnDeviceQueue();
    let inFlight = 0;
    let peak = 0;
    const order: number[] = [];
    await Promise.all(
      [30, 5, 10].map((ms, i) =>
        q.run(async () => {
          peak = Math.max(peak, ++inFlight);
          await sleep(ms);
          order.push(i);
          inFlight--;
        }),
      ),
    );
    expect(peak).toBe(1);
    expect(order).toEqual([0, 1, 2]);
    expect(q.pending).toBe(0);
  });

  it("keeps going after a failed task", async () => {
    const q = new OnDeviceQueue();
    await expect(q.run(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(await q.run(async () => 7)).toBe(7);
  });

  it("serializes generateContent across models sharing a queue", async () => {
    const q = new OnDeviceQueue();
    let inFlight = 0;
    let peak = 0;
    const model = () => ({
      async generateContent(p: string) {
        peak = Math.max(peak, ++inFlight);
        await sleep(5);
        inFlight--;
        return p;
      },
    });
    const a = queued(model(), q);
    const b = queued(model(), q);
    expect(await Promise.all([a.generateContent("1"), b.generateContent("2"), a.generateContent("3")])).toEqual(["1", "2", "3"]);
    expect(peak).toBe(1);
  });
});
