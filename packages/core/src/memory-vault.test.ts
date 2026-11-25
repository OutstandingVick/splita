import { describe, expect, it } from "vitest";
import { InMemoryVault } from "./memory-vault.js";
import type { Entity } from "./types.js";

const ada: Entity = { id: "e1", type: "PERSON", canonical: "Ada Okeke", aliases: ["Ada Okeke"], placeholder: "PERSON_1" };

describe("InMemoryVault", () => {
  it("puts and gets by workspace", async () => {
    const v = new InMemoryVault();
    await v.put("w1", ada);
    expect(await v.get("w1", "e1")).toEqual(ada);
    expect(await v.get("w2", "e1")).toBeUndefined();
  });

  it("lists only the workspace's entities", async () => {
    const v = new InMemoryVault();
    await v.put("w1", ada);
    await v.put("w2", { ...ada, id: "e2" });
    expect((await v.list("w1")).map((e) => e.id)).toEqual(["e1"]);
    expect(await v.list("none")).toEqual([]);
  });

  it("returns copies so callers cannot mutate stored state", async () => {
    const v = new InMemoryVault();
    await v.put("w1", ada);
    const got = await v.get("w1", "e1");
    got?.aliases.push("Ada");
    expect((await v.get("w1", "e1"))?.aliases).toEqual(["Ada Okeke"]);
  });
});
