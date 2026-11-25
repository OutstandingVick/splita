import { cloudStatusText, type Progress, STEPS, type StepStatus } from "@/lib/pipeline-progress";

const DOT: Record<StepStatus, string> = {
  pending: "border-stone-300 bg-white",
  active: "border-accent-600 bg-accent-600 animate-pulse",
  done: "border-accent-600 bg-accent-600",
  error: "border-red-600 bg-red-600",
  skipped: "border-stone-200 bg-stone-100",
};

const LABEL: Record<StepStatus, string> = {
  pending: "text-stone-400",
  active: "text-stone-900",
  done: "text-stone-700",
  error: "text-red-700",
  skipped: "text-stone-300",
};

/** Fixed-height strip: it never changes size while the pipeline runs, so nothing below jumps. */
export function PipelineStrip({ progress }: { progress: Progress }) {
  const cloud = progress.steps.reason.status === "active" ? cloudStatusText(progress.cloud) : null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3" aria-label="Pipeline progress">
      <ol className="grid grid-cols-6 gap-2">
        {STEPS.map((s, i) => {
          const st = progress.steps[s.id];
          return (
            <li key={s.id} className="relative" title={s.hint} aria-current={st.status === "active" ? "step" : undefined}>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-5 right-0 top-[6px] h-0.5 rounded-full transition-colors ${st.status === "done" ? "bg-accent-600" : "bg-stone-200"}`}
                />
              )}
              <span aria-hidden className={`relative z-10 block h-3.5 w-3.5 rounded-full border-2 transition-colors ${DOT[st.status]}`} />
              <span className={`mt-2 block text-xs font-medium ${LABEL[st.status]}`}>{s.label}</span>
              <span className="block h-4 font-mono text-[11px] tabular-nums text-stone-500">
                {st.status === "done" && st.ms !== undefined ? `${st.ms.toLocaleString()} ms` : st.status === "active" ? "running" : st.status === "error" ? "stopped" : ""}
              </span>
              <span className="sr-only">{`${s.label}: ${st.status}`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 h-4 text-xs text-stone-500" aria-live="polite" data-testid="cloud-status">
        {cloud}
      </p>
    </div>
  );
}
