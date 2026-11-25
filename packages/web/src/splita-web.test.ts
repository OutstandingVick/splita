import { describe, expect, it } from "vitest";
import { composePrompt } from "./splita-web.js";

describe("composePrompt", () => {
  it("prefixes the question so it is pseudonymized with the document", () => {
    expect(composePrompt(" Does Mr. Ogunleye have a claim? ", "Doc")).toBe("Question:\nDoes Mr. Ogunleye have a claim?\n\nDocument:\nDoc");
  });

  it("sends the document alone without a question", () => {
    expect(composePrompt("  ", "Doc")).toBe("Doc");
    expect(composePrompt(undefined, "Doc")).toBe("Doc");
  });
});
