import { hasPageLetterhead } from '../domain/letterhead';
import { resolveDocumentStyle } from '../domain/document';
import { ExactPdfPreview } from './ExactPdfPreview';
import type { Quotation } from '../domain/types';
import { QuotationDocument } from './QuotationDocument';

export function DocumentPreview({
  quote,
  designer = false,
}: {
  quote: Quotation;
  designer?: boolean;
}) {
  const fullPage = hasPageLetterhead(resolveDocumentStyle(quote));
  return (
    <div className="document-preview-shell">
      <div className="full-page-preview-label">
        <strong>{fullPage ? 'Whole A4' : 'A4'} · Exact PDF preview</strong>
        <span>Updates automatically</span>
      </div>
      {/* All visible previews use the export renderer, including while editing a layout. */}
      <ExactPdfPreview quote={quote} />
      {/* Canvas pages need a readable text alternative for assistive technology. */}
      <section className="sr-only" aria-label="Quotation Text">
        <QuotationDocument
          quote={quote}
          id={designer ? 'layout-preview-document' : 'quotation-document'}
        />
      </section>
    </div>
  );
}
