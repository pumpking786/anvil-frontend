import { tableTextColor, totalTextColor } from './tableAppearance';
import type { CSSProperties } from 'react';
import type { DocumentStyle, ImageFrame, Quotation, TextAppearance, TextSection } from './types';
import { DOCUMENT_FONTS, documentTypography } from './document';
import { documentTheme, DOCUMENT_LAYOUT } from '../pdf/design';
import { contrastText } from '../lib/theme';
export const TEXT_SECTIONS: { key: TextSection; label: string; group: string }[] = [
  { key: 'headerTitle', label: 'Header Title', group: 'Company header' },
  { key: 'headerSubtitle', label: 'Header Subtitle', group: 'Company header' },
  { key: 'registration', label: 'VAT / PAN & Address', group: 'Company header' },
  { key: 'contact', label: 'Phone & Email', group: 'Company header' },
  { key: 'slogan', label: 'Company Slogan', group: 'Company header' },
  { key: 'documentTitle', label: 'Quotation Heading', group: 'Document' },
  { key: 'reference', label: 'Quotation Number', group: 'Document' },
  { key: 'status', label: 'Status & Currency', group: 'Document' },
  { key: 'sectionLabels', label: 'Section Labels', group: 'Document' },
  { key: 'customerName', label: 'Customer Name', group: 'Document' },
  { key: 'customerDetails', label: 'Customer Details', group: 'Document' },
  { key: 'metadataLabels', label: 'Date & Currency Labels', group: 'Document' },
  { key: 'metadataValues', label: 'Date & Currency Values', group: 'Document' },
  { key: 'tableHeaders', label: 'Table Headings', group: 'Line items' },
  { key: 'itemDescription', label: 'Item Descriptions', group: 'Line items' },
  { key: 'itemNumbers', label: 'Item Quantities & Prices', group: 'Line items' },
  { key: 'totalsLabels', label: 'Totals Labels', group: 'Summary' },
  { key: 'totalsValues', label: 'Totals Amounts', group: 'Summary' },
  { key: 'grandTotalLabel', label: 'Grand Total Label', group: 'Summary' },
  { key: 'grandTotalValue', label: 'Grand Total Amount', group: 'Summary' },
  { key: 'amountWords', label: 'Amount In Words', group: 'Summary' },
  { key: 'terms', label: 'Terms & Conditions', group: 'Closing' },
  { key: 'signature', label: 'Signature & Stamp Labels', group: 'Closing' },
  { key: 'footer', label: 'Footer Slogan', group: 'Closing' },
  { key: 'pageNumber', label: 'Footer Reference & Page Number', group: 'Closing' },
];
export function textDefaults(style: DocumentStyle, section: TextSection): Required<TextAppearance> {
  const type = documentTypography(style),
    theme = documentTheme(style.primaryColor, style.textColor);
  const center = ['center', 'spotlight'].includes(style.header);
  const header = ['headerTitle', 'headerSubtitle', 'registration', 'contact', 'slogan'].includes(
    section,
  );
  const color =
    header && style.header === 'executive'
      ? '#ffffff'
      : ['tableHeaders', 'grandTotalLabel', 'grandTotalValue'].includes(section) &&
          style.table === 'bold'
        ? contrastText(theme.accent)
        : [
              'headerTitle',
              'slogan',
              'documentTitle',
              'tableHeaders',
              'grandTotalLabel',
              'grandTotalValue',
              'footer',
            ].includes(section)
          ? theme.accent
          : [
                'registration',
                'contact',
                'status',
                'sectionLabels',
                'customerDetails',
                'metadataLabels',
                'totalsLabels',
                'terms',
                'pageNumber',
              ].includes(section)
            ? theme.muted
            : theme.ink;
  const size =
    section === 'headerTitle'
      ? style.titleSize || 18
      : section === 'documentTitle'
        ? type.heading
        : section === 'reference'
          ? type.reference
          : section === 'grandTotalValue'
            ? type.total
            : ['sectionLabels', 'headerSubtitle', 'footer', 'pageNumber'].includes(section)
              ? type.small
              : [
                    'itemDescription',
                    'itemNumbers',
                    'amountWords',
                    'customerName',
                    'grandTotalLabel',
                  ].includes(section)
                ? type.body
                : type.detail;
  return {
    color: ['grandTotalLabel', 'grandTotalValue'].includes(section)
      ? totalTextColor(style)
      : section === 'tableHeaders'
        ? tableTextColor(style, 'description', 'heading')
        : color,
    font: style.font,
    size,
    align: header
      ? center
        ? 'center'
        : 'left'
      : ['reference', 'status'].includes(section)
        ? center
          ? 'center'
          : 'right'
        : [
              'itemNumbers',
              'metadataValues',
              'totalsValues',
              'grandTotalValue',
              'pageNumber',
            ].includes(section)
          ? 'right'
          : section === 'signature'
            ? 'center'
            : 'left',
    bold: [
      'headerTitle',
      'headerSubtitle',
      'slogan',
      'documentTitle',
      'reference',
      'sectionLabels',
      'customerName',
      'tableHeaders',
      'grandTotalLabel',
      'grandTotalValue',
      'amountWords',
      'footer',
    ].includes(section),
    italic: false,
  };
}
// Only explicit choices override a template. Older documents keep their exact layout.
export function appearanceStyle(value?: TextAppearance) {
  return {
    ...(value?.color ? { color: value.color } : {}),
    ...(value?.font ? { fontFamily: DOCUMENT_FONTS[value.font] } : {}),
    ...(value?.size ? { fontSize: value.size } : {}),
    ...(value?.align ? { textAlign: value.align } : {}),
    ...(value?.bold === undefined
      ? {}
      : { fontWeight: value.bold ? (700 as const) : (400 as const) }),
    ...(value?.italic === undefined
      ? {}
      : { fontStyle: value.italic ? ('italic' as const) : ('normal' as const) }),
  };
}
export function textOverrides(style: DocumentStyle, section: TextSection, item?: TextAppearance) {
  return { ...style.text?.[section], ...item };
}
export function textCss(
  style: DocumentStyle,
  section: TextSection,
  item?: TextAppearance,
): CSSProperties {
  const value = textOverrides(style, section, item);
  return { ...appearanceStyle(value), ...(value.size ? { fontSize: `${value.size}pt` } : {}) };
}
export function imageFrameStyle(frame: ImageFrame): CSSProperties {
  return {
    width: frame.width,
    height: frame.height,
    maxWidth: '100%',
    objectFit: frame.fit,
    objectPosition: frame.position,
  };
}
// Match the chosen frame in previews and sign-in screens. On narrow screens,
// shrink both dimensions together instead of silently capping the logo height.
export function loginLogoStyle(frame: ImageFrame): CSSProperties {
  return {
    ...imageFrameStyle(frame),
    height: 'auto',
    aspectRatio: `${frame.width} / ${frame.height}`,
    flexShrink: 0,
  };
}
export function fitLetterhead(width: number, height: number): ImageFrame {
  const ratio = Math.max(0.01, width / Math.max(1, height));
  const fittedWidth = Math.max(16, Math.min(DOCUMENT_LAYOUT.pageWidth / 0.75, 360 * ratio));
  return {
    width: fittedWidth,
    height: Math.max(16, Math.min(360, fittedWidth / ratio)),
    fit: 'contain',
    position: 'center',
  };
}

