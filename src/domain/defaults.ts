import type { Workspace } from './types';
export const DEFAULT_TERMS =
  '1. Prices are in Nepali Rupees (NPR). VAT is shown separately where applicable.\n2. This quotation is valid until the validity date stated above.\n3. Delivery and payment schedules will be confirmed upon order acceptance.\n4. Please reference the quotation number when confirming your order.';
export function emptyWorkspace(name = ''): Workspace {
  return {
    schemaVersion: 1,
    company: {
      name,
      address: '',
      phone: '',
      email: '',
      pan: '',
      logo: '',
      signature: '',
      stamp: '',
      accent: '#174A78',
      terms: DEFAULT_TERMS,
      signatory: 'Authorized signatory',
      slogan: 'Forging IT Excellence',
    },
    customers: [],
    quotations: [],
    nextNumber: 1,
    sequenceYear: '',
    products: [],
    leads: [],
    users: [],
    settings: {
      quotePrefix: 'ANV',
      validityDays: 30,
      defaultVat: true,
      defaultVatRate: 13,
      defaultDesign: 'classic',
      lowStockThreshold: 5,
      defaultLogoWidth: 132,
      appLogo: '',
      favicon: '',
      loginLogoWidth: 150,
      loginBackground: '',
      loginBackgroundColor: '#174A78',
      fiscalYearOverride: '',
      fiscalYearOverrideFor: '',
    },
  };
}
