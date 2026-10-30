import type { OcrWord } from './recents';

// Reads a Recents screenshot in the browser. Free: tesseract.js runs locally
// and downloads its English model (~4 MB) once from the jsDelivr CDN; the
// image never leaves the phone. Loaded on demand so the app stays small.

type Tess = typeof import('tesseract.js');
let workerPromise: Promise<Awaited<ReturnType<Tess['createWorker']>>> | null = null;

function getWorker() {
  workerPromise ??= import('tesseract.js').then((T) => T.createWorker('eng'));
  return workerPromise;
}

async function toCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Share of non-background pixels in the box that are iOS red (#FF3B30-ish). */
function redRatio(ctx: CanvasRenderingContext2D, b: Box, dark: boolean): number {
  const w = Math.max(1, b.x1 - b.x0);
  const h = Math.max(1, b.y1 - b.y0);
  const { data } = ctx.getImageData(b.x0, b.y0, w, h);
  // Word boxes hug the letters, so judge against the page background instead.
  const bg = dark ? 0 : 255;
  let red = 0;
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const bl = data[i + 2]!;
    const lum = (r + g + bl) / 3;
    if (Math.abs(lum - bg) < 70) continue; // background
    ink++;
    if (r > 170 && g < 120 && bl < 120) red++;
  }
  return ink ? red / ink : 0;
}

/**
 * Tesseract reads dark text on a light background best. Map each pixel so
 * any coloured text (black, grey, red, blue) becomes dark on white:
 * light mode uses the darkest channel, dark mode the inverse of the brightest.
 * Colour checks still use the original image.
 */
function forOcr(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): { image: HTMLCanvasElement; dark: boolean } {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    sum += (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
    n++;
  }
  const dark = sum / n < 110;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const v = dark ? 255 - Math.max(r, g, b) : Math.min(r, g, b);
    d[i] = d[i + 1] = d[i + 2] = v < 170 ? 0 : 255; // crisp black on white
  }
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')!.putImageData(img, 0, 0);
  return { image: copy, dark };
}

/** One screenshot -> words with their boxes and redness, plus the image width. */
export async function readScreenshot(file: Blob): Promise<{ words: OcrWord[]; width: number }> {
  const worker = await getWorker();
  const canvas = await toCanvas(file);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const { image, dark } = forOcr(canvas, ctx);
  const { data } = await worker.recognize(image, {}, { blocks: true });
  const words = (data.blocks ?? [])
    .flatMap((b) => b.paragraphs)
    .flatMap((p) => p.lines)
    .flatMap((l) => l.words)
    .filter((w) => w.confidence >= 30 && w.text.trim())
    .map((w) => ({ text: w.text, ...w.bbox, red: redRatio(ctx, w.bbox, dark) }));
  return { words, width: canvas.width };
}
