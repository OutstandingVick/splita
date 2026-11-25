"use client";

import type { PreviewResult } from "@splita/core";
import type { SplitaRunResult } from "@splita/web";
import { useCallback, useRef, useState } from "react";
import { applyCloudAttempt, applyStage, initialProgress, markSkipped, type Progress } from "./pipeline-progress";
import { getSplita } from "./splita";

export type Outcome =
  | { kind: "answer"; result: SplitaRunResult }
  | { kind: "preview"; preview: PreviewResult }
  | { kind: "setup-error"; message: string };

export interface AskState {
  busy: boolean;
  progress: Progress;
  outcome: Outcome | null;
}

/** Runs the private pipeline for one matter, streaming stage progress. Offline: preview only. */
export function useAsk() {
  const [byMatter, setByMatter] = useState<Record<string, AskState>>({});
  const runId = useRef(0);

  const patch = useCallback((matterId: string, f: (s: AskState) => AskState) => {
    setByMatter((all) => ({ ...all, [matterId]: f(all[matterId] ?? { busy: false, progress: initialProgress(), outcome: null }) }));
  }, []);

  const ask = useCallback(
    async (matterId: string, text: string, question: string, online: boolean) => {
      const id = ++runId.current;
      patch(matterId, () => ({ busy: true, progress: initialProgress(), outcome: null }));
      try {
        const splita = getSplita();
        if (!online) {
          const preview = await splita.preview({ workspaceId: matterId, text, question });
          patch(matterId, (s) => ({ ...s, busy: false, outcome: { kind: "preview", preview } }));
          return;
        }
        const result = await splita.run({
          workspaceId: matterId,
          text,
          question,
          onStage: (e) => patch(matterId, (s) => ({ ...s, progress: applyStage(s.progress, e) })),
          onCloudAttempt: (a) => patch(matterId, (s) => ({ ...s, progress: applyCloudAttempt(s.progress, a) })),
        });
        if (id !== runId.current) return;
        patch(matterId, (s) => ({ busy: false, progress: markSkipped(s.progress), outcome: { kind: "answer", result } }));
      } catch (e) {
        patch(matterId, (s) => ({ ...s, busy: false, outcome: { kind: "setup-error", message: e instanceof Error ? e.message : String(e) } }));
      }
    },
    [patch],
  );

  const stateFor = (matterId: string | undefined): AskState =>
    (matterId && byMatter[matterId]) || { busy: false, progress: initialProgress(), outcome: null };

  return { ask, stateFor };
}
