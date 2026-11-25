import { safeImageSource } from './imagePolicy.mjs';
import { useSyncExternalStore } from 'react';
import type { BrandAppearance } from '../domain/types';
let generation = 0;
let installationIcon: string | undefined;
let fallbackIcon: string | undefined;
let fallbackAppearance: BrandAppearance | undefined;
let installationAppearance: BrandAppearance | undefined;
let previewActive = false;
let activeFavicon = '';
const faviconListeners = new Set<() => void>();
export function useActiveFavicon() {
  return useSyncExternalStore(
    (listener) => {
      faviconListeners.add(listener);
      return () => {
        faviconListeners.delete(listener);
      };
    },
    () => activeFavicon,
  );
}
export function setInstallationFavicon(value: string | undefined, appearance?: BrandAppearance) {
  installationIcon = value;
  installationAppearance = appearance;
  applyFavicon(fallbackIcon, fallbackAppearance, previewActive);
}
export function applyFavicon(dataUrl?: string, appearance?: BrandAppearance, preview = false) {
  previewActive = preview;
  fallbackIcon = dataUrl;
  fallbackAppearance = appearance;
  if (installationIcon && !preview) {
    dataUrl = installationIcon;
    appearance = installationAppearance;
  }
  dataUrl = safeImageSource(dataUrl);
  if (activeFavicon !== dataUrl) {
    activeFavicon = dataUrl;
    faviconListeners.forEach((listener) => listener());
  }
  const active = ++generation;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }
  link.removeAttribute('type');
  link.href = dataUrl || '/favicon.svg';
  if (!dataUrl || !appearance) return;
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    if (active !== generation || !link || !image.naturalWidth || !image.naturalHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pad = (64 * Math.min(25, Math.max(0, appearance.faviconPadding || 0))) / 100,
      size = 64 - pad * 2;
    const scale = (appearance.faviconFit === 'cover' ? Math.max : Math.min)(
      size / image.naturalWidth,
      size / image.naturalHeight,
    );
    const width = image.naturalWidth * scale,
      height = image.naturalHeight * scale;
    ctx.beginPath();
    ctx.rect(pad, pad, size, size);
    ctx.clip();
    ctx.drawImage(image, (64 - width) / 2, (64 - height) / 2, width, height);
    try {
      link.href = canvas.toDataURL('image/png');
    } catch {
      // Keep the original image URL if its host does not allow canvas access.
    }
  };
  image.src = dataUrl;
}
