"use client";

import type { Explanation } from "@splita/web";
import { type ReactNode, useState } from "react";
import { renderInline } from "./markdown";

const PLACEHOLDER_RE = /\b[A-Z]+(?:_[A-Z]+)*_\d+\b/g;

/** Badge showing where Firebase AI Logic ran the request. */
export function SourceBadge({ source }: { source: Explanation["source"] }) {
  const onDevice = source === "on_device";
  return (
    <span
      data-testid="explain-source"
      className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${onDevice ? "bg-emerald-600 text-white" : "bg-sky-600 text-white"}`}
    >
      {onDevice ? "on-device · Gemini Nano" : "cloud · Gemini"}
    </span>
  );
}

/** Markdown inline renderer that turns placeholders into Quick explain buttons. */
export function placeholderInline(onPick: (term: string) => void) {
  return (text: string): ReactNode[] =>
    renderInline(text).flatMap((node, i) => {
      if (typeof node !== "string") return [node];
      const out: ReactNode[] = [];
      let last = 0;
      for (const m of node.matchAll(PLACEHOLDER_RE)) {
        if (m.index > last) out.push(node.slice(last, m.index));
        out.push(
          <button
            key={`${i}-${m.index}`}
            type="button"
            title="Quick explain this placeholder type"
            onClick={() => onPick(m[0])}
            className="rounded bg-amber-200 px-0.5 font-mono text-[0.9em] text-amber-950 hover:bg-amber-300"
          >
            {m[0]}
          </button>,
        );
        last = m.index + m[0].length;
      }
      if (last < node.length) out.push(node.slice(last));
      return out;
    });
}

export type ExplainState = { status: "idle" } | { status: "loading"; term: string } | { status: "done"; result: Explanation } | { status: "error"; message: string };

export function useQuickExplain(explain: (term: string) => Promise<Explanation>) {
  const [state, setState] = useState<ExplainState>({ status: "idle" });
  const pick = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setState({ status: "loading", term: t });
    explain(t).then(
      (result) => setState({ status: "done", result }),
      (e: unknown) => setState({ status: "error", message: e instanceof Error ? e.message : String(e) }),
    );
  };
  const fail = (message: string) => setState({ status: "error", message });
  return { state, pick, fail };
}

export function QuickExplainPanel({ state, onExplainSelection }: { state: ExplainState; onExplainSelection: () => void }) {
  return (
    <section className="space-y-2 rounded border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-medium">Quick explain</h2>
        <span className="text-xs text-neutral-500">
          Firebase AI Logic <code>PREFER_ON_DEVICE</code>: click a placeholder in the cloud answer, or select a term there.
        </span>
        <button type="button" onClick={onExplainSelection} className="ml-auto rounded border px-3 py-1 text-xs">
          Explain selection
        </button>
      </div>
      {state.status === "loading" && <p className="text-sm text-neutral-500">Explaining “{state.term}”…</p>}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            “{state.result.term}” <SourceBadge source={state.result.source} />
            <span className="font-mono text-xs font-normal text-neutral-500">{state.result.latencyMs} ms</span>
          </p>
          <p className="text-sm leading-relaxed">{state.result.text}</p>
        </div>
      )}
    </section>
  );
}
