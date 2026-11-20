"use client";

import { useCallback, useEffect, useState } from "react";
import {
  checkOnDeviceAvailability,
  describeError,
  downloadOnDeviceModel,
  type HybridResult,
  InferenceMode,
  InferenceSource,
  type OnDeviceAvailability,
  runHybrid,
} from "@/lib/hybrid";

const AVAILABILITY_HELP: Record<OnDeviceAvailability, string> = {
  available: "Gemini Nano is ready in this browser.",
  downloadable: "Supported, but the model must be downloaded. Click Download (needs a user gesture).",
  downloading: "Model is downloading. Wait, then refresh status.",
  unavailable: "This device or browser can't run Gemini Nano (hardware, disk space, or flags).",
  unsupported: "window.LanguageModel is missing. Use Chrome desktop with the Prompt API enabled.",
};

const BUTTONS: { label: string; mode: InferenceMode }[] = [
  { label: "Run ON-DEVICE only", mode: InferenceMode.ONLY_ON_DEVICE },
  { label: "Run CLOUD only", mode: InferenceMode.ONLY_IN_CLOUD },
  { label: "Run PREFER_ON_DEVICE", mode: InferenceMode.PREFER_ON_DEVICE },
];

function sourceLabel(s: HybridResult["source"]): string {
  if (s === InferenceSource.ON_DEVICE) return "on-device";
  if (s === InferenceSource.IN_CLOUD) return "cloud";
  return "unknown";
}

export default function SpikePage() {
  const [availability, setAvailability] = useState<OnDeviceAvailability | "checking">("checking");
  const [download, setDownload] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("In one sentence, what is a privacy receipt?");
  const [busy, setBusy] = useState<InferenceMode | null>(null);
  const [result, setResult] = useState<HybridResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAvailability("checking");
    try {
      setAvailability(await checkOnDeviceAvailability());
    } catch (e) {
      setAvailability("unavailable");
      setError(describeError(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onDownload() {
    setError(null);
    setDownload(0);
    try {
      await downloadOnDeviceModel((f) => setDownload(f));
      await refresh();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setDownload(null);
    }
  }

  async function onRun(mode: InferenceMode) {
    setBusy(mode);
    setError(null);
    setResult(null);
    try {
      setResult(await runHybrid(mode, prompt));
    } catch (e) {
      console.error(e);
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold">Phase 0 spike: hybrid inference</h1>

      <section className="rounded border border-neutral-200 p-4">
        <h2 className="font-medium">On-device status</h2>
        <p className="mt-1 font-mono text-sm" data-testid="availability">
          {availability}
        </p>
        {availability !== "checking" && (
          <p className="mt-1 text-sm text-neutral-600">{AVAILABILITY_HELP[availability]}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void refresh()}>
            Refresh status
          </button>
          {(availability === "downloadable" || availability === "downloading") && (
            <button
              className="rounded border px-3 py-1 text-sm"
              disabled={download !== null}
              onClick={() => void onDownload()}
            >
              {download === null ? "Download model" : `Downloading ${Math.round(download * 100)}%`}
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <textarea
          className="h-28 w-full rounded border border-neutral-300 p-2 font-mono text-sm"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {BUTTONS.map((b) => (
            <button
              key={b.mode}
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              disabled={busy !== null || !prompt.trim()}
              onClick={() => void onRun(b.mode)}
            >
              {busy === b.mode ? "Running…" : b.label}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <section className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </section>
      )}

      {result && (
        <section className="space-y-2 rounded border border-neutral-200 p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-neutral-500">mode</dt>
            <dd className="font-mono">{result.mode}</dd>
            <dt className="text-neutral-500">source</dt>
            <dd className="font-mono" data-testid="source">
              {sourceLabel(result.source)} ({result.source})
            </dd>
            <dt className="text-neutral-500">latency</dt>
            <dd className="font-mono">{result.latencyMs} ms</dd>
          </dl>
          <pre className="whitespace-pre-wrap rounded bg-neutral-50 p-3 text-sm">{result.text}</pre>
        </section>
      )}
    </main>
  );
}
