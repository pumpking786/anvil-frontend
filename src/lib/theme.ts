import type { BrandAppearance } from '../domain/types';
export function contrastText(hex: string) {
  const rgb = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) || [0, 0, 0];
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 0.179 ? '#17232e' : '#ffffff';
}

export const readableAccent = (accent: string) =>
  contrastText(accent) === '#17232e' ? '#263e55' : accent;
export const ANVIL_ACCENT = '#174A78';

export function loginBackgroundStyle(image: string, color: string, appearance?: BrandAppearance) {
  return {
    backgroundColor: color || ANVIL_ACCENT,
    backgroundImage: image
      ? `linear-gradient(rgba(14, 30, 49, .18), rgba(14, 30, 49, .18)), url("${image}")`
      : 'none',
    backgroundSize: appearance?.backgroundFit || 'cover',
    backgroundPosition: appearance?.backgroundPosition || 'center',
    backgroundRepeat: 'no-repeat',
  };
}
