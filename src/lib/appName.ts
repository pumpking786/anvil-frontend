export const APP_NAME = 'Anvil Technologies Business Forge Platform';
export const APP_SUBTITLE = 'Business Forge Platform';

/** Upgrade saved labels from the previous app name while retaining custom branding. */
export function platformLabel(value: string | undefined, fallback = APP_SUBTITLE): string {
  if (value === undefined) return fallback;
  return value.replaceAll('Customer Lifecycle Platform', APP_SUBTITLE);
}

export function platformTitle(name?: string, subtitle?: string): string {
  const title = platformLabel(subtitle, APP_SUBTITLE).trim();
  const company = name?.trim() || 'Anvil Technologies';
  // Some installations saved the complete app name in the subtitle field.
  if (
    title === APP_NAME ||
    (title === APP_SUBTITLE && /^Anvil Technologies(?: Pvt\. Ltd\.)?$/i.test(company))
  )
    return APP_NAME;
  return [company, title].filter(Boolean).join(' ').replace(/\s+/g, ' ');
}
