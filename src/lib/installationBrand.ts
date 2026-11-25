import { useSyncExternalStore } from 'react';
import { normalizeApiUrl } from './apiUrl';
import { setInstallationFavicon } from './brandAssets';
import type { Branding, ImageFrame } from '../domain/types';
import { platformLabel } from './appName';
export interface SharedBrand {
  favicon: string;
  ownerLogo: string;
  ownerLogoWidth: number;
  ownerAppName?: string;
  ownerAppSubtitle?: string;
  ownerLoginLogo?: string;
  ownerLoginLogoWidth?: number;
  ownerLoginLogoFrame?: ImageFrame;
  faviconFit?: 'contain' | 'cover';
  faviconPadding?: number;
  loginBrand?: Branding | null;
}
export interface InstallationBrand extends SharedBrand {
  version: number;
  useWorkspaceBranding: boolean;
  workspaceBrand?: SharedBrand | null;
  workspaceAvailable?: boolean;
}
export function effectiveInstallationBrand(value: InstallationBrand): InstallationBrand {
  return value.useWorkspaceBranding && value.workspaceBrand
    ? {
        ...value,
        ...value.workspaceBrand,
        ownerAppName: value.ownerAppName,
        ownerAppSubtitle: value.ownerAppSubtitle,
        favicon: value.workspaceBrand.favicon || value.favicon,
        workspaceAvailable: true,
      }
    : {
        ...value,
        loginBrand: value.workspaceBrand?.loginBrand ?? value.loginBrand,
        workspaceAvailable: value.workspaceAvailable ?? !!value.workspaceBrand,
      };
}
export const defaultLoginBrand: Branding = {
  name: 'Anvil Technologies Business Forge Platform',
  logo: '',
  accent: '#174A78',
  appLogo: '',
  favicon: '',
  loginLogoWidth: 150,
  loginBackground: '',
  loginBackgroundColor: '#174A78',
};
export function resolveLoginBrand(
  installation: InstallationBrand,
  fallback: Branding = defaultLoginBrand,
  owner = false,
): Branding {
  // A complete server snapshot replaces cached fields, including cleared images.
  const base =
    installation.loginBrand === undefined ? fallback : installation.loginBrand || defaultLoginBrand;
  if (!owner) return base;
  const shared = installation.useWorkspaceBranding && installation.workspaceAvailable;
  return {
    ...base,
    ownerAppName: installation.ownerAppName,
    ownerAppSubtitle: installation.ownerAppSubtitle,
    ...(shared
      ? {}
      : {
          logo: installation.ownerLogo,
          loginLogoWidth: installation.ownerLogoWidth,
          appearance: {
            ...base.appearance,
            loginLogo: installation.ownerLogo,
            loginLogoFrame: undefined,
          },
        }),
  };
}
const emptyBrand: InstallationBrand = {
  favicon: '',
  ownerLogo: '',
  ownerLogoWidth: 140,
  ownerAppName: 'Anvil Technologies',
  ownerAppSubtitle: 'Business Forge Platform',
  version: 0,
  useWorkspaceBranding: true,
};
let snapshot = emptyBrand;
const listeners = new Set<() => void>();
function updateSnapshot(value: InstallationBrand) {
  snapshot = {
    ...emptyBrand,
    ...value,
    ownerAppSubtitle: platformLabel(value.ownerAppSubtitle),
  };
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getInstallationBrandSnapshot = () => snapshot;
export function useInstallationBrand() {
  return useSyncExternalStore(subscribe, getInstallationBrandSnapshot);
}
let source = '',
  brandRevision = '',
  serial = 0;
let pending: { source: string; serial: number; promise: Promise<void> } | undefined;
const cacheKey = (url: string) => `patra-public-brand:v1:${url}`;
const warmedImages = new Set<string>();
function warmImages(value: InstallationBrand) {
  if (typeof Image === 'undefined') return;
  for (const src of [
    value.favicon,
    value.loginBrand?.appearance?.loginLogo || value.loginBrand?.logo,
    value.loginBrand?.loginBackground,
    value.ownerLogo,
  ]) {
    if (!src || warmedImages.has(src)) continue;
    if (warmedImages.size >= 12) warmedImages.delete(warmedImages.values().next().value!);
    warmedImages.add(src);
    const image = new Image();
    image.fetchPriority = 'high';
    image.src = src;
  }
}
function cacheBrand(value: InstallationBrand) {
  if (!source) return;
  // Persist only the anonymous branding projection, never the owner configuration.
  const {
    version,
    favicon,
    ownerLogo,
    ownerLogoWidth,
    ownerAppName,
    ownerAppSubtitle,
    ownerLoginLogo,
    ownerLoginLogoWidth,
    ownerLoginLogoFrame,
    faviconFit,
    faviconPadding,
    loginBrand,
    useWorkspaceBranding,
    workspaceAvailable,
  } = value;
  try {
    localStorage.setItem(
      cacheKey(source),
      JSON.stringify({
        savedAt: Date.now(),
        revision: brandRevision,
        brand: {
          version,
          favicon,
          ownerLogo,
          ownerLogoWidth,
          ownerAppName,
          ownerAppSubtitle,
          ownerLoginLogo,
          ownerLoginLogoWidth,
          ownerLoginLogoFrame,
          faviconFit,
          faviconPadding,
          loginBrand,
          useWorkspaceBranding,
          workspaceAvailable,
        },
      }),
    );
  } catch {
    /* A full or unavailable browser cache must not block sign-in. */
  }
}
function cachedBrand(url: string): InstallationBrand | undefined {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(url)) || 'null');
    if (
      !cached ||
      Date.now() - cached.savedAt > 30 * 86400000 ||
      !Number.isFinite(cached.savedAt) ||
      typeof cached.brand?.version !== 'number' ||
      typeof cached.brand?.favicon !== 'string'
    )
      return;
    brandRevision = /^[a-f0-9]{64}$/.test(cached.revision) ? cached.revision : '';
    return cached.brand;
  } catch {
    return;
  }
}
export function setFaviconSource(url: string) {
  try {
    const next = normalizeApiUrl(url);
    if (source === next) return;
    source = next;
    brandRevision = '';
    serial++;
    const cached = cachedBrand(next);
    updateSnapshot(cached || emptyBrand);
    setInstallationFavicon(cached?.favicon || undefined, cached);
    if (cached) warmImages(cached);
    void refreshInstallationBrand();
  } catch {
    /* An incomplete API URL does not change the active icon. */
  }
}
export function refreshInstallationBrand(): Promise<void> {
  if (!source) return Promise.resolve();
  if (pending?.source === source && pending.serial === serial) return pending.promise;
  const current = source,
    request = serial;
  const promise = (async () => {
    try {
      const query = brandRevision ? `?since=${encodeURIComponent(brandRevision)}` : '';
      const response = await fetch(current + '/public/branding' + query, {
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (source !== current || serial !== request || response.status === 204 || !response.ok)
        return;
      const data = (await response.json()) as InstallationBrand;
      if (source !== current || serial !== request) return;
      if (typeof data.version !== 'number' || typeof data.favicon !== 'string') return;
      const revision = response.headers.get('X-Patra-Brand-Revision') || '';
      brandRevision = /^[a-f0-9]{64}$/.test(revision) ? revision : '';
      updateSnapshot(data);
      warmImages(data);
      cacheBrand(data);
      setInstallationFavicon(data.favicon || '/favicon.svg', data);
    } catch {
      /* Keep the last known branding while offline. */
    }
  })().finally(() => {
    if (pending?.promise === promise) pending = undefined;
  });
  pending = { source: current, serial: request, promise };
  return promise;
}
function broadcast() {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('patra-installation-brand');
  channel.postMessage({ source });
  channel.close();
}
export function publishInstallationBrand(value: InstallationBrand) {
  serial++;
  brandRevision = '';
  const effective = effectiveInstallationBrand(value);
  updateSnapshot(effective);
  warmImages(effective);
  cacheBrand(effective);
  setInstallationFavicon(effective.favicon || '/favicon.svg', effective);
  broadcast();
}
export async function syncInstallationBrand() {
  // A save must not reuse a request started before the mutation completed.
  serial++;
  await refreshInstallationBrand();
  broadcast();
}
export function watchInstallationBrand(url: string) {
  setFaviconSource(url);
  void refreshInstallationBrand();
  const channel =
    typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel('patra-installation-brand')
      : undefined;
  if (channel)
    channel.onmessage = (event) => {
      if (event.data?.source === source) {
        serial++;
        void refreshInstallationBrand();
      }
    };
  const refresh = () => {
    if (document.visibilityState === 'visible') void refreshInstallationBrand();
  };
  const timer = setInterval(refresh, 5000);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  return () => {
    clearInterval(timer);
    channel?.close();
    document.removeEventListener('visibilitychange', refresh);
    window.removeEventListener('focus', refresh);
    window.removeEventListener('online', refresh);
  };
}
