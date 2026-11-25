import type { Quotation } from '../domain/types';
import { quotationErrors } from '../domain/quotation';
export function quotationFilename(quote: Pick<Quotation, 'number' | 'customer'>) {
  const safe = `${quote.number} - ${quote.customer.name}`
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, '-')
    .trim()
    .replace(/\.+$/, '')
    .slice(0, 150);
  return `${safe || 'Quotation'}.pdf`;
}
export async function generateQuotationPdf(quote: Quotation, signal?: AbortSignal): Promise<Blob> {
  const errors = quotationErrors(quote);
  if (Object.keys(errors).length || !quote.company.name.trim())
    throw new Error('Complete the required quotation details before exporting.');
  if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
  // A dedicated worker keeps interaction and loading feedback smooth during typesetting.
  const worker = new Worker(new URL('./pdf.worker.tsx', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
      signal?.removeEventListener('abort', cancel);
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException('Export cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
    worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
      cleanup();
      if (event.data.blob?.size) resolve(event.data.blob);
      else reject(new Error('The PDF could not be generated. Please try again or use Print.'));
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error('The PDF generator could not load. Please reload and try again.'));
    };
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('PDF generation timed out. Try fewer long descriptions or use Print.'));
    }, 90_000);
    worker.postMessage(structuredClone(quote));
  });
}
export async function downloadQuotation(quote: Quotation, signal?: AbortSignal) {
  const blob = await generateQuotationPdf(quote, signal);
  if (signal?.aborted) throw new DOMException('Export cancelled.', 'AbortError');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = quotationFilename(quote);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to consume the download before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
