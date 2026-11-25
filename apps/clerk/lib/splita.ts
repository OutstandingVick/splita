"use client";

import { createSplitaWeb, type SplitaWeb } from "@splita/web";
import { getFirebase } from "./firebase";

let instance: SplitaWeb | undefined;

/** App-wide Splita instance (rules + Nano detection, IndexedDB vault, cloud reasoner, Firestore receipts). */
export function getSplita(): SplitaWeb {
  if (!instance) {
    const { ai, auth, firestore } = getFirebase();
    instance = createSplitaWeb({ ai, auth, firestore });
  }
  return instance;
}
