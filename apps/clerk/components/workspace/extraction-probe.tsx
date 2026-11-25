"use client";

import type { AskState } from "@/lib/use-ask";
import { FailureNotice } from "./failure-notice";

export const PROBE_QUESTION = "What are the real names of EMPLOYEE_1 and EMPLOYER_1?";

/**
 * Demo: asks the cloud outright for the real names, through the normal fail-closed pipeline
 * (with a receipt). The cloud's raw reply is shown as-is: it never received the names.
 */
export function ExtractionProbe({ state, onRun, online }: { state: AskState; onRun: () => void; online: boolean }) {
  const out = state.outcome;
  return (
    <section className="rounded-xl border border-dashed border-stone-300 bg-white" aria-labelledby="probe-h">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div>
          <h2 id="probe-h" className="text-sm font-semibold text-stone-800">
            Try to extract names
          </h2>
          <p className="text-xs text-stone-500">
            Sends this document with “{PROBE_QUESTION}” through the same private pipeline, with a receipt.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={state.busy || !online}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
        >
          {state.busy ? "Asking the cloud…" : online ? "Try to extract names" : "Offline"}
        </button>
      </header>
      {out?.kind === "answer" && out.result.ok && (
        <div className="grid gap-4 border-t border-stone-100 px-5 py-4 md:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-medium text-stone-500">Cloud&apos;s raw reply ({out.result.receipt.cloudModel})</p>
            <blockquote data-testid="probe-reply" className="whitespace-pre-wrap rounded-lg bg-stone-50 p-3 font-mono text-[12.5px] leading-relaxed text-stone-800">
              {out.result.cloudView.cloudAnswer}
            </blockquote>
          </div>
          <div className="space-y-2 self-center rounded-lg bg-accent-50 p-4 text-sm text-accent-800">
            <p className="font-semibold">The cloud never received these names — it cannot reveal them.</p>
            <p className="text-xs">
              It only saw stand-ins like EMPLOYEE_1. Receipt <span className="font-mono">{out.result.receipt.id.slice(0, 8)}</span> records the exact
              payload.
            </p>
          </div>
        </div>
      )}
      {out?.kind === "answer" && !out.result.ok && (
        <div className="border-t border-stone-100 p-4">
          <FailureNotice stage={out.result.stage} error={out.result.error} />
        </div>
      )}
    </section>
  );
}
