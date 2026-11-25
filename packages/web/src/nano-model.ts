import type { DetectorStatus } from "@splita/core";
import { type AI, getGenerativeModel, InferenceMode } from "firebase/ai";
import { NanoDetector, type NanoDetectorOptions, type TextModel } from "./nano-detector.js";
import { NANO_RESPONSE_SCHEMA } from "./nano-parse.js";

/** Firebase AI Logic hybrid model pinned to Gemini Nano (ONLY_ON_DEVICE) with a JSON response constraint. */
export function createNanoModel(ai: AI): TextModel {
  return getGenerativeModel(ai, {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      },
      promptOptions: { responseConstraint: NANO_RESPONSE_SCHEMA },
    },
  });
}

export function createNanoDetector(model: TextModel, opts?: NanoDetectorOptions): NanoDetector {
  return new NanoDetector(model, opts);
}

/** Call on page load: one trivial ONLY_ON_DEVICE call through Firebase. Never throws. */
export function warmUpNano(detector: NanoDetector): Promise<DetectorStatus> {
  return detector.warmUp();
}
