"use client";

import { findPublicTerms } from "@splita/core";
import type { ReactNode } from "react";
import { useRef } from "react";
import { Markdown, renderInline } from "@/components/markdown";
import { SourceBadge, useQuickExplain } from "@/components/quick-explain";
import { getSplita } from "@/lib/splita";

/** Inline renderer that makes courts, agencies and statutes clickable for Quick explain. */
function termInline(onPick: (term: string) => void) {
  return (text: string): ReactNode[] =>
    renderInline(text).flatMap((node, i) => {
      if (typeof node !== "string") return [node];
      const out: ReactNode[] = [];
      let last = 0;
      for (const t of findPublicTerms(node)) {
        if (t.start > last) out.push(node.slice(last, t.start));
        out.push(
          <button
            key={`${i}-${t.start}`}
            type="button"
            onClick={() => onPick(t.text)}
            title="Quick explain"
            className="underline decoration-accent-600/50 decoration-dotted underline-offset-4 hover:bg-accent-50"
          >
            {t.text}
          </button>,
        );
        last = t.end;
      }
      if (last < node.length) out.push(node.slice(last));
      return out;
    });
}

export function AnswerPanel({ matterId, answer }: { matterId: string; answer: string }) {
  const explain = useQuickExplain((term) => getSplita().explain(matterId, term));
  const boxRef = useRef<HTMLDivElement>(null);
  const st = explain.state;

  function explainSelection() {
    const sel = window.getSelection();
    const picked = sel?.toString().trim();
    if (!picked || !boxRef.current?.contains(sel?.anchorNode ?? null)) {
      explain.fail("Select a term in the answer first.");
      return;
    }
    explain.pick(picked);
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white" aria-labelledby="answer-h">
      <div className="flex items-center justify-between border-b border-stone-100 px-6 py-3">
        <h2 id="answer-h" className="text-sm font-semibold text-stone-800">
          Answer <span className="font-normal text-stone-500">· restored on this device</span>
        </h2>
        <button type="button" onClick={explainSelection} className="rounded-md px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50">
          Explain selection
        </button>
      </div>
      <div ref={boxRef} className="px-6 py-5">
        <Markdown text={answer} inline={termInline(explain.pick)} />
      </div>
      <p className="border-t border-stone-100 px-6 py-2.5 text-xs text-stone-500" data-testid="legal-disclaimer">
        AI assistance, not legal advice. Confirm with a qualified lawyer.
      </p>
      <div className="min-h-14 border-t border-stone-100 bg-stone-50/60 px-6 py-3 text-sm" aria-live="polite">
        {st.status === "idle" && (
          <p className="text-xs text-stone-500">
            Click an underlined legal term, or select one, for a quick explanation. It runs on Gemini Nano when available (Firebase AI Logic
            PREFER_ON_DEVICE), and text containing a client identity is never sent.
          </p>
        )}
        {st.status === "loading" && <p className="text-stone-500">Explaining “{st.term}”…</p>}
        {st.status === "error" && (
          <p role="alert" className="text-stone-700">
            {st.message}
          </p>
        )}
        {st.status === "done" && (
          <div className="space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {st.result.term} <SourceBadge source={st.result.source} />
              <span className="font-mono text-xs font-normal text-stone-500">{st.result.latencyMs} ms</span>
            </p>
            <p className="leading-relaxed text-stone-700">{st.result.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}
