import type { DetectorStatus } from "@splita/core";
import { NanoDetector, type NanoDetectorOptions } from "./nano-detector.js";
import { NanoSession } from "./nano-session.js";

/** Nano detector on one warm Prompt API session (see nano-session.ts for why not the Firebase adapter). */
export function createNanoDetector(opts?: NanoDetectorOptions, session = new NanoSession()): NanoDetector {
  return new NanoDetector(session, opts);
}

/** Call on page load: creates the warm base session. Never throws. */
export function warmUpNano(detector: NanoDetector): Promise<DetectorStatus> {
  return detector.warmUp();
}
