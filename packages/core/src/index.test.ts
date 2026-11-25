import { describe, expect, it } from "vitest";
import * as core from "./index.js";

describe("public API", () => {
  it("exposes the pipeline and in-memory adapters", () => {
    for (const name of ["runSplita", "RulesDetector", "InMemoryVault", "InMemoryReceiptLog", "restore", "pseudonymize", "resolveEntities"]) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe("function");
    }
    expect(core.ENTITY_TYPES).toContain("ACCOUNT_NUMBER");
    expect(core.SPLITA_CORE_VERSION).toBe("0.1.0");
  });
});
