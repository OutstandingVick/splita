import { describe, expect, it } from "vitest";
import { deviceBadge } from "./device-badge";

describe("deviceBadge", () => {
  it("prefers offline over everything", () => {
    expect(deviceBadge("ready", false).label).toBe("Offline");
  });
  it("shows Nano ready, pending and rules-only", () => {
    expect(deviceBadge("ready", true).label).toBe("On-device: Gemini Nano ready");
    expect(deviceBadge("warming", true).tone).toBe("pending");
    expect(deviceBadge("unavailable", true)).toMatchObject({ tone: "rules", label: "Rules-only mode" });
    expect(deviceBadge("timeout", true).detail).toContain("timed out");
  });
});
