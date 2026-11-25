import type { PlaceholderInfo } from "@splita/core";

const PLACEHOLDER_RE = /\b[A-Z]+(?:_[A-Z]+)*_\d+\b/g;

/** Tooltip text for a placeholder: type, role and detector. Never the real value. */
export function placeholderTooltip(info: PlaceholderInfo): string {
  const role = info.role ? ` (${info.role})` : "";
  const found = info.sources.length ? info.sources.join(" + ") : "earlier run (vault)";
  return `${info.type}${role} · found by ${found}`;
}

/** The anonymized text the cloud saw, with each known placeholder highlighted. */
export function AnonymizedText({ text, placeholders }: { text: string; placeholders: readonly PlaceholderInfo[] }) {
  const byName = new Map(placeholders.map((p) => [p.placeholder, p]));
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    const info = byName.get(m[0]);
    if (!info) continue;
    if (m.index > last) parts.push(text.slice(last, m.index));
    const nano = info.sources.includes("nano");
    parts.push(
      <mark
        key={m.index}
        title={placeholderTooltip(info)}
        className={`cursor-help rounded px-0.5 ${nano ? "bg-violet-200 text-violet-950" : "bg-amber-200 text-amber-950"}`}
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
