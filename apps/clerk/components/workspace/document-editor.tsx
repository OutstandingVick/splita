"use client";

import { type ChangeEvent, useId, useRef, useState } from "react";
import { extractPdfText } from "@/lib/pdf-text";

const MAX_TXT_BYTES = 1_000_000;
const MAX_PDF_BYTES = 20_000_000;

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
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const docId = useId();
  const qId = useId();
  // Offline the button runs an on-device preview instead: detection works, nothing is sent.
  const canAsk = !busy && document.trim().length > 0;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setFileError(null);
    setFileNote(null);
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isTxt = /\.txt$/i.test(file.name) || file.type === "text/plain";
    if (!isPdf && !isTxt) {
      setFileError("Upload a .pdf or .txt file, or paste the text.");
      return;
    }
    if (file.size > (isPdf ? MAX_PDF_BYTES : MAX_TXT_BYTES)) {
      setFileError(`That file is over ${isPdf ? "20" : "1"} MB. Paste the relevant part instead.`);
      return;
    }
    if (isTxt) {
      onDocument(await file.text());
      setFileNote(`${file.name} loaded`);
      return;
    }
    // PDF: text is extracted here in the browser with pdf.js; the file is never uploaded.
    setReading(true);
    try {
      const pdf = await extractPdfText(await file.arrayBuffer());
      const pages = `${pdf.pages} page${pdf.pages === 1 ? "" : "s"}`;
      if (pdf.scanned) {
        setFileError(`${file.name} (${pages}) looks scanned: it has no text layer, so there is nothing to read. Run OCR first or paste the text.`);
        return;
      }
      onDocument(pdf.text);
      setFileNote(
        `${file.name}: ${pages} read on this device` +
          (pdf.emptyPages ? ` · ${pdf.emptyPages} page${pdf.emptyPages === 1 ? "" : "s"} had no text (scanned?) and were skipped` : ""),
      );
    } catch (err) {
      setFileError(`Couldn't read that PDF${err instanceof Error && err.name === "PasswordException" ? ": it is password-protected" : ""}.`);
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <label htmlFor={docId} className="text-sm font-medium text-stone-800">
          Document
        </label>
        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
            className="rounded-md px-2 py-1 font-medium text-accent-700 hover:bg-accent-50 disabled:opacity-60"
          >
            {reading ? "Reading PDF…" : "Upload .pdf or .txt"}
          </button>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf,.txt,text/plain" className="hidden" onChange={(e) => void onFile(e)} />
        </div>
      </div>
      {(fileError || fileNote) && (
        <p role={fileError ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-xs ${fileError ? "bg-amber-50 text-amber-900" : "bg-accent-50 text-accent-800"}`}>
          {fileError ?? fileNote}
        </p>
      )}
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
