"use client";

import { type ChangeEvent, useId, useRef, useState } from "react";

const MAX_BYTES = 1_000_000;

export function DocumentEditor({
  document,
  question,
  onDocument,
  onQuestion,
  onAsk,
  busy,
  online,
}: {
  document: string;
  question: string;
  onDocument: (v: string) => void;
  onQuestion: (v: string) => void;
  onAsk: () => void;
  busy: boolean;
  online: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const docId = useId();
  const qId = useId();
  // Offline the button runs an on-device preview instead: detection works, nothing is sent.
  const canAsk = !busy && document.trim().length > 0;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setFileError(null);
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== "text/plain") {
      setFileError("Only .txt files for now. Paste other documents as text.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("That file is over 1 MB. Paste the relevant part instead.");
      return;
    }
    onDocument(await file.text());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={docId} className="text-sm font-medium text-stone-800">
          Document
        </label>
        <div className="flex items-center gap-3 text-xs">
          {fileError && (
            <span role="alert" className="text-red-700">
              {fileError}
            </span>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="rounded-md px-2 py-1 font-medium text-accent-700 hover:bg-accent-50">
            Upload .txt
          </button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" onChange={(e) => void onFile(e)} />
        </div>
      </div>
      <textarea
        id={docId}
        value={document}
        onChange={(e) => onDocument(e.target.value)}
        placeholder="Paste a letter, contract or statement. Identities are detected on this device before anything is sent."
        spellCheck={false}
        className="h-64 w-full resize-y rounded-xl border border-stone-300 bg-white p-4 font-mono text-[13px] leading-relaxed text-stone-800 placeholder:font-sans placeholder:text-stone-400"
      />
      <label htmlFor={qId} className="block text-sm font-medium text-stone-800">
        Question
      </label>
      <div className="flex gap-3">
        <input
          id={qId}
          value={question}
          onChange={(e) => onQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAsk) onAsk();
          }}
          placeholder="e.g. Does the employee have a claim? List the amounts owed."
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
        />
        <button
          type="button"
          onClick={onAsk}
          disabled={!canAsk}
          className={`shrink-0 rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm disabled:cursor-not-allowed disabled:bg-stone-300 ${online ? "bg-accent-700 text-white hover:bg-accent-800" : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50"}`}
        >
          {busy ? "Working…" : online ? "Ask privately" : "Preview on device"}
        </button>
      </div>
      <p className="h-4 text-xs text-stone-500">
        {!online
          ? "You're offline. Asking is paused; Preview shows exactly what would be sent, and nothing leaves this device."
          : "The question is anonymized together with the document."}
      </p>
    </div>
  );
}
