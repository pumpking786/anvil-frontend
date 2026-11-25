import { useEffect, useRef, useState } from 'react';

export const workspacePages = [
  'dashboard',
  'quotations',
  'customers',
  'products',
  'crm',
  'company',
  'users',
  'email-history',
  'profile',
  'settings',
  'editor',
] as const;
export type Page = (typeof workspacePages)[number];
const base = 'https://routing.invalid';
const navigationEvent = 'patra-navigation';

export function routeFor(value: string) {
  const url = new URL(value, base);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const page = workspacePages.find((page) => path === `/${page}`);
  return { path, page, known: !!page || ['/', '/login', '/owner'].includes(path) };
}

// Accept only known, same-app destinations. Never redirect to an external URL,
// the owner portal, or another login URL supplied in a query parameter.
export function safeDestination(value: string | null): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value))
    return undefined;
  const url = new URL(value, base);
  if (url.origin !== base || !routeFor(value).page) return undefined;
  return `${routeFor(value).path}${url.search}${url.hash}`;
}

export function canOpenPage(page: Page, admin: boolean) {
  return admin || !['company', 'users', 'email-history'].includes(page);
}

export function loginUrl(requested: string) {
  const destination = safeDestination(requested);
  return destination ? `/login?redirect=${encodeURIComponent(destination)}` : '/login';
}

export function postLoginUrl(requested: string, admin: boolean) {
  const url = new URL(requested, base);
  const destination =
    safeDestination(
      routeFor(requested).path === '/login' ? url.searchParams.get('redirect') : requested,
    ) || '/dashboard';
  return canOpenPage(routeFor(destination).page!, admin) ? destination : '/dashboard';
}

export function currentUrl() {
  return `${location.pathname}${location.search}${location.hash}`;
}

const historyIndex = () =>
  Number.isInteger(history.state?.patraRouteIndex) ? (history.state.patraRouteIndex as number) : 0;

export function navigateUrl(url: string, replace = false) {
  if (url === currentUrl()) return;
  history[replace ? 'replaceState' : 'pushState'](
    { ...history.state, patraRouteIndex: historyIndex() + (replace ? 0 : 1) },
    '',
    url,
  );
  window.dispatchEvent(new Event(navigationEvent));
}

export function watchLocation(guard: (action: () => void) => void, changed: (url: string) => void) {
  history.replaceState({ ...history.state, patraRouteIndex: historyIndex() }, '', currentUrl());
  let previous = { url: currentUrl(), index: historyIndex() };
  let reverting = false;
  let afterRevert: (() => void) | undefined;
  let allowedIndex: number | undefined;
  const update = () => {
    previous = { url: currentUrl(), index: historyIndex() };
    changed(previous.url);
  };
  const pop = () => {
    if (reverting) {
      reverting = false;
      const proceed = afterRevert;
      afterRevert = undefined;
      proceed?.();
      return;
    }
    if (allowedIndex === historyIndex()) {
      allowedIndex = undefined;
      update();
      return;
    }
    const destination = currentUrl();
    const destinationIndex = historyIndex();
    const delta = destinationIndex - previous.index;
    let accepted = false;
    let deferred = false;
    guard(() => {
      accepted = true;
      if (!deferred) return update();
      const proceed = () => {
        if (!delta) return navigateUrl(destination);
        allowedIndex = destinationIndex;
        history.go(delta);
      };
      if (reverting) afterRevert = proceed;
      else proceed();
    });
    if (!accepted) {
      deferred = true;
      // Restore the current history entry while the unsaved-change prompt is
      // open. Cancelling must not overwrite or skip the requested Back entry.
      if (delta) {
        reverting = true;
        history.go(-delta);
      } else history.replaceState(history.state, '', previous.url);
    }
  };
  window.addEventListener(navigationEvent, update);
  window.addEventListener('popstate', pop);
  return () => {
    window.removeEventListener(navigationEvent, update);
    window.removeEventListener('popstate', pop);
  };
}

export function useAppLocation(onHistoryNavigation: (action: () => void) => void) {
  const [url, setUrl] = useState(currentUrl);
  const guard = useRef(onHistoryNavigation);
  guard.current = onHistoryNavigation;
  useEffect(() => watchLocation((action) => guard.current(action), setUrl), []);
  return url;
}
