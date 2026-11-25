"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useDeviceStatus } from "@/components/device-status";
import { AnswerPanel } from "@/components/workspace/answer-panel";
import { DocumentEditor } from "@/components/workspace/document-editor";
import { MatterList } from "@/components/workspace/matter-list";
import { PipelineStrip } from "@/components/workspace/pipeline-strip";
import { useAsk } from "@/lib/use-ask";
import { useMatters } from "@/lib/use-matters";

function Workspace() {
  const params = useSearchParams();
  const { matters, loaded, selected, select, create, update } = useMatters(params.get("matter"));
  const { online } = useDeviceStatus();
  const { ask, stateFor } = useAsk();
  const state = stateFor(selected?.id);
  const outcome = state.outcome;

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
              <AnswerPanel matterId={selected.id} answer={outcome.result.answer} />
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
