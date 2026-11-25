import type { Company, HeaderContent } from './types';
// Keep empty fields and user-entered line breaks from leaving dangling separators.
const inline = (value: string) => value.trim().replace(/\s+/g, ' ');
export const companySlogan = (company: Company, content?: HeaderContent) =>
  content?.slogan ?? company.slogan ?? 'Forging IT Excellence';
export function companyHeaderContent(company: Company, content?: HeaderContent) {
  return {
    registration:
      content?.registration ??
      [company.pan.trim() && `VAT / PAN: ${inline(company.pan)}`, inline(company.address)]
        .filter(Boolean)
        .join(' | '),
    contact:
      content?.contact ??
      [
        company.phone.trim() && `Phone: ${inline(company.phone)}`,
        company.email.trim() && `Email: ${inline(company.email)}`,
      ]
        .filter(Boolean)
        .join(' | '),
    slogan: companySlogan(company, content),
  };
}
export function companyContactRows(company: Company, overrides?: HeaderContent) {
  const content = companyHeaderContent(company, overrides);
  return (['registration', 'contact'] as const)
    .map((key) => ({ key, text: content[key] }))
    .filter((row) => row.text.trim());
}
export const companyContactLines = (company: Company) =>
  companyContactRows(company).map((row) => row.text);
