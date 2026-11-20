"use client";

import {
  type GenerativeModel,
  type LanguageModelCreateOptions,
  getGenerativeModel,
  InferenceMode,
  InferenceSource,
} from "firebase/ai";
import { getFirebase } from "./firebase";

export { InferenceMode, InferenceSource };

/** Mirrors Chrome's LanguageModel.availability() values, plus "unsupported" when the API is absent. */
export type OnDeviceAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

interface ChromeLanguageModel {
  availability(options?: unknown): Promise<string>;
}

function onDeviceIO(): LanguageModelCreateOptions {
  return {
    expectedInputs: [{ type: "text", languages: ["en"] }],
    expectedOutputs: [{ type: "text", languages: ["en"] }],
  };
}

/** Queries Chrome's Prompt API directly; the Firebase SDK has no public availability helper. */
export async function checkOnDeviceAvailability(): Promise<OnDeviceAvailability> {
  const lm = (globalThis as { LanguageModel?: ChromeLanguageModel }).LanguageModel;
  if (!lm) return "unsupported";
  const v = await lm.availability(onDeviceIO());
  switch (v) {
    case "available":
    case "downloadable":
    case "downloading":
    case "unavailable":
      return v;
    default:
      return "unavailable";
  }
}

const models = new Map<InferenceMode, GenerativeModel>();

export function getHybridModel(mode: InferenceMode): GenerativeModel {
  let m = models.get(mode);
  if (!m) {
    m = getGenerativeModel(getFirebase().ai, {
      mode,
      onDeviceParams: { createOptions: onDeviceIO() },
    });
    models.set(mode, m);
  }
  return m;
}

/** Must be called from a user gesture when availability is "downloadable". */
export async function downloadOnDeviceModel(onProgress: (fraction: number) => void): Promise<void> {
  await getHybridModel(InferenceMode.PREFER_ON_DEVICE).initializeDeviceModel(onProgress);
}

export interface HybridResult {
  text: string;
  /** From response.inferenceSource (SDK ≥ 12.5.0). "unknown" if the SDK omits it. */
  source: InferenceSource | "unknown";
  latencyMs: number;
  mode: InferenceMode;
}

export async function runHybrid(mode: InferenceMode, prompt: string): Promise<HybridResult> {
  const model = getHybridModel(mode);
  const t0 = performance.now();
  const result = await model.generateContent(prompt);
  const latencyMs = Math.round(performance.now() - t0);
  return {
    text: result.response.text(),
    source: result.response.inferenceSource ?? "unknown",
    latencyMs,
    mode,
  };
}

/** Maps SDK / browser errors to actionable messages for the spike UI. */
export function describeError(err: unknown): string {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("appcheck") || lower.includes("app-check") || lower.includes("app check")) {
    return `App Check failure. Register the debug token printed in the console (Firebase console → App Check → Apps → Manage debug tokens). Details: ${msg}`;
  }
  if (lower.includes("missing env vars")) return msg;
  if (lower.includes("on-device") || lower.includes("ondevice") || lower.includes("languagemodel")) {
    return `On-device model not usable. Check availability above; download the model or enable Gemini Nano in Chrome (see docs/PHASE0.md). Details: ${msg}`;
  }
  if (lower.includes("api-not-enabled") || lower.includes("permission") || lower.includes("403")) {
    return `Cloud call rejected. Make sure Firebase AI Logic (Gemini Developer API) is enabled for the project. Details: ${msg}`;
  }
  return msg;
}
