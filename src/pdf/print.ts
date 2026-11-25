import type { Quotation } from '../domain/types';
import { generateQuotationPdf } from './download';
import { renderPdfPages } from './renderPages';

export async function printQuotationPdf(quote: Quotation, signal?: AbortSignal) {
  const blob = await generateQuotationPdf(quote, signal);
  const pages = await renderPdfPages(blob, 3, signal);
  signal?.throwIfAborted();
  const container = document.createElement('div');
  container.className = 'quotation-print-pages';
  container.append(...pages);
  const style = document.createElement('style');
  style.textContent = `@page { size: A4; margin: 0; }
    @media print {
      html, body { margin: 0 !important; padding: 0 !important; }
      body > #root, body > *:not(.quotation-print-pages) { display: none !important; }
      .quotation-print-pages { display: block !important; margin: 0; padding: 0; }
      .quotation-print-pages canvas { display: block; width: 210mm; height: 297mm; margin: 0; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .quotation-print-pages canvas:last-child { break-after: auto; }
    }`;
  document.head.append(style);
  document.body.append(container);
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = () => {
        window.removeEventListener('afterprint', finish);
        signal?.removeEventListener('abort', cancel);
        resolve();
      };
      const cancel = () => {
        window.removeEventListener('afterprint', finish);
        reject(new DOMException('Print cancelled.', 'AbortError'));
      };
      window.addEventListener('afterprint', finish, { once: true });
      signal?.addEventListener('abort', cancel, { once: true });
      try {
        window.print();
      } catch (error) {
        window.removeEventListener('afterprint', finish);
        signal?.removeEventListener('abort', cancel);
        reject(error);
      }
    });
  } finally {
    container.remove();
    style.remove();
  }
}
