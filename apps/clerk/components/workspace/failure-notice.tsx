import type { Stage } from "@splita/core";
import { explainFailure } from "@/lib/explain-failure";

export function FailureNotice({ stage, error }: { stage: Stage; error: { name?: string; message: string } }) {
  const f = explainFailure(stage, error);
  return (
    <section role="alert" className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-50 text-sm text-accent-700">
          ⛨
        </span>
        <div className="min-w-0 space-y-1.5">
          <h2 className="font-semibold text-stone-900">{f.title}</h2>
          <p className="text-sm leading-relaxed text-stone-600">{f.body}</p>
          <p className="text-xs text-stone-500">
            {f.sent === "nothing" ? "Nothing left this device." : "No real names, numbers or addresses left this device."}
          </p>
          <details className="text-xs text-stone-500">
            <summary className="cursor-pointer select-none">Technical detail</summary>
            <p className="mt-1 break-words font-mono">{f.detail}</p>
          </details>
        </div>
      </div>
    </section>
  );
}
