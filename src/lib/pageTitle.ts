import { useLayoutEffect } from 'react';
import { useInstallationBrand } from './installationBrand';
import { platformTitle } from './appName';

/** Use the configured app name, never account details, in browser-tab metadata. */
export function usePageTitle(page: string | undefined) {
  const brand = useInstallationBrand();
  const name = platformTitle(brand.ownerAppName, brand.ownerAppSubtitle);
  useLayoutEffect(() => {
    if (!page) return;
    const title = `${page} | ${name.replace(/\s+/g, ' ').trim()}`;
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="title"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'title';
      document.head.append(meta);
    }
    meta.content = title;
  }, [page, name]);
}
