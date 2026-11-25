import { renderPdfPages } from '../pdf/renderPages';
import { useEffect, useRef, useState } from 'react';
import type { Quotation } from '../domain/types';
import { generateQuotationPdf } from '../pdf/download';
import { ErrorText, Spinner } from './ui';

// Render the export itself so page breaks, fonts, colors and image geometry match.
export function ExactPdfPreview({ quote }: { quote: Quotation }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [hasPages, setHasPages] = useState(false);
  const snapshot = JSON.stringify(quote);
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setError('');
    const timer = setTimeout(async () => {
      try {
        const blob = await generateQuotationPdf(JSON.parse(snapshot), controller.signal);
        const pages = await renderPdfPages(blob, 1.5, controller.signal);
        const fragment = document.createDocumentFragment();
        pages.forEach((canvas, index) => {
          const sheet = document.createElement('figure');
          const caption = document.createElement('figcaption');
          caption.textContent = `A4 · Page ${index + 1} of ${pages.length}`;
          sheet.append(canvas, caption);
          fragment.append(sheet);
        });
        if (controller.signal.aborted) return;
        host.current?.replaceChildren(fragment);
        setHasPages(true);
        setState('ready');
      } catch (failure) {
        if (!controller.signal.aborted) {
          setError((failure as Error).message);
          setState('error');
        }
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [snapshot, retry]);
  return (
    <div className="exact-pdf-preview" aria-busy={state === 'loading'}>
      {state === 'loading' && (
        <div
          className={`pdf-preview-status ${hasPages ? 'pdf-preview-overlay' : ''}`}
          role="status"
        >
          <Spinner />
          Updating A4 PDF preview…
        </div>
      )}
      {state === 'error' && (
        <div className={`pdf-preview-status ${hasPages ? 'pdf-preview-overlay' : ''}`}>
          <ErrorText>{error}</ErrorText>
          <button type="button" className="button" onClick={() => setRetry((value) => value + 1)}>
            Retry Preview
          </button>
        </div>
      )}
      <div ref={host} className="exact-pdf-pages" hidden={!hasPages} />
    </div>
  );
}
