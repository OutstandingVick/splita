"use client";

import { createSplitaWeb, type SplitaWeb } from "@splita/web";
import { getFirebase } from "./firebase";

let instance: SplitaWeb | undefined;

/** App-wide Splita instance (rules + Nano detection, IndexedDB vault, cloud reasoner, Firestore receipts). */
export function getSplita(): SplitaWeb {
  if (!instance) {
    const { ai, auth, firestore } = getFirebase();
    const cloudModel = process.env.NEXT_PUBLIC_CLOUD_MODEL;
    const fallbackCloudModel = process.env.NEXT_PUBLIC_FALLBACK_CLOUD_MODEL;
    instance = createSplitaWeb({
      ai,
      auth,
      firestore,
      ...(cloudModel ? { cloudModel } : {}),
      // "none" disables the fallback.
      ...(fallbackCloudModel ? { fallbackCloudModel: fallbackCloudModel === "none" ? false : fallbackCloudModel } : {}),
    });
  }
  return instance;
}
