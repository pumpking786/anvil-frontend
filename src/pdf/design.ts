import { readableAccent } from '../lib/theme';
import type { DocumentStyle } from '../domain/types';
// Shared by the PDF renderer and the on-screen/print document.
export const DOCUMENT_LAYOUT = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  margin: 34,
  bodySize: 9.5,
  rowPadding: 4,
  lineHeight: 1.35,
};
// Fine contour lines echo Anvil's stationery; shared vector paths keep print and PDF crisp.
export const LETTERHEAD_CURVES = Array.from({ length: 8 }, (_, index) => {
  const offset = index * 10;
  return `M ${216 + index * 13} -12 C ${238 + index * 13} ${58 - offset * 0.3}, 410 ${8 - offset * 0.25}, 487 ${31 - offset * 0.35} S 572 ${75 - offset * 0.2}, 604 ${111 - offset * 0.4}`;
});
export function documentArtwork(header: DocumentStyle['header']) {
  if (header === 'executive')
    return [{ d: 'M 0 0 L 595 0 L 595 8 L 0 8 Z', fill: true, opacity: 1 }];
  if (header === 'ribbon')
    return [
      { d: 'M 395 0 L 548 0 L 595 47 L 595 65 Z', fill: true, opacity: 1 },
      { d: 'M 340 0 L 420 0 L 595 175 L 595 105 Z', fill: true, opacity: 0.06 },
    ];
  if (header === 'architect')
    return [
      { d: 'M 388 0 L 595 116 M 451 0 L 595 80 M 510 0 L 595 47', fill: false, opacity: 0.24 },
      { d: 'M 0 28 L 7 28 L 7 116 L 0 116 Z', fill: true, opacity: 1 },
    ];
  if (header === 'horizon')
    return [
      { d: 'M 0 0 L 595 0 L 595 5 L 0 5 Z', fill: true, opacity: 1 },
      { d: 'M 34 18 L 560 18', fill: false, opacity: 0.3 },
    ];
  if (header === 'frame')
    return [{ d: 'M 18 90 L 18 18 L 90 18 M 505 18 L 577 18 L 577 90', fill: false, opacity: 0.7 }];
  if (header === 'ledger')
    return [{ d: 'M 34 16 L 118 16 L 118 20 L 34 20 Z', fill: true, opacity: 1 }];
  if (header === 'mesh')
    return Array.from({ length: 8 }, (_, i) => ({
      d: `M ${380 + i * 28} 0 L ${324 + i * 28} 112 M 390 ${i * 16} L 595 ${i * 16}`,
      fill: false,
      opacity: 0.11,
    }));
  if (header === 'spotlight')
    return [
      {
        d: 'M 295 -65 C 175 -65 175 72 295 72 C 415 72 415 -65 295 -65 Z',
        fill: true,
        opacity: 0.05,
      },
      { d: 'M 535 0 L 595 0 L 595 60 Z', fill: true, opacity: 0.5 },
    ];
  if (header === 'lines')
    return LETTERHEAD_CURVES.map((d, index) => ({ d, fill: false, opacity: 0.16 + index * 0.025 }));
  if (header === 'wave')
    return [
      { d: 'M 255 0 C 370 78 472 6 596 104 L 596 0 Z', fill: true, opacity: 0.08 },
      { d: 'M 325 0 C 438 46 510 24 596 75', fill: false, opacity: 0.32 },
    ];
  if (header === 'bubble')
    return [
      {
        d: 'M 615 -55 C 485 -55 485 125 615 125 C 740 125 740 -55 615 -55 Z',
        fill: true,
        opacity: 0.09,
      },
      {
        d: 'M 476 -30 C 408 -30 408 45 476 45 C 543 45 543 -30 476 -30 Z',
        fill: false,
        opacity: 0.2,
      },
    ];
  if (header === 'folder')
    return [{ d: 'M 352 0 L 595 0 L 595 15 L 370 15 Z', fill: true, opacity: 1 }];
  if (header === 'dual')
    return [
      { d: 'M 34 13 L 212 13', fill: false, opacity: 0.7 },
      { d: 'M 226 13 L 561 13', fill: false, opacity: 0.2 },
    ];
  return [];
}
export function documentTheme(accent: string, ink = '#263748') {
  const channels = accent
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16));
  const tint =
    '#' +
    channels
      .map((value) =>
        Math.round(value * 0.055 + 255 * 0.945)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  return {
    accent: readableAccent(accent),
    tint,
    ink,
    muted: '#657587',
    line: '#dce4ed',
  };
}
