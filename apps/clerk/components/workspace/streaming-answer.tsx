import type { ReactNode } from "react";
import { Markdown } from "@/components/markdown";

const PLACEHOLDER_RE = /\b[A-Z]+(?:_[A-Z]+)*_\d+\b/g;

function highlight(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER_RE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <mark key={m.index} className="rounded bg-rules px-0.5 text-rules-ink">
        {m[0]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * Live view while the cloud answer streams. Right: the raw reply exactly as it arrives (stand-ins
 * only). Left: the same text restored on this device, one complete placeholder at a time.
 */
export function StreamingAnswer({ cloud, restored }: { cloud: string; restored: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-live="off">
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Answer</h2>
          <span className="flex items-center gap-1.5 text-xs text-accent-700">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-600" />
            Restoring on this device
          </span>
        </header>
        <div className="max-h-[28rem] overflow-auto px-4 py-3">
          <Markdown text={restored} />
        </div>
      </section>
      <section className="min-w-0 rounded-xl border border-stone-200 bg-white">
        <header className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold">Cloud&apos;s view</h2>
          <span className="text-xs text-stone-500">Streaming · stand-ins only</span>
        </header>
        <pre data-testid="cloud-stream" className="max-h-[28rem] overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-[12.5px] leading-relaxed text-stone-700">
          {highlight(cloud)}
          <span aria-hidden className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-stone-400 align-middle" />
        </pre>
      </section>
    </div>
  );
}
