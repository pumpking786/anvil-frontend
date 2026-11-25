import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Both the full-page preview and printing render the same exported PDF pages.
export async function renderPdfPages(blob: Blob, scale = 1.5, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
  // An explicit asset import lets Vite serve the worker when dependencies live
  // outside frontend/ (including pnpm's symlinked package store).
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  signal?.throwIfAborted();
  const data = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();
  const task = getDocument({ data, disableFontFace: true, useWasm: false });
  let cancelRender: (() => void) | undefined;
  const abort = () => {
    cancelRender?.();
    void task.destroy();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    const pages: HTMLCanvasElement[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      signal?.throwIfAborted();
      const page = await pdf.getPage(number);
      signal?.throwIfAborted();
      const canvas = document.createElement('canvas');
      const viewport = page.getViewport({ scale });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Quotation PDF page ${number} of ${pdf.numPages}`);
      const rendering = page.render({ canvas, viewport });
      cancelRender = () => rendering.cancel();
      await rendering.promise;
      cancelRender = undefined;
      pages.push(canvas);
      page.cleanup();
    }
    signal?.throwIfAborted();
    return pages;
  } finally {
    signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}
