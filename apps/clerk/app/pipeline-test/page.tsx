"use client";

import type { DetectorStatus } from "@splita/core";
import type { SplitaRunResult } from "@splita/web";
import { useEffect, useRef, useState } from "react";
import { AnonymizedText } from "@/components/anonymized-text";
import { Markdown } from "@/components/markdown";
import { placeholderInline, QuickExplainPanel, useQuickExplain } from "@/components/quick-explain";
import { EMPLOYMENT_FIXTURE, EMPLOYMENT_QUESTION } from "@/lib/fixtures";
import { getSplita } from "@/lib/splita";

const WORKSPACE = "pipeline-test";

type Tone = "plain" | "cloud" | "local";
const TONE: Record<Tone, string> = {
  cloud: "border-amber-300 bg-amber-50",
  local: "border-emerald-300 bg-emerald-50",
  plain: "border-neutral-200 bg-neutral-50",
};

function Block({ title, children, tone = "plain" }: { title: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-medium text-neutral-700">{title}</h2>
      <pre className={`max-h-96 overflow-auto whitespace-pre-wrap rounded border p-3 text-xs ${TONE[tone]}`}>{children}</pre>
    </section>
  );
}

function MarkdownBlock({
  title,
  text,
  tone,
  inline,
  innerRef,
}: {
  title: string;
  text: string;
  tone: Tone;
  inline?: (t: string) => React.ReactNode[];
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-medium text-neutral-700">{title}</h2>
      <div ref={innerRef} className={`max-h-[32rem] overflow-auto rounded border p-4 ${TONE[tone]}`}>
        <Markdown text={text} {...(inline ? { inline } : {})} />
      </div>
    </section>
  );
}

export default function PipelineTestPage() {
  const [warmUp, setWarmUp] = useState<DetectorStatus | "warming">("warming");
  const [uid, setUid] = useState<string | null>(null);
  const [text, setText] = useState(EMPLOYMENT_FIXTURE);
  const [question, setQuestion] = useState(EMPLOYMENT_QUESTION);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SplitaRunResult | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const cloudAnswerRef = useRef<HTMLDivElement>(null);
  const explain = useQuickExplain((term) => getSplita().explain(WORKSPACE, term));

  // Only text selected inside the anonymized cloud answer may be explained.
  function explainSelection() {
    const sel = window.getSelection();
    const box = cloudAnswerRef.current;
    const picked = sel?.toString().trim();
    if (!sel || !box || !picked || !sel.anchorNode || !box.contains(sel.anchorNode) || !box.contains(sel.focusNode)) {
      explain.fail("Select a term inside the raw cloud answer first. Only anonymized text can be explained.");
      return;
    }
    explain.pick(picked);
  }

  useEffect(() => {
    try {
      const splita = getSplita();
      void splita.warmUpNano().then((status) => {
        setWarmUp(status);
        if (status !== "ready") console.warn(`[splita] Nano warm-up ${status}: ${splita.nanoError ?? "no detail"}`);
      });
      splita.signIn().then(setUid, (e: unknown) => setSetupError(`Anonymous sign-in failed: ${String(e)}`));
    } catch (e) {
      setSetupError(String(e));
      setWarmUp("unavailable");
    }
  }, []);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      setResult(await getSplita().run({ workspaceId: WORKSPACE, text, question }));
    } catch (e) {
      setSetupError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function resetVault() {
    await getSplita().vault.clearWorkspace(WORKSPACE);
    setResult(null);
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Pipeline test</h1>
        <p className="text-sm text-neutral-600">
          detect (rules + Nano) → pseudonymize → cloud → restore → receipt. Workspace <code>{WORKSPACE}</code>.
        </p>
        <p className="font-mono text-xs text-neutral-500">
          Nano warm-up: <span data-testid="warmup">{warmUp}</span> · uid: {uid ?? "signing in…"}
        </p>
      </header>

      {setupError && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {setupError}
        </p>
      )}

      <section className="grid gap-3">
        <label className="text-sm font-medium">
          Question
          <input
            className="mt-1 w-full rounded border border-neutral-300 p-2 text-sm font-normal"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium">
          Document
          <textarea
            className="mt-1 h-64 w-full rounded border border-neutral-300 p-2 font-mono text-xs font-normal"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={busy || !text.trim()}
            onClick={() => void run()}
          >
            {busy ? "Running…" : "Run pipeline"}
          </button>
          <button className="rounded border px-4 py-2 text-sm" onClick={() => void resetVault()}>
            Reset vault
          </button>
        </div>
      </section>

      {result && (
        <div className="space-y-4">
          <p className="font-mono text-sm">
            mode: <strong data-testid="mode">{result.mode}</strong> · nano: {result.nanoStatus}
            {result.nanoError ? ` (${result.nanoError})` : ""}
            {result.nanoRun && (
              <>
                {" "}· nano pass: <strong data-testid="nano-run">{result.nanoRun.warm ? "warm" : "cold"}</strong> {result.nanoRun.ms} ms, {result.nanoRun.prompted}/
                {result.nanoRun.chunks} chunk{result.nanoRun.chunks === 1 ? "" : "s"} prompted
                {result.nanoRun.prompted === 0 ? " (rules covered every name)" : ""}
              </>
            )}
          </p>

          {result.ok ? (
            <>
              <table className="text-left font-mono text-xs">
                <tbody>
                  {Object.entries(result.receipt.timings).map(([stage, ms]) => (
                    <tr key={stage}>
                      <td className="pr-6 text-neutral-500">{stage}</td>
                      <td className="text-right">{Math.round(ms)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid gap-4 md:grid-cols-2">
                <Block title="What the cloud saw (anonymized) · hover a placeholder: amber = rules, violet = Nano" tone="cloud">
                  <AnonymizedText text={result.cloudView.anonymizedText} placeholders={result.cloudView.placeholders} />
                </Block>
                <MarkdownBlock
                  title="Raw cloud answer"
                  tone="cloud"
                  text={result.cloudView.cloudAnswer}
                  inline={placeholderInline(explain.pick)}
                  innerRef={cloudAnswerRef}
                />
              </div>
              <QuickExplainPanel state={explain.state} onExplainSelection={explainSelection} />
              <MarkdownBlock title="Restored answer (on this device)" tone="local" text={result.answer} />
              <Block title="Receipt (written to Firestore)">{JSON.stringify(result.receipt, null, 2)}</Block>
            </>
          ) : (
            <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              Failed closed at <strong>{result.stage}</strong>: {result.error.message}
            </p>
          )}
        </div>
      )}
    </main>
  );
}
