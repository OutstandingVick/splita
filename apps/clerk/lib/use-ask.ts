"use client";

import type { PreviewResult } from "@splita/core";
import type { SplitaRunResult } from "@splita/web";
import { useCallback, useRef, useState } from "react";
import { applyCloudAttempt, applyStage, initialProgress, markSkipped, previewProgress, type Progress } from "./pipeline-progress";
import { getSplita } from "./splita";

export type Outcome =
  | { kind: "answer"; result: SplitaRunResult }
  | { kind: "preview"; preview: PreviewResult }
  | { kind: "setup-error"; message: string };

export interface AskState {
  busy: boolean;
  progress: Progress;
  outcome: Outcome | null;
  /** While the cloud answer streams: anonymized text so far, and its on-device restoration. */
  stream: { cloud: string; restored: string } | null;
}

const EMPTY: AskState = { busy: false, progress: initialProgress(), outcome: null, stream: null };

/** Runs the private pipeline for one matter, streaming stage progress. Offline: preview only. */
export function useAsk() {
  const [byMatter, setByMatter] = useState<Record<string, AskState>>({});
  const runIds = useRef(new Map<string, number>());

  const patch = useCallback((matterId: string, f: (s: AskState) => AskState) => {
    setByMatter((all) => ({ ...all, [matterId]: f(all[matterId] ?? EMPTY) }));
  }, []);

  const ask = useCallback(
    /** `slot` keeps a separate result for the same matter (e.g. the extraction probe). */
    async (matterId: string, text: string, question: string, online: boolean, slot: string = matterId) => {
      const id = (runIds.current.get(slot) ?? 0) + 1;
      runIds.current.set(slot, id);
      patch(slot, () => ({ ...EMPTY, busy: true, progress: initialProgress() }));
      try {
        const splita = getSplita();
        if (!online) {
          const preview = await splita.preview({ workspaceId: matterId, text, question });
          patch(slot, () => ({ ...EMPTY, progress: previewProgress(), outcome: { kind: "preview", preview } }));
          return;
        }
        const result = await splita.run({
          workspaceId: matterId,
          text,
          question,
          onStage: (e) => patch(slot, (s) => ({ ...s, progress: applyStage(s.progress, e) })),
          onCloudAttempt: (a) => patch(slot, (s) => ({ ...s, progress: applyCloudAttempt(s.progress, a) })),
          onAnswer: (partial) => patch(slot, (s) => ({ ...s, stream: partial.cloud ? partial : null })),
        });
        if (id !== runIds.current.get(slot)) return;
        patch(slot, (s) => ({ busy: false, progress: markSkipped(s.progress), outcome: { kind: "answer", result }, stream: null }));
      } catch (e) {
        patch(slot, (s) => ({ ...s, busy: false, stream: null, outcome: { kind: "setup-error", message: e instanceof Error ? e.message : String(e) } }));
      }
    },
    [patch],
  );

  const stateFor = (matterId: string | undefined): AskState =>
    (matterId && byMatter[matterId]) || EMPTY;

  return { ask, stateFor };
}
