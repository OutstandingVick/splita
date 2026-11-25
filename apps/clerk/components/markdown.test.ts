import { describe, expect, it } from "vitest";
import { parseBlocks } from "./markdown";

describe("parseBlocks", () => {
  it("keeps the model's numbering when bullets interrupt an ordered list", () => {
    const blocks = parseBlocks("1. **Short answer**: yes\n2. **Legal basis**:\n- Labour Act\n3. **Amounts**:\n- N12.5m");
    const ordered = blocks.filter((b) => b.kind === "list" && b.ordered);
    expect(ordered.map((b) => (b.kind === "list" ? b.start : 0))).toEqual([1, 3]);
  });

  it("parses headings and paragraphs", () => {
    expect(parseBlocks("## Next steps\nSend a demand letter.").map((b) => b.kind)).toEqual(["heading", "para"]);
  });
});
