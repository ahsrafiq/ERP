/**
 * PDF → image conversion using pdfjs-dist v5.
 * 
 * We set a valid workerSrc to suppress warnings and ensure the worker is
 * correctly loaded in the Electron environment.
 */

// Robust polyfill for Promise.try which is used by pdfjs-dist v5 but missing in older Electron/Chromium.
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function (callback: () => any) {
    return Promise.resolve().then(callback);
  };
}

let pdfjsLib: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null;
import logger from './logger';

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;

  // Use the legacy build for better compatibility with Electron's worker environment
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = mod;

  // Resolve the worker path relative to index.html's location so it works
  // in both dev (http://127.0.0.1:5173/) and production (file:///...dist/renderer/index.html).
  // Using window.location.origin alone gives "file://" in packaged Electron,
  // which produces file:///pdf.worker.min.mjs (filesystem root) — wrong.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', window.location.href).href;

  return pdfjsLib;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function pdfToImage(pdfDataUrl: string): Promise<string> {
  logger.info('[pdfToImage] Starting conversion...');
  const pdf = await getPdfJs();
  const [, base64] = pdfDataUrl.split(',');
  if (!base64) throw new Error('Invalid PDF data URL');
  const data = base64ToArrayBuffer(base64);

  logger.debug('[pdfToImage] Loading document...', { dataSize: data.byteLength });
  // Load document
  const loadingTask = pdf.getDocument({
    data,
    docBaseUrl: window.location.origin
  });

  try {
    const doc = await loadingTask.promise;
    logger.debug('[pdfToImage] Document loaded. Pages:', doc.numPages);

    const page = await doc.getPage(1);
    logger.debug('[pdfToImage] Page 1 retrieved.');

    // Scale 2 is plenty for A4 letterheads
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2d context not available');

    logger.debug('[pdfToImage] Rendering page to canvas...');
    // pdfjs-dist v5 requires 'canvas' property in render parameters
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport
    }).promise;

    logger.debug('[pdfToImage] Render complete. Converting to data URL...');
    // JPEG is smaller and faster for previewing high-res letterheads
    const result = canvas.toDataURL('image/jpeg', 0.9);

    // Cleanup
    doc.destroy();
    logger.info('[pdfToImage] Conversion finished.');

    return result;
  } catch (err) {
    logger.error('[pdfToImage] Error during conversion:', err instanceof Error ? err.message : String(err));
    throw err;
  }
}

const letterheadCache = new Map<string, string>();
const letterheadPromises = new Map<string, Promise<string>>();

/**
 * Reads a letterhead file (PDF or image) via Electron IPC and returns a data URL.
 * PDFs are rasterized (first page → JPEG). Images are returned as-is.
 * Results are cached in memory to avoid duplicate disk reads and concurrent rasterizations.
 */
export async function pdfFileToImage(filePath: string): Promise<string> {
  if (letterheadCache.has(filePath)) {
    logger.info(`[pdfFileToImage] Returning cached result for ${filePath}`);
    return letterheadCache.get(filePath)!;
  }
  if (letterheadPromises.has(filePath)) {
    logger.info(`[pdfFileToImage] Awaiting existing conversion for ${filePath}`);
    return letterheadPromises.get(filePath)!;
  }

  const promise = (async () => {
    const api = (window as any).electronAPI?.db?.files;
    if (!api?.readAsDataURL) {
      throw new Error('File API not available');
    }

    const result = await api.readAsDataURL(filePath);
    if (!result?.success || !result?.data) {
      throw new Error(result?.error || 'Failed to read file');
    }

    const dataUrl: string = result.data;

    // Already an image — return directly
    if (!dataUrl.startsWith('data:application/pdf')) {
      logger.info('[pdfFileToImage] Letter-head is an image – using as-is');
      letterheadCache.set(filePath, dataUrl);
      return dataUrl;
    }

    // PDF — rasterize first page to JPEG
    logger.info('[pdfFileToImage] Letter-head is a PDF – starting rasterisation');
    const imgDataUrl = await pdfToImage(dataUrl);
    letterheadCache.set(filePath, imgDataUrl);
    return imgDataUrl;
  })();

  letterheadPromises.set(filePath, promise);

  try {
    const finalResult = await promise;
    return finalResult;
  } finally {
    letterheadPromises.delete(filePath);
  }
}

