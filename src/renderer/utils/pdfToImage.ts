/**
 * Converts the first page of a PDF to a PNG data URL.
 * Uses pdf.js - works in browser/Electron renderer.
 */

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import('pdfjs-dist');
  pdfjsLib = mod;
  try {
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function pdfToImage(pdfDataUrl: string): Promise<string> {
  const pdf = await getPdfJs();
  const [, base64] = pdfDataUrl.split(',');
  if (!base64) throw new Error('Invalid PDF data URL');
  const data = base64ToArrayBuffer(base64);
  const doc = await pdf.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const scale = 2;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2d context not available');
  await page.render({
    canvasContext: ctx,
    viewport,
    intent: 'print',
  }).promise;
  return canvas.toDataURL('image/png');
}

export async function pdfFileToImage(filePath: string): Promise<string> {
  const result = await (window as any).electronAPI?.db?.files?.readAsDataURL?.(filePath);
  if (!result?.success || !result?.data) {
    throw new Error('Failed to read PDF file');
  }
  const dataUrl = result.data;
  if (!dataUrl.startsWith('data:application/pdf')) {
    return dataUrl;
  }
  return pdfToImage(dataUrl);
}
