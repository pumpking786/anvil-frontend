import type { AdminSettings, Company, DocumentStyle, Quotation } from './types';
import { addDays, today, VAT_RATE } from './quotation';
export const HEADER_STYLES = [
  'ribbon',
  'architect',
  'horizon',
  'frame',
  'ledger',
  'mesh',
  'light',
  'bubble',
  'wave',
  'folder',
  'dual',
  'lines',
] as const;
export const HEADER_LABELS: Record<DocumentStyle['header'], string> = {
  executive: 'Executive',
  ribbon: 'Ribbon',
  architect: 'Architect',
  horizon: 'Horizon',
  frame: 'Frame',
  ledger: 'Ledger',
  mesh: 'Mesh',
  spotlight: 'Spotlight',
  light: 'Light',
  bubble: 'Bubble',
  wave: 'Wave',
  folder: 'Folder',
  center: 'Center',
  dual: 'Dual',
  lines: 'Lines',
};
export const TABLE_STYLES = ['light', 'boxed', 'bold', 'striped', 'bubble', 'column'] as const;
export const DOCUMENT_FONTS = {
  'dm-sans': 'DM Sans',
  'open-sans': 'Open Sans',
  newsreader: 'Newsreader',
} as const;
export function defaultDocumentStyle(accent = '#174A78'): DocumentStyle {
  return {
    header: 'lines',
    table: 'light',
    font: 'dm-sans',
    fontSize: 9.5,
    primaryColor: accent,
    textColor: '#263748',
    headerImage: '',
    tagline: '',
    footer: '#ForgingITExcellence',
  };
}
export function resolveDocumentStyle(quote: Pick<Quotation, 'company' | 'layout'>): DocumentStyle {
  const defaults = defaultDocumentStyle(quote.company.accent);
  if (quote.layout?.design === 'minimal') defaults.header = 'light';
  if (quote.layout?.design === 'bordered') {
    defaults.header = 'dual';
    defaults.table = 'boxed';
  }
  return { ...defaults, ...quote.layout?.document };
}
// An uploaded letterhead owns the header. Keep the chosen template stored so removing
// the image restores it, but never let its artwork or layout affect the upload.
export function renderedDocumentStyle(quote: Pick<Quotation, 'company' | 'layout'>): DocumentStyle {
  const style = resolveDocumentStyle(quote);
  return style.headerImage ? { ...style, header: 'light' } : style;
}
// Keep a consistent typographic hierarchy at every supported reading size.
export function documentTypography(style: DocumentStyle, scale = 1) {
  const body = Math.min(11, Math.max(9, style.fontSize)) * scale;
  return {
    body,
    detail: body - 0.75,
    small: body - 1.5,
    heading: body + 8.5,
    reference: body + 1.5,
    total: body + 3,
    rowPadding: 5,
    lineHeight: 1.5,
  };
}
export function documentPreviewQuote(company: Company, settings?: AdminSettings): Quotation {
  const date = today();
  return {
    id: crypto.randomUUID(),
    number: 'LAYOUT PREVIEW',
    date,
    validUntil: addDays(date, 30),
    status: 'Draft',
    company: { ...company, name: company.name || 'Your company' },
    customer: {
      id: crypto.randomUUID(),
      name: 'Sample customer',
      address: 'Kathmandu, Nepal',
      phone: '',
      email: '',
      pan: '123456789',
      category: 'Enterprise',
      photo: '',
    },
    items: [
      {
        id: crypto.randomUUID(),
        description: 'Business equipment\nSupply and installation',
        quantity: 2,
        unitPrice: 25000,
      },
      {
        id: crypto.randomUUID(),
        description: 'Professional services',
        quantity: 1,
        unitPrice: 15000,
      },
      {
        id: crypto.randomUUID(),
        description: 'Support and maintenance',
        quantity: 1,
        unitPrice: 5000,
      },
    ],
    discount: 1000,
    vatEnabled: settings?.defaultVat ?? true,
    vatRate: settings?.defaultVatRate ?? VAT_RATE,
    terms: company.terms,
    layout: {
      design: settings?.defaultDesign || 'classic',
      logoWidth: settings?.defaultLogoWidth || 132,
      document: settings?.document,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
