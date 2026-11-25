import type { DocumentStyle, PageLetterhead } from './types';
import { DOCUMENT_LAYOUT } from '../pdf/design';
import { documentFooterSpace, documentImageFrame } from './appearance';
export const MM_TO_PT = 72 / 25.4;
export const A4_WIDTH_PX = DOCUMENT_LAYOUT.pageWidth / 0.75;
export function headerLetterheadSettings(style: DocumentStyle) {
  return { edgeToEdge: true, fit: 'fill' as const, ...style.headerLetterhead };
}
export function headerLetterheadFrame(style: DocumentStyle) {
  const frame = documentImageFrame(
    { layout: { design: 'classic', logoWidth: 132, document: style } },
    'letterhead',
  );
  const settings = headerLetterheadSettings(style);
  // Older header strips were limited to the content width. Expand them proportionally.
  const height =
    !style.headerLetterhead && settings.edgeToEdge
      ? (frame.height * A4_WIDTH_PX) / frame.width
      : frame.height;
  return {
    ...frame,
    width: settings.edgeToEdge ? A4_WIDTH_PX : frame.width,
    height: Math.min(360, height),
    fit: settings.fit,
  };
}
export function hasPageLetterhead(style: Pick<DocumentStyle, 'headerImage' | 'letterheadMode'>) {
  return !!style.headerImage && style.letterheadMode === 'page';
}
export function pageLetterheadSettings(style: DocumentStyle): PageLetterhead {
  return {
    fit: 'contain',
    position: 'center',
    top: 45,
    bottom: 20,
    left: 15,
    right: 15,
    showFooter: true,
    ...style.pageLetterhead,
  };
}
export function documentPageGeometry(style: DocumentStyle, reference: string) {
  const fullPage = hasPageLetterhead(style);
  const settings = pageLetterheadSettings(style);
  const showFooter = !fullPage || settings.showFooter;
  const top = fullPage ? settings.top * MM_TO_PT : DOCUMENT_LAYOUT.margin;
  const left = fullPage ? settings.left * MM_TO_PT : DOCUMENT_LAYOUT.margin;
  const right = fullPage ? settings.right * MM_TO_PT : DOCUMENT_LAYOUT.margin;
  const contentWidth = DOCUMENT_LAYOUT.pageWidth - left - right;
  const footer = documentFooterSpace(
    showFooter ? style : { ...style, footer: '' },
    reference,
    fullPage ? contentWidth : undefined,
  );
  // Reserve the image's footer area; generated footer text sits immediately above it.
  const footerBottom = fullPage ? settings.bottom * MM_TO_PT : 17;
  const ruleBottom = footerBottom + footer.ruleBottom - 17;
  // Page numbers are always present, including on custom stationery with its own footer.
  const bottom = footerBottom + footer.paddingBottom - 17;
  return {
    fullPage,
    settings,
    showFooter,
    top,
    left,
    right,
    bottom,
    footerBottom,
    ruleBottom,
    contentWidth,
  };
}