// Physical point sizes are shared by the browser and PDF renderers.
export function itemTypography(style: DocumentStyle, item?: TextAppearance, scale = 1) {
  const size =
    (item?.size ?? style.text?.itemDescription?.size ?? documentTypography(style).body) * scale;
  return { titleSize: size, detailSize: Math.max(6, size - 1), detailColor: '#667085' };
}
export function documentImageFrame(
  quote: Pick<Quotation, 'layout'>,
  slot: 'logo' | 'letterhead' | 'signature' | 'stamp',
): ImageFrame {
  const width = quote.layout.logoWidth || 132;
  const defaults: Record<typeof slot, ImageFrame> = {
    logo: { width, height: Math.max(51, width * 0.4), fit: 'contain', position: 'left' },
    letterhead: { width: 700, height: 141, fit: 'contain', position: 'center' },
    signature: { width: 173, height: 51, fit: 'contain', position: 'center' },
    stamp: { width: 120, height: 75, fit: 'contain', position: 'center' },
  };
  return {
    ...defaults[slot],
    ...quote.layout.document?.images?.[slot],
    ...(slot === 'logo' ? { width } : {}),
  };
}

// Reserve room for customized footer type and wrapped reference text on every A4 page.
export function documentFooterSpace(
  style: DocumentStyle,
  reference: string,
  contentWidth?: number,
) {
  const height = (content: string, size: number, width: number) =>
    content
      .split('\n')
      .reduce(
        (lines, part) => lines + Math.max(1, Math.ceil((part.length * size * 0.9) / width)),
        0,
      ) *
    size *
    1.3;
  const footerHeight = height(
    style.footer,
    style.text?.footer?.size || 7,
    contentWidth ? contentWidth * 0.54 : 295,
  );
  const referenceHeight = height(
    `${reference}\nPage 999 of 999`,
    style.text?.pageNumber?.size || 7,
    contentWidth ? contentWidth * 0.4 : 208,
  );
  const ruleBottom = Math.max(34, Math.ceil(17 + Math.max(footerHeight, referenceHeight) + 7));
  return { ruleBottom, paddingBottom: ruleBottom + 12 };
}
