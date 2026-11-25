import { useState } from 'react';
import { Layers3 } from 'lucide-react';
import { useActiveFavicon } from '../lib/brandAssets';
import { ThemeLogo } from './ThemeLogo';

/** Show original favicon artwork, rather than enlarging its 64px browser-tab rendition. */
export function StartupBrand() {
  const source = useActiveFavicon();
  const [failed, setFailed] = useState('');
  return (
    <div className="startup-brand">
      {source && failed !== source ? (
        <ThemeLogo
          src={source}
          alt="Application logo"
          loading="eager"
          decoding="async"
          onError={() => setFailed(source)}
        />
      ) : (
        <Layers3 size={42} aria-hidden="true" />
      )}
    </div>
  );
}
