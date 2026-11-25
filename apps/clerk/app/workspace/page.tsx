"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useDeviceStatus } from "@/components/device-status";
import { AnswerPanel } from "@/components/workspace/answer-panel";
import { DocumentEditor } from "@/components/workspace/document-editor";
import { MatterList } from "@/components/workspace/matter-list";
import { PipelineStrip } from "@/components/workspace/pipeline-strip";
import { SplitView } from "@/components/workspace/split-view";
import { useAsk } from "@/lib/use-ask";
import { useMatters } from "@/lib/use-matters";

function Workspace() {
  const params = useSearchParams();
  const { matters, loaded, selected, select, create, update } = useMatters(params.get("matter"));
  const { online } = useDeviceStatus();
  const { ask, stateFor } = useAsk();
  const state = stateFor(selected?.id);
  const outcome = state.outcome;
  const [showCloud, setShowCloud] = useState(false);

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]">
        <MatterList matters={matters} selectedId={selected?.id ?? null} onSelect={select} onCreate={create} />
      </aside>

      <main className="min-w-0 space-y-5">
        {!loaded ? (
          <div className="h-96 animate-pulse rounded-xl bg-stone-100" />
        ) : selected ? (
          <>
            <input
              aria-label="Matter name"
              value={selected.title}
              onChange={(e) => update(selected.id, { title: e.target.value })}
              className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none focus-visible:outline-2"
            />
            <DocumentEditor
              document={selected.document}
              question={selected.question}
              onDocument={(document) => update(selected.id, { document })}
              onQuestion={(question) => update(selected.id, { question })}
              onAsk={() => void ask(selected.id, selected.document, selected.question, online)}
              busy={state.busy}
              online={online}
            />
            <PipelineStrip progress={state.progress} />
            {outcome?.kind === "answer" && outcome.result.ok && (
              <>
                <AnswerPanel matterId={selected.id} answer={outcome.result.answer} />
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-800">What left this device</h2>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" role="switch" checked={showCloud} onChange={(e) => setShowCloud(e.target.checked)} className="peer sr-only" />
                    <span
                      aria-hidden
                      className="relative h-5 w-9 rounded-full bg-stone-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-accent-600 peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-accent-600"
                    />
                    Show what the cloud saw
                  </label>
                </div>
                {showCloud && (
                  <SplitView
                    localText={outcome.result.localView.text}
                    localSpans={outcome.result.localView.spans}
                    cloudText={outcome.result.cloudView.anonymizedText}
                    placeholders={outcome.result.cloudView.placeholders}
                  />
                )}
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-stone-500">Create a matter to start.</p>
        )}
      </main>
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}
