import { describe, expect, it } from "vitest";
import { InMemoryVault } from "./memory-vault.js";
import { previewSplita } from "./preview.js";
import { RulesDetector } from "./rules-detector.js";

const TEXT = "Mr. Adebayo Ogunleye (the Employee) says Zenith Bank Plc (the Employer) owes him ₦850,000.";

describe("previewSplita", () => {
  it("anonymizes on the device without touching the vault", async () => {
    const vault = new InMemoryVault();
    const r = await previewSplita({ workspaceId: "w", text: TEXT }, { detectors: [new RulesDetector()], vault });
    expect(r.anonymizedText).toBe("EMPLOYEE_1 (the Employee) says EMPLOYER_1 (the Employer) owes him AMOUNT_NGN_MID_1.");
    expect(r.localView.spans).toHaveLength(3);
    expect(await vault.list("w")).toEqual([]);
  });
});
