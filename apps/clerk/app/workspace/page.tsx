"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useDeviceStatus } from "@/components/device-status";
import { AnswerPanel } from "@/components/workspace/answer-panel";
import { DocumentEditor } from "@/components/workspace/document-editor";
import { ExtractionProbe, PROBE_QUESTION } from "@/components/workspace/extraction-probe";
import { FailureNotice } from "@/components/workspace/failure-notice";
import { MatterList } from "@/components/workspace/matter-list";
import { ReceiptCard } from "@/components/workspace/receipt-card";
import { VerifyButton } from "@/components/workspace/verify-button";
import { HybridLine } from "@/components/workspace/hybrid-line";
import { StreamingAnswer } from "@/components/workspace/streaming-answer";
import { PipelineStrip } from "@/components/workspace/pipeline-strip";
import { SplitView } from "@/components/workspace/split-view";
import { DEMO_MATTER_ID, demoMatter } from "@/lib/matters";
import { getSplita } from "@/lib/splita";
import { nanoOnly } from "@/lib/hybrid-summary";
import { useAsk } from "@/lib/use-ask";
import { useMatters } from "@/lib/use-matters";

function NanoChip({ count, onShow }: { count: number; onShow: () => void }) {
  if (count === 0) {
    return <p className="text-xs text-stone-500">Gemini Nano checked the text and found nothing the rules had missed.</p>;
  }
  return (
    <button
      type="button"
      onClick={onShow}
      data-testid="nano-chip"
      className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-nano px-3 py-1 text-xs font-medium text-nano-ink hover:border-violet-300"
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-violet-600" />
      Gemini Nano caught {count} {count === 1 ? "identity" : "identities"} rules missed
      <span aria-hidden>→</span>
    </button>
  );
}

function Workspace() {
  const params = useSearchParams();
  const { matters, loaded, selected, select, create, update, remove } = useMatters(params.get("matter"));
  const { online } = useDeviceStatus();
  const { ask, stateFor } = useAsk();
  const state = stateFor(selected?.id);
  const outcome = state.outcome;
  const [showCloud, setShowCloud] = useState(false);
  const [focusNano, setFocusNano] = useState(0);

  // Fetch the matter's latest receipt ahead of time so the Receipt stage is a single write.
  useEffect(() => {
    if (selected?.id && online) void getSplita().warmUpCloud(selected.id);
  }, [selected?.id, online]);

  /** Deleting a matter also erases its identity vault from this device. The demo resets instead. */
  async function discard(id: string) {
    const demo = id === DEMO_MATTER_ID;
    const msg = demo
      ? "Reset the demo matter? Its text is restored and its identity vault on this device is cleared."
      : "Delete this matter? Its document, question and identity vault are erased from this device. Receipts in Firestore stay.";
    if (!window.confirm(msg)) return;
    await getSplita().vault.clearWorkspace(id);
    if (demo) {
      const d = demoMatter();
      update(id, { title: d.title, document: d.document, question: d.question });
    } else remove(id);
  }

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
            <div className="flex items-center gap-3">
              <input
                aria-label="Matter name"
                value={selected.title}
                onChange={(e) => update(selected.id, { title: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-2xl font-semibold tracking-tight outline-none focus-visible:outline-2"
              />
              <button
                type="button"
                onClick={() => void discard(selected.id)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800"
              >
                {selected.id === DEMO_MATTER_ID ? "Reset demo" : "Delete matter"}
              </button>
            </div>
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
              <HybridLine mode={outcome.result.mode} inferenceSource={outcome.result.receipt.inferenceSource} cloudModel={outcome.result.receipt.cloudModel} />
            )}
            {state.busy && state.stream && <StreamingAnswer cloud={state.stream.cloud} restored={state.stream.restored} />}
            {state.busy && !state.stream && (
              <section aria-hidden className="rounded-xl border border-stone-200 bg-white p-6">
                <div className="h-4 w-40 animate-pulse rounded bg-stone-100" />
                <div className="mt-5 space-y-2.5">
                  {[92, 85, 96, 70, 88, 60].map((w) => (
                    <div key={w} className="h-3 animate-pulse rounded bg-stone-100" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <p className="mt-6 text-xs text-stone-500">The cloud only sees stand-ins. Real values are restored here when the answer arrives.</p>
              </section>
            )}
            {outcome?.kind === "answer" && !outcome.result.ok && <FailureNotice stage={outcome.result.stage} error={outcome.result.error} />}
            {outcome?.kind === "setup-error" && <FailureNotice stage="detect" error={{ message: outcome.message }} />}
            {outcome?.kind === "preview" && (
              <>
                <div role="status" className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700">
                  <strong className="font-semibold">Offline preview. Nothing was sent.</strong> Detection ran on this device; this is exactly
                  what the cloud would receive once you&apos;re back online and press Ask privately.
                </div>
                <SplitView
                  localText={outcome.preview.localView.text}
                  localSpans={outcome.preview.localView.spans}
                  cloudText={outcome.preview.anonymizedText}
                  placeholders={outcome.preview.placeholders}
                />
              </>
            )}
            {outcome?.kind === "answer" && outcome.result.ok && (
              <>
                {outcome.result.mode === "rules+nano" && <NanoChip count={nanoOnly(outcome.result.cloudView.placeholders).length} onShow={() => {
                  setShowCloud(true);
                  setFocusNano((n) => n + 1);
                }} />}
                <AnswerPanel matterId={selected.id} answer={outcome.result.answer} />
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-800">What left this device</h2>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showCloud}
                    onClick={() => setShowCloud((v) => !v)}
                    className="flex items-center gap-2 rounded-full text-sm text-stone-700"
                  >
                    <span aria-hidden className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${showCloud ? "bg-accent-600" : "bg-stone-300"}`}>
                      <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${showCloud ? "translate-x-4" : "translate-x-0.5"}`} />
                    </span>
                    Show what the cloud saw
                  </button>
                </div>
                {showCloud && (
                  <SplitView
                    localText={outcome.result.localView.text}
                    localSpans={outcome.result.localView.spans}
                    cloudText={outcome.result.cloudView.anonymizedText}
                    placeholders={outcome.result.cloudView.placeholders}
                    focusNano={focusNano}
                  />
                )}
                {selected.id === DEMO_MATTER_ID && (
                  <ExtractionProbe
                    state={stateFor(`${selected.id}#probe`)}
                    online={online}
                    onRun={() => void ask(selected.id, selected.document, PROBE_QUESTION, online, `${selected.id}#probe`)}
                  />
                )}
                <ReceiptCard
                  key={outcome.result.receipt.id}
                  receipt={outcome.result.receipt}
                  mode={outcome.result.mode}
                  verify={<VerifyButton key={outcome.result.receipt.id} receipt={outcome.result.receipt} payload={outcome.result.cloudView.anonymizedText} />}
                />
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
