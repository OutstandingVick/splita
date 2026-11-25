"use client";

import type { DetectorStatus } from "@splita/core";
import type { SplitaRunResult } from "@splita/web";
import { useEffect, useState } from "react";
import { EMPLOYMENT_FIXTURE, EMPLOYMENT_QUESTION } from "@/lib/fixtures";
import { getSplita } from "@/lib/splita";

const WORKSPACE = "pipeline-test";

function Block({ title, children, tone = "plain" }: { title: string; children: string; tone?: "plain" | "cloud" | "local" }) {
  const toneClass =
    tone === "cloud" ? "border-amber-300 bg-amber-50" : tone === "local" ? "border-emerald-300 bg-emerald-50" : "border-neutral-200 bg-neutral-50";
  return (
    <section className="space-y-1">
      <h2 className="text-sm font-medium text-neutral-700">{title}</h2>
      <pre className={`max-h-96 overflow-auto whitespace-pre-wrap rounded border p-3 text-xs ${toneClass}`}>{children}</pre>
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

  useEffect(() => {
    try {
      const splita = getSplita();
      void splita.warmUpNano().then(setWarmUp);
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
          </p>

          {result.ok ? (
            <>
              <table className="text-left font-mono text-xs">
                <tbody>
                  {Object.entries(result.receipt.timings).map(([stage, ms]) => (
                    <tr key={stage}>
                      <td className="pr-6 text-neutral-500">{stage}</td>
                      <td>{Math.round(ms)} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="grid gap-4 md:grid-cols-2">
                <Block title="What the cloud saw (anonymized)" tone="cloud">
                  {result.cloudView.anonymizedText}
                </Block>
                <Block title="Raw cloud answer" tone="cloud">
                  {result.cloudView.cloudAnswer}
                </Block>
              </div>
              <Block title="Restored answer (on this device)" tone="local">
                {result.answer}
              </Block>
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
