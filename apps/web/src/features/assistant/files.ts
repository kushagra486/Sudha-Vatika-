import { photoToDataUrl } from '@/features/calls/list';

// Turns whatever staff attach into what the AI can read: images (photos,
// screenshots, scanned PDF pages) as small JPEGs, and text from PDFs, Word,
// CSV and text files. PDF and Word readers load only when such a file is picked.

export const ACCEPT =
  'image/*,application/pdf,.pdf,.docx,.txt,.csv,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_FILES = 4;
const MAX_IMAGES = 4;
const MAX_PDF_PAGES = 8;
const MAX_TEXT = 50_000;

export interface PreparedFiles {
  images: string[];
  text: string;
  names: string[];
}

export class UnsupportedFileError extends Error {}

async function pdfToContent(file: File): Promise<{ text: string; images: string[] }> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(doc.numPages, MAX_PDF_PAGES);
  let text = '';
  const images: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : ''))
      .join('')
      .trim();
    text += `${pageText}\n\n`;
    // A scanned page has no text layer: send a picture of it instead.
    if (pageText.length < 40 && images.length < MAX_IMAGES) {
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 1600 / Math.max(viewport.width, viewport.height));
      const v = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(v.width);
      canvas.height = Math.round(v.height);
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport: v }).promise;
      images.push(canvas.toDataURL('image/jpeg', 0.85));
    }
  }
  return { text: text.trim(), images };
}

async function docxToText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const r = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return r.value;
}

const isImage = (f: File) => f.type.startsWith('image/');
const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const isDocx = (f: File) => /\.docx$/i.test(f.name);
const isText = (f: File) => f.type.startsWith('text/') || /\.(txt|csv)$/i.test(f.name);

/** Reads the picked files. Throws UnsupportedFileError for anything else (e.g. old .doc, Excel). */
export async function prepareFiles(files: File[]): Promise<PreparedFiles> {
  const out: PreparedFiles = { images: [], text: '', names: [] };
  for (const f of files.slice(0, MAX_FILES)) {
    out.names.push(f.name);
    if (isImage(f)) {
      if (out.images.length < MAX_IMAGES) out.images.push(await photoToDataUrl(f));
    } else if (isPdf(f)) {
      const r = await pdfToContent(f);
      if (r.text) out.text += `--- ${f.name} ---\n${r.text}\n`;
      out.images.push(...r.images.slice(0, MAX_IMAGES - out.images.length));
    } else if (isDocx(f)) {
      out.text += `--- ${f.name} ---\n${await docxToText(f)}\n`;
    } else if (isText(f)) {
      out.text += `--- ${f.name} ---\n${await f.text()}\n`;
    } else {
      throw new UnsupportedFileError(f.name);
    }
  }
  out.text = out.text.slice(0, MAX_TEXT).trim();
  return out;
}
