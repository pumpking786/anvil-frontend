import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { useColorScheme } from '../lib/colorScheme';
import { lightenLogoInk } from '../lib/logoContrast';

const variants = new Map<string, string>();
/** Screen-only logo treatment. Saved artwork and quotation exports are untouched. */
export function ThemeLogo({
  src = '',
  className = '',
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  useColorScheme();
  const dark = document.documentElement.dataset.theme === 'dark';
  const image = useRef<HTMLImageElement>(null);
  const [variant, setVariant] = useState({ source: '', url: '' });
  const displayed = dark
    ? variants.get(src) || (variant.source === src && variant.url) || src
    : src;
  function prepare() {
    const element = image.current;
    const cached = variants.get(src);
    if (dark && cached) {
      if (displayed !== cached) setVariant({ source: src, url: cached });
      return;
    }
    if (!dark || !element?.complete || !element.naturalWidth || displayed !== src) return;
    try {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 4096 / Math.max(element.naturalWidth, element.naturalHeight));
      canvas.width = Math.max(1, Math.round(element.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(element.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context || canvas.width * canvas.height > 16777216) return;
      context.imageSmoothingQuality = 'high';
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      const changed = lightenLogoInk(data.data, canvas.width, canvas.height);
      if (changed) context.putImageData(data, 0, 0);
      const url = changed ? canvas.toDataURL('image/png') : src;
      if (variants.size >= 12) variants.delete(variants.keys().next().value!);
      variants.set(src, url);
      setVariant({ source: src, url });
    } catch {
      // Keep original artwork when an external image host disallows canvas access.
    }
  }
  useEffect(prepare, [src, dark]);
  return (
    <img
      {...props}
      ref={image}
      src={displayed}
      className={`theme-logo ${className}`}
      crossOrigin="anonymous"
      fetchPriority="high"
      onLoad={prepare}
    />
  );
}
