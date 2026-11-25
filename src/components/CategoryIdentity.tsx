import {
  Landmark,
  WalletCards,
  ShieldCheck,
  Building2,
  GraduationCap,
  Server,
  Network,
  Monitor,
  Printer,
  Code2,
  Wrench,
  Cloud,
  HardDrive,
  Shield,
  Armchair,
  Zap,
  Package,
} from 'lucide-react';
import { categoryIdentity, type CategoryGlyph } from '../domain/categoryIdentity';
const glyphs: Record<CategoryGlyph, typeof Package> = {
  government: Landmark,
  bank: WalletCards,
  insurance: ShieldCheck,
  enterprise: Building2,
  education: GraduationCap,
  server: Server,
  network: Network,
  computer: Monitor,
  printer: Printer,
  software: Code2,
  service: Wrench,
  cloud: Cloud,
  storage: HardDrive,
  security: Shield,
  furniture: Armchair,
  power: Zap,
  package: Package,
};
type Props = { category: string; kind: 'customer' | 'product' };
export function CategoryIcon({ category, kind, large = false }: Props & { large?: boolean }) {
  const identity = categoryIdentity(category, kind);
  const Icon = glyphs[identity.glyph];
  return (
    <span
      className={`category-avatar tone-${identity.tone}${large ? ' is-large' : ''}`}
      aria-hidden="true"
    >
      <Icon size={large ? 25 : 20} strokeWidth={1.8} />
    </span>
  );
}
export function CategoryBadge({ category, kind, icon = true }: Props & { icon?: boolean }) {
  const identity = categoryIdentity(category, kind);
  const Icon = glyphs[identity.glyph];
  return (
    <span className={`category category-badge tone-${identity.tone}`}>
      {icon && <Icon size={13} aria-hidden="true" strokeWidth={2} />}
      <span>{identity.label}</span>
    </span>
  );
}
