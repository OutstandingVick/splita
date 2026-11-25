import type { DetectorStatus } from "@splita/core";

export type NanoState = DetectorStatus | "warming";

export interface DeviceBadge {
  tone: "ready" | "rules" | "offline" | "pending";
  label: string;
  detail: string;
}

/** What the header says about the device. Offline wins: nothing can be sent anyway. */
export function deviceBadge(nano: NanoState, online: boolean): DeviceBadge {
  if (!online) {
    return { tone: "offline", label: "Offline", detail: "Detection still runs on this device. Asking the cloud is paused, so nothing leaves the device." };
  }
  if (nano === "warming" || nano === "idle") {
    return { tone: "pending", label: "Checking on-device model…", detail: "Loading Gemini Nano through Firebase AI Logic." };
  }
  if (nano === "ready") {
    return { tone: "ready", label: "On-device: Gemini Nano ready", detail: "Names are found by rules and Gemini Nano, on this device." };
  }
  const why = nano === "unavailable" ? "Gemini Nano isn't available in this browser" : nano === "timeout" ? "Gemini Nano timed out" : "Gemini Nano failed to load";
  return { tone: "rules", label: "Rules-only mode", detail: `${why}. Identities are still detected on this device by rules.` };
}
