/**
 * Client-side PDF text extraction with pdf.js. The file is read in this browser; nothing is
 * uploaded. Scanned PDFs (images with no text layer) are detected so the user can be warned.
 */

export interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

export interface PdfText {
  text: string;
  pages: number;
  /** Pages with almost no extractable text: probably scanned images. */
  emptyPages: number;
  scanned: boolean;
}

/** Joins one page's text items, keeping pdf.js line breaks. */
export function joinItems(items: readonly TextItemLike[]): string {
  let out = "";
  for (const it of items) {
    if (typeof it.str !== "string") continue;
    out += it.str;
    if (it.hasEOL) out += "\n";
  }
  return out
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MIN_CHARS_PER_PAGE = 20;

export function summarizePages(pageTexts: readonly string[]): PdfText {
  const emptyPages = pageTexts.filter((t) => t.replace(/\s/g, "").length < MIN_CHARS_PER_PAGE).length;
  return {
    text: pageTexts.filter((t) => t.length > 0).join("\n\n"),
    pages: pageTexts.length,
    emptyPages,
    scanned: pageTexts.length > 0 && emptyPages === pageTexts.length,
  };
}

export async function extractPdfText(data: ArrayBuffer): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      pages.push(joinItems((await page.getTextContent()).items as TextItemLike[]));
      page.cleanup();
    }
    return summarizePages(pages);
  } finally {
    void task.destroy();
  }
}
