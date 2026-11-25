import { describe, expect, it } from "vitest";
import { explainFailure } from "./explain-failure";

describe("explainFailure", () => {
  it("says nothing was sent for on-device stages", () => {
    expect(explainFailure("detect", new Error("x")).sent).toBe("nothing");
    const leak = explainFailure("pseudonymize", { name: "IdentityLeakError", message: "1 alias survived" });
    expect(leak.title).toBe("Nothing was sent.");
    expect(leak.body).toContain("stopped before contacting the cloud");
  });

  it("says only stand-ins may have left for cloud-side failures", () => {
    const r = explainFailure("reason", new Error("[500] high demand"));
    expect(r).toMatchObject({ sent: "anonymized-only", title: "The cloud model didn't answer." });
    expect(r.detail).toBe("[500] high demand");
    expect(explainFailure("receipt", new Error("permission-denied")).title).toContain("answer is withheld");
  });
});
