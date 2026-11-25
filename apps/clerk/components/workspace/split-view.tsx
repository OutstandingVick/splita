"use client";

import type { PlaceholderInfo, SourceSpan } from "@splita/core";
import type { ReactNode } from "react";
import { placeholderTooltip } from "@/components/anonymized-text";

const PLACEHOLDER_RE = /\b[A-Z]+(?:_[A-Z]+)*_\d+\b/g;

function markClass(info: PlaceholderInfo | undefined): string {
  return info?.sources.includes("nano") ? "bg-nano text-nano-ink" : "bg-rules text-rules-ink";
}

export interface SplitViewProps {
  localText: string;
  localSpans: readonly SourceSpan[];
  cloudText: string;
  placeholders: readonly PlaceholderInfo[];
  hovered?: string | null;
  onHover?: (placeholder: string | null) => void;
}

/** Your view: the original text with each identity marked (on this device only). */
function LocalPane({ localText, localSpans, placeholders, hovered }: SplitViewProps) {
  const info = new Map(placeholders.map((p) => [p.placeholder, p]));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const s of localSpans) {
    if (s.start < last) continue;
    if (s.start > last) parts.push(localText.slice(last, s.start));
    const active = hovered === s.placeholder;
    parts.push(
      <mark
        key={s.start}
        data-placeholder={s.placeholder}
        className={`rounded px-0.5 transition-colors ${active ? `${markClass(info.get(s.placeholder))} ring-2 ring-stone-900/70` : "bg-stone-100 text-stone-900"}`}
      >
        {localText.slice(s.start, s.end)}
      </mark>,
    );
    last = s.end;
  }
  if (last < localText.length) parts.push(localText.slice(last));
  return <>{parts}</>;
}

/** Cloud's view: exactly the payload sent, placeholders coloured by detector. */
function CloudPane({ cloudText, placeholders, hovered, onHover }: SplitViewProps) {
  const info = new Map(placeholders.map((p) => [p.placeholder, p]));
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of cloudText.matchAll(PLACEHOLDER_RE)) {
    const p = info.get(m[0]);
    if (!p) continue;
    if (m.index > last) parts.push(cloudText.slice(last, m.index));
    parts.push(
      <mark
        key={m.index}
        tabIndex={0}
        title={placeholderTooltip(p)}
        onMouseEnter={() => onHover?.(m[0])}
        onMouseLeave={() => onHover?.(null)}
        onFocus={() => onHover?.(m[0])}
        onBlur={() => onHover?.(null)}
        className={`cursor-help rounded px-0.5 ${markClass(p)} ${hovered === m[0] ? "ring-2 ring-stone-900/70" : ""}`}
      >
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < cloudText.length) parts.push(cloudText.slice(last));
  return <>{parts}</>;
}

export function SplitView(props: SplitViewProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="your-view-h" className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h3 id="your-view-h" className="text-sm font-semibold">
            Your view
          </h3>
          <span className="text-xs text-accent-700">Real names · never leaves this device</span>
        </header>
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-relaxed text-stone-700">
          <LocalPane {...props} />
        </pre>
      </section>
      <section aria-labelledby="cloud-view-h" className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h3 id="cloud-view-h" className="text-sm font-semibold">
            Cloud&apos;s view
          </h3>
          <span className="flex items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-rules" /> rules
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-nano" /> Gemini Nano
            </span>
          </span>
        </header>
        <pre data-testid="cloud-payload" className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-4 font-mono text-[12.5px] leading-relaxed text-stone-700">
          <CloudPane {...props} />
        </pre>
      </section>
    </div>
  );
}
