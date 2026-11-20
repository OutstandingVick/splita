import { describe, expect, it } from "vitest";
import { SPLITA_CORE_VERSION } from "./index.js";

describe("core", () => {
  it("exports a version", () => {
    expect(SPLITA_CORE_VERSION).toBe("0.0.0");
  });
});
