import type { LineItem, Quotation } from './types';
export const VAT_RATE = 13;
export const VAT_RATE_ERROR = 'Enter a VAT rate from 0 to 100, with up to two decimal places.';
export function isValidVatRate(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  );
}
export function vatLabel(quote: Pick<Quotation, 'vatEnabled' | 'vatRate'>): string {
  return `VAT (${quote.vatEnabled ? `${quote.vatRate ?? VAT_RATE}%` : 'off'})`;
}
export const MAX_AMOUNT = 999_999_999.99;
// All money is rounded to integer paisa. Quantities allow three decimal places.
export function toPaisa(value: number): number {
  return Math.round((value + Number.EPSILON) * 100);
}
export function calculateTotals(
  items: Pick<LineItem, 'quantity' | 'unitPrice'>[],
  discount = 0,
  vatEnabled = true,
  vatRate = VAT_RATE,
) {
  if (!isValidVatRate(vatRate)) throw new Error(VAT_RATE_ERROR);
  if (!Number.isFinite(discount) || discount < 0)
    throw new Error('Discount must be zero or greater.');
  const lines = items.map((item) => {
    if (
      !Number.isFinite(item.quantity) ||
      !Number.isFinite(item.unitPrice) ||
      item.quantity < 0 ||
      item.unitPrice < 0
    )
      throw new Error('Use valid positive quantities and prices.');
    return Math.round(toPaisa(item.unitPrice) * item.quantity);
  });
  const subtotal = lines.reduce((a, b) => a + b, 0);
  const discountPaisa = toPaisa(discount);
  if (discountPaisa > subtotal) throw new Error('Discount cannot exceed the subtotal.');
  const taxable = subtotal - discountPaisa;
  const vat = vatEnabled ? Math.round((taxable * Math.round(vatRate * 100)) / 10000) : 0;
  const total = taxable + vat;
  if (total > toPaisa(MAX_AMOUNT)) throw new Error('Grand total must be below one hundred crore.');
  return {
    lines: lines.map((n) => n / 100),
    subtotal: subtotal / 100,
    discount: discountPaisa / 100,
    taxable: taxable / 100,
    vat: vat / 100,
    total: total / 100,
  };
}
const ones = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function wholeWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return ones[n];
  if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim();
  for (const [value, label] of [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1000, 'Thousand'],
    [100, 'Hundred'],
  ] as const) {
    if (n >= value)
      return `${wholeWords(Math.floor(n / value))} ${label} ${wholeWords(n % value)}`.trim();
  }
  return '';
}
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT)
    throw new Error('Amount is outside the supported range.');
  const paisa = toPaisa(amount);
  const rupees = Math.floor(paisa / 100);
  return `Rupees ${wholeWords(rupees) || 'Zero'}${paisa % 100 ? ` and ${wholeWords(paisa % 100)} Paisa` : ''} Only`;
}
export const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );
export function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
export function quotationErrors(
  q: Pick<
    Quotation,
    'customer' | 'items' | 'date' | 'validUntil' | 'number' | 'discount' | 'vatEnabled' | 'vatRate'
  >,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const rate = q.vatRate === undefined ? VAT_RATE : q.vatRate;
  if (!isValidVatRate(rate)) errors.vatRate = VAT_RATE_ERROR;
  if (!q.customer?.name.trim()) errors.customer = 'Select a customer before saving or printing.';
  if (!q.number.trim()) errors.number = 'Enter a quotation number.';
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(q.date)) errors.date = 'Enter a valid quotation date.';
  if (!validDate(q.validUntil) || q.validUntil < q.date)
    errors.validUntil = 'Validity must be on or after the quotation date.';
  if (!q.items.length) errors.items = 'Add at least one line item.';
  q.items.forEach((item, i) => {
    if (!item.description.trim()) errors[`description-${i}`] = 'Enter an item description.';
    if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 1_000_000)
      errors[`quantity-${i}`] = 'Quantity must be greater than 0 and at most 10,00,000.';
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0 || item.unitPrice > MAX_AMOUNT)
      errors[`price-${i}`] = 'Enter a valid price of zero or greater.';
  });
  try {
    calculateTotals(q.items, q.discount, q.vatEnabled, isValidVatRate(rate) ? rate : VAT_RATE);
  } catch (e) {
    errors.discount = (e as Error).message;
  }
  return errors;
}

// Drafts may omit the customer and item descriptions, but never store invalid money or dates.
export function draftQuotationErrors(q: Parameters<typeof quotationErrors>[0]) {
  const errors = quotationErrors(q);
  delete errors.customer;
  delete errors.items;
  q.items.forEach((_, index) => delete errors[`description-${index}`]);
  return errors;
}
