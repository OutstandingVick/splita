import { Fragment, type ReactNode } from "react";

/**
 * Minimal Markdown renderer for model answers: headings, paragraphs, ordered/unordered lists,
 * **bold**, *italic* and `code`. Builds React elements only (no innerHTML), so model output
 * can never inject markup.
 */

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; start: number; items: string[] }
  | { kind: "para"; text: string };

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: "para", text: para.join(" ") });
    para = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1]?.length ?? 1, text: heading[2] ?? "" });
    } else if (item) {
      flush();
      const ordered = item[2] !== undefined;
      const last = blocks.at(-1);
      if (last?.kind === "list" && last.ordered === ordered) last.items.push(item[3] ?? "");
      else blocks.push({ kind: "list", ordered, start: ordered ? Number(item[2]) : 1, items: [item[3] ?? ""] });
    } else {
      const last = blocks.at(-1);
      // Indented continuation of a list item.
      if (!para.length && last?.kind === "list" && /^\s{2,}/.test(raw)) last.items[last.items.length - 1] += ` ${line.trim()}`;
      else para.push(line.trim());
    }
  }
  flush();
  return blocks;
}

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`|\*([^*\s][^*]*?)\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) out.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<code key={m.index} className="rounded bg-black/5 px-1">{m[2]}</code>);
    else out.push(<em key={m.index}>{m[3]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const HEADING_CLASS = ["text-base font-semibold", "text-sm font-semibold", "text-sm font-semibold", "text-sm font-medium"];

export function Markdown({ text, inline = renderInline }: { text: string; inline?: (t: string) => ReactNode[] }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "heading") return <p key={i} className={HEADING_CLASS[b.level - 1]}>{inline(b.text)}</p>;
        if (b.kind === "para") return <p key={i}>{inline(b.text)}</p>;
        const List = b.ordered ? "ol" : "ul";
        return (
          <List key={i} {...(b.ordered && b.start !== 1 ? { start: b.start } : {})} className={`space-y-1 pl-5 ${b.ordered ? "list-decimal" : "list-disc"}`}>
            {b.items.map((it, j) => (
              <li key={j}>
                <Fragment>{inline(it)}</Fragment>
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
