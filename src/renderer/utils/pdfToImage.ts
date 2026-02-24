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

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;

  // Use the legacy build for better compatibility with Electron's worker environment
  const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjsLib = mod;

  // Set workerSrc to the local public URL to satisfy the validation check.
  // This file is served from src/renderer/public/pdf.worker.min.mjs
  const origin = window.location.origin || 'http://127.0.0.1:5173';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${origin}/pdf.worker.min.mjs`;

  return pdfjsLib;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function pdfToImage(pdfDataUrl: string): Promise<string> {
  console.log('[pdfToImage] Starting conversion...');
  const pdf = await getPdfJs();
  const [, base64] = pdfDataUrl.split(',');
  if (!base64) throw new Error('Invalid PDF data URL');
  const data = base64ToArrayBuffer(base64);

  console.log('[pdfToImage] Loading document...', { dataSize: data.byteLength });
  // Load document
  const loadingTask = pdf.getDocument({
    data,
    docBaseUrl: window.location.origin
  });

  try {
    const doc = await loadingTask.promise;
    console.log('[pdfToImage] Document loaded. Pages:', doc.numPages);

    const page = await doc.getPage(1);
    console.log('[pdfToImage] Page 1 retrieved.');

    // Scale 2 is plenty for A4 letterheads
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2d context not available');

    console.log('[pdfToImage] Rendering page to canvas...');
    // pdfjs-dist v5 requires 'canvas' property in render parameters
    await page.render({
      canvasContext: ctx,
      canvas,
      viewport
    }).promise;

    console.log('[pdfToImage] Render complete. Converting to data URL...');
    // JPEG is smaller and faster for previewing high-res letterheads
    const result = canvas.toDataURL('image/jpeg', 0.9);

    // Cleanup
    doc.destroy();
    console.log('[pdfToImage] Conversion finished.');

    return result;
  } catch (err) {
    console.error('[pdfToImage] Error during conversion:', err);
    throw err;
  }
}

/**
 * Reads a letterhead file (PDF or image) via Electron IPC and returns a data URL.
 * PDFs are rasterized (first page → JPEG). Images are returned as-is.
 */
export async function pdfFileToImage(filePath: string): Promise<string> {
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
    return dataUrl;
  }

  // PDF — rasterize first page to JPEG
  return pdfToImage(dataUrl);
}
