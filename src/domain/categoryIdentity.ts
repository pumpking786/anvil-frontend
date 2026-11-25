export type CategoryTone = 'blue' | 'cyan' | 'green' | 'amber' | 'rose' | 'slate';
export type CategoryGlyph =
  | 'government'
  | 'bank'
  | 'insurance'
  | 'enterprise'
  | 'education'
  | 'server'
  | 'network'
  | 'computer'
  | 'printer'
  | 'software'
  | 'service'
  | 'cloud'
  | 'storage'
  | 'security'
  | 'furniture'
  | 'power'
  | 'package';
export interface CategoryIdentity {
  tone: CategoryTone;
  glyph: CategoryGlyph;
  label: string;
}
const customerTypes: Record<string, Pick<CategoryIdentity, 'tone' | 'glyph'>> = {
  government: { tone: 'blue', glyph: 'government' },
  banking: { tone: 'green', glyph: 'bank' },
  insurance: { tone: 'amber', glyph: 'insurance' },
  enterprise: { tone: 'cyan', glyph: 'enterprise' },
  education: { tone: 'blue', glyph: 'education' },
};
const productTypes: { pattern: RegExp; tone: CategoryTone; glyph: CategoryGlyph }[] = [
  { pattern: /\b(server|servers|rack|racks)\b/, tone: 'blue', glyph: 'server' },
  {
    pattern: /\b(network\w*|router\w*|switch\w*|wifi|wi-fi|wireless|cabling)\b/,
    tone: 'cyan',
    glyph: 'network',
  },
  {
    pattern: /\b(security|firewall\w*|antivirus|cctv|surveillance)\b/,
    tone: 'amber',
    glyph: 'security',
  },
  { pattern: /\b(cloud|hosting)\b/, tone: 'cyan', glyph: 'cloud' },
  { pattern: /\b(storage|disk\w*|drive\w*|ssd|hdd|nas|backup)\b/, tone: 'blue', glyph: 'storage' },
  {
    pattern: /\b(printer\w*|printing|scanner\w*|toner|copier\w*)\b/,
    tone: 'slate',
    glyph: 'printer',
  },
  { pattern: /\b(software|licen[cs]\w*|application\w*|saas)\b/, tone: 'blue', glyph: 'software' },
  {
    pattern: /\b(service\w*|support|maintenance|consult\w*|training|installation)\b/,
    tone: 'green',
    glyph: 'service',
  },
  {
    pattern:
      /\b(computer\w*|hardware|laptop\w*|desktop\w*|workstation\w*|monitor\w*|accessor\w*)\b/,
    tone: 'blue',
    glyph: 'computer',
  },
  { pattern: /\b(furniture|chair\w*|desk\w*|table\w*)\b/, tone: 'amber', glyph: 'furniture' },
  { pattern: /\b(power|ups|batter\w*|electrical)\b/, tone: 'rose', glyph: 'power' },
];

/** Stable category identity across browsers, themes and edits to a product name. */
export function categoryIdentity(category: string, kind: 'customer' | 'product'): CategoryIdentity {
  const label =
    category.trim().replace(/\s+/g, ' ') || (kind === 'customer' ? 'Enterprise' : 'General');
  const key = label.toLowerCase();
  if (kind === 'customer') return { label, ...(customerTypes[key] || customerTypes.enterprise) };
  const known = productTypes.find(({ pattern }) => pattern.test(key));
  if (known) return { label, tone: known.tone, glyph: known.glyph };
  if (key === 'general') return { label, tone: 'slate', glyph: 'package' };
  const tones: CategoryTone[] = ['blue', 'cyan', 'green', 'amber', 'rose', 'slate'];
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return { label, tone: tones[hash % tones.length], glyph: 'package' };
}
