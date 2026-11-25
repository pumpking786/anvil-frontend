import { normalizeApiUrl } from './apiUrl';

export type LoginScope = 'workspace' | 'master';
const key = (scope: LoginScope) => `patra-signed-out:${scope}`;
export function restoreSuppressed(scope: LoginScope) {
  try {
    return localStorage.getItem(key(scope)) === 'true';
  } catch {
    return false;
  }
}
export function rememberSignedOut(scope: LoginScope, value: boolean) {
  try {
    if (value) localStorage.setItem(key(scope), 'true');
    else localStorage.removeItem(key(scope));
  } catch {
    /* Cookies still enforce server-side expiry and revocation. */
  }
}
export const isSessionRejected = (error: unknown) =>
  [401, 403, 423].includes((error as { status?: number })?.status || 0);

export async function persistentRequest(
  url: string,
  scope: LoginScope,
  accessToken?: string,
  remember?: boolean,
) {
  const response = await fetch(
    `${normalizeApiUrl(url)}/${scope === 'master' ? 'master' : 'auth'}/session${remember === undefined ? '/restore' : ''}`,
    {
      method: 'POST',
      credentials: 'include',
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(remember === undefined ? {} : { remember }),
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(result.error || 'Could not restore your sign-in. Please retry.'),
      { status: response.status },
    );
  return result;
}
