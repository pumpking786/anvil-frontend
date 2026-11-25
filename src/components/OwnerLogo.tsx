import { ThemeLogo } from './ThemeLogo';
import { Mark } from './ui';

export function OwnerLogo({ src, width }: { src: string; width: number }) {
  return src ? (
    <ThemeLogo
      className="owner-portal-logo"
      src={src}
      alt="Owner Portal logo"
      style={{ width }}
      fetchPriority="high"
    />
  ) : (
    <Mark />
  );
}
