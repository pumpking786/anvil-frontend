import { useEffect, useState } from 'react';
import type { AdminSettings, ImageFrame } from '../domain/types';
import { appearanceStyle, imageFrameStyle } from '../domain/appearance';
import { BrandLogo } from './ui';
import { platformLabel } from '../lib/appName';

export function useNavigationLogoFrame(settings: AdminSettings): ImageFrame {
  const [imageSize, setImageSize] = useState({ src: '', ratio: 1 });
  useEffect(() => {
    const src = settings.appLogo;
    if (!src) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active && image.naturalHeight)
        setImageSize({ src, ratio: image.naturalWidth / image.naturalHeight });
    };
    image.src = src;
    return () => {
      active = false;
    };
  }, [settings.appLogo]);
  if (settings.brand?.navigationLogo) return settings.brand.navigationLogo;
  const ratio = imageSize.src === settings.appLogo ? imageSize.ratio : 1;
  const height = Math.min(settings.appLogoSize || 32, 190 / ratio);
  return {
    width: Math.max(16, Math.round(height * ratio)),
    height: Math.max(16, Math.round(height)),
    fit: 'contain',
    position: 'center',
  };
}

export function NavigationBrand({ settings }: { settings: AdminSettings }) {
  const frame = useNavigationLogoFrame(settings);
  return (
    <>
      <BrandLogo src={settings.appLogo} style={{ ...imageFrameStyle(frame), maxWidth: 'none' }} />
      <span
        className="brand-long"
        style={{
          fontSize: settings.appTextSize || 11,
          ...appearanceStyle(settings.brand?.navigationTextStyle),
        }}
      >
        {platformLabel(settings.brand?.navigationText)}
      </span>
    </>
  );
}
