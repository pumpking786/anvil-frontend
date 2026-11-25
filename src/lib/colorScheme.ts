import { useSyncExternalStore } from 'react';
export type ColorScheme = 'light' | 'dark' | 'system';
const listeners = new Set<() => void>();
const valid = (value: string | null): ColorScheme =>
  value === 'light' || value === 'dark' ? value : 'system';
let preference: ColorScheme = 'system';
let initialized = false;
let transitionTimer: ReturnType<typeof setTimeout> | undefined;
function apply(animate = false) {
  const dark =
    preference === 'dark' ||
    (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  const root = document.documentElement;
  const next = dark ? 'dark' : 'light';
  if (
    animate &&
    root.dataset.theme !== next &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    clearTimeout(transitionTimer);
    root.classList.add('theme-changing');
    transitionTimer = setTimeout(() => root.classList.remove('theme-changing'), 300);
  }
  root.dataset.theme = next;
  listeners.forEach((listener) => listener());
}
export function initializeColorScheme() {
  if (initialized) return;
  initialized = true;
  try {
    preference = valid(localStorage.getItem('patra-color-scheme'));
  } catch {
    /* Use system appearance. */
  }
  apply();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => apply(true));
  window.addEventListener('storage', (event) => {
    if (event.key === 'patra-color-scheme' || event.key === null) {
      preference = valid(event.newValue);
      apply(true);
    }
  });
}
export function setColorScheme(value: ColorScheme) {
  preference = value;
  try {
    localStorage.setItem('patra-color-scheme', value);
  } catch {
    /* Still apply for this tab. */
  }
  apply(true);
}
export function useColorScheme() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => `${preference}:${document.documentElement.dataset.theme}`,
  ).split(':')[0] as ColorScheme;
}
