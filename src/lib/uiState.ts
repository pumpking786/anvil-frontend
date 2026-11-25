import { useState, type Dispatch, type SetStateAction } from 'react';
let scope = 'signed-out';
export function setUiScope(value: string) {
  scope = value;
}
const key = (name: string) => `patra-ui:${scope}:${name}`;
export function readUiState<T>(name: string, fallback: T): T {
  try {
    return JSON.parse(sessionStorage.getItem(key(name)) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeUiState(name: string, value: unknown) {
  try {
    sessionStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    /* Storage can be unavailable. */
  }
}
export function clearUiState() {
  try {
    for (const name of Object.keys(sessionStorage))
      if (name.startsWith(`patra-ui:${scope}:`)) sessionStorage.removeItem(name);
  } catch {}
}
export function useUiState<T>(
  name: string,
  fallback: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = key(name);
  const [value, update] = useState<T>(() =>
    readUiState(name, typeof fallback === 'function' ? (fallback as () => T)() : fallback),
  );
  const setValue: Dispatch<SetStateAction<T>> = (next) =>
    update((previous) => {
      const result = typeof next === 'function' ? (next as (old: T) => T)(previous) : next;
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(result));
      } catch {}
      return result;
    });
  return [value, setValue];
}
