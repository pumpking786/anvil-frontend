import { PDFDocument } from 'pdf-lib';
import type { QuotationDensity } from '../domain/quotationFlow';
import dmItalic400 from '@fontsource/dm-sans/files/dm-sans-latin-400-italic.woff?url';
import dmItalic600 from '@fontsource/dm-sans/files/dm-sans-latin-600-italic.woff?url';
import dmItalic700 from '@fontsource/dm-sans/files/dm-sans-latin-700-italic.woff?url';
import openItalic400 from '@fontsource/open-sans/files/open-sans-latin-400-italic.woff?url';
import openItalic600 from '@fontsource/open-sans/files/open-sans-latin-600-italic.woff?url';
import openItalic700 from '@fontsource/open-sans/files/open-sans-latin-700-italic.woff?url';
import serifItalic400 from '@fontsource/newsreader/files/newsreader-latin-400-italic.woff?url';
import serifItalic600 from '@fontsource/newsreader/files/newsreader-latin-600-italic.woff?url';
import serifItalic700 from '@fontsource/newsreader/files/newsreader-latin-700-italic.woff?url';
import deva600 from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-600-normal.woff?url';
import deva700 from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff?url';
import { Buffer } from 'buffer';
import { Font, pdf } from '@react-pdf/renderer';
import regular from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff?url';
import semibold from '@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff?url';
import bold from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff?url';
import openRegular from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff?url';
import openSemibold from '@fontsource/open-sans/files/open-sans-latin-600-normal.woff?url';
import openBold from '@fontsource/open-sans/files/open-sans-latin-700-normal.woff?url';
import serifRegular from '@fontsource/newsreader/files/newsreader-latin-400-normal.woff?url';
import serifSemibold from '@fontsource/newsreader/files/newsreader-latin-600-normal.woff?url';
import serifBold from '@fontsource/newsreader/files/newsreader-latin-700-normal.woff?url';
import devanagari from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff?url';
import { QuotationPdf } from './QuotationPdf';
import type { Quotation } from '../domain/types';
// PDFKit's PNG decoder expects Buffer in browser workers.
(globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
const absolute = (url: string) => new URL(url, globalThis.location.href).href;
Font.register({
  family: 'DM Sans',
  fonts: [
    { src: absolute(regular), fontWeight: 400 },
    { src: absolute(semibold), fontWeight: 600 },
    { src: absolute(bold), fontWeight: 700 },
    { src: absolute(dmItalic400), fontWeight: 400, fontStyle: 'italic' },
    { src: absolute(dmItalic600), fontWeight: 600, fontStyle: 'italic' },
    { src: absolute(dmItalic700), fontWeight: 700, fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Open Sans',
  fonts: [
    { src: absolute(openRegular), fontWeight: 400 },
    { src: absolute(openSemibold), fontWeight: 600 },
    { src: absolute(openBold), fontWeight: 700 },
    { src: absolute(openItalic400), fontWeight: 400, fontStyle: 'italic' },
    { src: absolute(openItalic600), fontWeight: 600, fontStyle: 'italic' },
    { src: absolute(openItalic700), fontWeight: 700, fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Newsreader',
  fonts: [
    { src: absolute(serifRegular), fontWeight: 400 },
    { src: absolute(serifSemibold), fontWeight: 600 },
    { src: absolute(serifBold), fontWeight: 700 },
    { src: absolute(serifItalic400), fontWeight: 400, fontStyle: 'italic' },
    { src: absolute(serifItalic600), fontWeight: 600, fontStyle: 'italic' },
    { src: absolute(serifItalic700), fontWeight: 700, fontStyle: 'italic' },
  ],
});
// This script has no italic face; its upright glyphs remain readable in italic Latin text.
Font.register({
  family: 'Noto Devanagari',
  fonts: [
    ...(['normal', 'italic'] as const).flatMap((fontStyle) => [
      { src: absolute(devanagari), fontWeight: 400, fontStyle },
      { src: absolute(deva600), fontWeight: 600, fontStyle },
      { src: absolute(deva700), fontWeight: 700, fontStyle },
    ]),
  ],
});
Font.registerHyphenationCallback((word) => [word]);
self.onmessage = async (event: MessageEvent<Quotation>) => {
  try {
    let best = await pdf(<QuotationPdf quote={event.data} />).toBlob();
    let pageCount = (await PDFDocument.load(await best.arrayBuffer())).getPageCount();
    // Try progressively smaller print sizes for a clean one-page quotation.
    const profiles: { density: QuotationDensity; scale: number }[] = [
      { density: 'compact', scale: 0.88 },
      { density: 'compact', scale: 0.76 },
    ];
    for (const profile of profiles) {
      if (pageCount === 1) break;
      const candidate = await pdf(
        <QuotationPdf quote={event.data} density={profile.density} fitScale={profile.scale} />,
      ).toBlob();
      const count = (await PDFDocument.load(await candidate.arrayBuffer())).getPageCount();
      if (count < pageCount) {
        best = candidate;
        pageCount = count;
      }
    }
    self.postMessage({ blob: best });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Could not generate the PDF.',
    });
  }
};
