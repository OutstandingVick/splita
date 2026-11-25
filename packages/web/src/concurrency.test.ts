import { describe, expect, it } from "vitest";
import { mapLimit } from "./concurrency.js";

describe("mapLimit", () => {
  it("keeps order and never exceeds the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapLimit([30, 10, 20, 5, 1], 2, async (ms, i) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, ms));
      inFlight--;
      return i;
    });
    expect(out).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("handles an empty list", async () => {
    expect(await mapLimit([], 2, async () => 1)).toEqual([]);
  });
});
