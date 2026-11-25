import type { DocumentStyle, LineItem, Quotation, TableColumn } from './types';
import { documentTypography, renderedDocumentStyle } from './document';
import { documentImageFrame, itemTypography } from './appearance';
import { documentPageGeometry } from './letterhead';
import { amountInWords, calculateTotals, money } from './quotation';
import { splitItemDescription } from './products';

export type QuotationDensity = 'regular' | 'compact';

// Both approval images share one block. Constrain oversized frames proportionally,
// keeping their chosen aspect ratios and enough room for the preparer's name.
export function quotationApproval(quote: Quotation, contentWidth: number) {
  const gap = 4;
  const signature = quote.company.signature
    ? documentImageFrame(quote, 'signature')
    : { width: 173, height: 51 };
  const stamp = quote.company.stamp
    ? documentImageFrame(quote, 'stamp')
    : { width: 89.33, height: 58.67 };
  const width = Math.min(
    contentWidth * 0.68,
    Math.max(contentWidth * 0.36, (signature.width + stamp.width) * 0.75 + gap),
  );
  const scale = Math.min(0.75, (width - gap) / (signature.width + stamp.width));
  return {
    width,
    gap,
    preparerWidth: contentWidth - width - contentWidth * 0.06,
    signature: { width: signature.width * scale, height: signature.height * scale },
    stamp: { width: stamp.width * scale, height: stamp.height * scale },
  };
}

// Bring contained artwork toward the shared edge instead of leaving empty space
// between centered image frames. Explicit placement choices remain available.
export function approvalImagePosition(quote: Quotation, slot: 'signature' | 'stamp') {
  const { position, fit } = documentImageFrame(quote, slot);
  return fit === 'contain' && position === 'center'
    ? `${slot === 'signature' ? 'right' : 'left'} bottom`
    : position;
}

// An estimate only decides grouping. The PDF text engine performs the actual wrapping.
export function wrappedLines(text: string, width: number, size: number) {
  const capacity = Math.max(1, Math.floor(width / (size * 0.55)));
  return text.split(/\r?\n/).reduce((total, paragraph) => {
    let lines = 1,
      used = 0;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const length = Array.from(word).length;
      if (used && used + 1 + length > capacity) {
        lines++;
        used = 0;
      }
      const occupied = used + (used ? 1 : 0) + length;
      lines += Math.max(0, Math.ceil(occupied / capacity) - 1);
      used = occupied % capacity || capacity;
    }
    return total + lines;
  }, 0);
}

// Invisible break opportunities keep long model codes/URLs inside their cell.
export function breakLongTokens(text: string) {
  return text.replace(/[^\s\u200b]{40,}/gu, (token) => {
    const letters = Array.from(token);
    const chunks: string[] = [];
    for (let i = 0; i < letters.length; i += 24) chunks.push(letters.slice(i, i + 24).join(''));
    return chunks.join('\u200b');
  });
}

export function quotationFlow(quote: Quotation, density: QuotationDensity = 'regular', scale = 1) {
  const style = renderedDocumentStyle(quote);
  const type = documentTypography(style, scale);
  const page = documentPageGeometry(style, quote.number);
  const totals = calculateTotals(quote.items, quote.discount, quote.vatEnabled, quote.vatRate);
  const numberSize = Math.max(
    type.body,
    (style.text?.itemNumbers?.size || 0) * scale,
    ...quote.items.map((item) => (item.appearance?.size || 0) * scale),
  );
  const labelSize = (style.text?.tableHeaders?.size ?? documentTypography(style).detail) * scale;
  const numericWidth = (values: string[], heading: string, minimum: number, maximum: number) =>
    Math.min(
      maximum,
      Math.max(
        minimum,
        ((Math.max(
          heading.length * labelSize * 0.55,
          ...values.map((value) => value.length * numberSize * 0.6),
        ) +
          14) /
          page.contentWidth) *
          100,
      ),
    );
  const quantity = numericWidth(
    quote.items.map((item) => String(item.quantity)),
    'Qty',
    7,
    12,
  );
  const unitPrice = numericWidth(
    quote.items.map((item) => money(item.unitPrice)),
    'Unit price',
    13,
    23,
  );
  const amount = numericWidth(totals.lines.map(money), 'Amount', 14, 23);
  const columns: Record<TableColumn, number> = {
    index: 5,
    description: 95 - quantity - unitPrice - amount,
    quantity,
    unitPrice,
    amount,
  };
  const spacing = {
    regular: { rowPadding: 5, lineHeight: 1.5, gap: 13, totalPadding: 4, grandPadding: 9 },
    compact: {
      rowPadding: 4.25 * scale,
      lineHeight: 1.45,
      gap: 11 * scale,
      totalPadding: 3.75 * scale,
      grandPadding: 8.5 * scale,
    },
  }[density];
  const termsSize = (style.text?.terms?.size ?? documentTypography(style).detail) * scale;
  const termsLines = wrappedLines(
    quote.terms || 'No additional terms.',
    page.contentWidth * 0.51,
    termsSize,
  );
  const wordsSize = (style.text?.amountWords?.size ?? documentTypography(style).body) * scale;
  const wordsHeight =
    wrappedLines(amountInWords(totals.total), page.contentWidth * 0.51, wordsSize) *
      wordsSize *
      1.4 +
    22;
  const sideTerms = termsLines * termsSize * spacing.lineHeight + wordsHeight < 190;
  const approval = quotationApproval(quote, page.contentWidth);
  const sectionScale = (density === 'regular' ? 1 : 0.95) * scale;
  return {
    ...spacing,
    sectionScale,
    approval,
    columns,
    sideTerms,
    descriptionWidth: (page.contentWidth * columns.description) / 100 - 14,
  };
}

export function splitDescriptionAcrossPages(item: LineItem, style: DocumentStyle, width: number) {
  const { title, details } = splitItemDescription(item.description);
  const type = itemTypography(style, item.appearance);
  const lines =
    wrappedLines(title, width, type.titleSize) +
    (details ? wrappedLines(details, width, type.detailSize) : 0);
  return lines > 4;
}
