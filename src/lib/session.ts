import {
  persistentRequest,
  rememberSignedOut,
  restoreSuppressed,
  isSessionRejected,
} from './persistentSession';
import { TwoFactorRequired, TwoFactorSetupRequired } from './twoFactor';
import type { WorkspaceUser } from '../domain/types';
import { normalizeApiUrl } from './apiUrl';
import { largeRequest, transportFetch } from './transport';
export interface ServerSession {
  accessToken: string;
  expiresAt: number;
  persistentExpiresAt?: number;
  user: WorkspaceUser;
  mustSetupTwoFactor?: boolean;
  mustChangePassword?: boolean;
  twoFactorRequired?: boolean;
}
const sessions = new Map<string, ServerSession>();
let generation = 0;
const restoring = new Map<string, Promise<ServerSession | undefined>>();
export async function resumeServerSession(
  url: string,
  force = false,
): Promise<ServerSession | undefined> {
  url = normalizeApiUrl(url);
  if (!force) {
    const stored = getServerSession(url) || restoreServerSession(url);
    if (stored) return stored;
  }
  if (restoreSuppressed('workspace')) return undefined;
  const key = `${generation}:${url}`;
  if (restoring.has(key)) return restoring.get(key);
  const version = generation;
  const pending = (async () => {
    try {
      const value = (await persistentRequest(url, 'workspace')) as ServerSession;
      if (version !== generation || restoreSuppressed('workspace')) return undefined;
      return installServerSession(url, value);
    } catch (error) {
      if ((error as { status?: number }).status === 401) return undefined;
      throw error;
    } finally {
      restoring.delete(key);
    }
  })();
  restoring.set(key, pending);
  return pending;
}
export async function configurePersistentSignIn(url: string, remember: boolean) {
  const current = getServerSession(url);
  if (!current) throw new Error('Complete sign-in before saving this browser.');
  const version = generation;
  const result = await persistentRequest(url, 'workspace', current.accessToken, remember);
  if (version !== generation || getServerSession(url)?.accessToken !== current.accessToken)
    throw new Error('This sign-in has ended. Please sign in again.');
  rememberSignedOut('workspace', false);
  installServerSession(url, { ...current, persistentExpiresAt: result.persistentExpiresAt });
}
function scheduleSession(url: string, value: ServerSession) {
  clearTimeout(expiration);
  const saved = !!value.persistentExpiresAt;
  const until = Math.min(value.expiresAt, value.persistentExpiresAt || Infinity);
  const canRenew = saved && value.persistentExpiresAt! > value.expiresAt;
  expiration = setTimeout(
    async () => {
      if (sessions.get(url)?.accessToken !== value.accessToken) return;
      if (!saved || value.persistentExpiresAt! <= Date.now()) {
        window.dispatchEvent(new Event('patra-session-expired'));
        return;
      }
      try {
        const next = await resumeServerSession(url, true);
        if (!next && sessions.get(url)?.accessToken === value.accessToken)
          window.dispatchEvent(new Event('patra-session-expired'));
      } catch (error) {
        if (sessions.get(url)?.accessToken !== value.accessToken) return;
        if (isSessionRejected(error)) window.dispatchEvent(new Event('patra-session-expired'));
        else expiration = setTimeout(() => scheduleSession(url, value), 15000);
      }
    },
    Math.max(1000, until - Date.now() - (canRenew ? 60000 : 0)),
  );
}
const PERSISTED_SESSION_KEY = 'patra-server-session';
const ACTIVE_SESSION_KEY = 'patra-workspace-session';
let expiration: ReturnType<typeof setTimeout> | undefined;
export function getServerSession(url: string) {
  try {
    const value = sessions.get(normalizeApiUrl(url));
    return value && value.expiresAt > Date.now() ? value : undefined;
  } catch {
    return undefined;
  }
}
export function rememberServer(url: string, mode: 'local' | 'remote') {
  localStorage.setItem('patra-server', JSON.stringify({ url: normalizeApiUrl(url), mode }));
}
export function savedServer(): { url: string; mode: 'local' | 'remote' } | null {
  try {
    const value = JSON.parse(localStorage.getItem('patra-server') || 'null');
    return value?.url
      ? { url: normalizeApiUrl(value.url), mode: value.mode === 'remote' ? 'remote' : 'local' }
      : null;
  } catch {
    return null;
  }
}
export function installServerSession(url: string, value: ServerSession) {
  const normalizedUrl = normalizeApiUrl(url);
  sessions.set(normalizedUrl, value);
  try {
    sessionStorage.setItem(PERSISTED_SESSION_KEY, JSON.stringify({ url: normalizedUrl, value }));
  } catch {
    // The active page session remains usable when browser session storage is disabled.
  }
  scheduleSession(normalizedUrl, value);
  return value;
}
export function restoreServerSession(url: string) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PERSISTED_SESSION_KEY) || 'null');
    if (saved?.url !== normalizeApiUrl(url) || !saved.value?.accessToken) return undefined;
    if (saved.value.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PERSISTED_SESSION_KEY);
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      return undefined;
    }
    return installServerSession(url, saved.value as ServerSession);
  } catch {
    return undefined;
  }
}
export async function authRequest(url: string, path: string, data?: unknown) {
  const response = await fetch(`${normalizeApiUrl(url)}/auth${path}`, {
    method: data === undefined ? 'GET' : 'POST',
    credentials: 'include',
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Could not authenticate with the server.');
  return result;
}
export async function signInServer(url: string, email: string, password: string) {
  generation++;
  const result = await authRequest(url, '/login', { email, password });
  if (result.requiresTwoFactor) throw new TwoFactorRequired(result);
  const session = installServerSession(url, result);
  if (session.mustSetupTwoFactor && !session.mustChangePassword) throw new TwoFactorSetupRequired();
  return session;
}
export async function verifyServerTwoFactor(
  url: string,
  challengeToken: string,
  code: string,
  recovery = false,
  rememberDevice = false,
) {
  return installServerSession(
    url,
    await authRequest(url, '/2fa/verify', { challengeToken, code, recovery, rememberDevice }),
  );
}
export async function setupServer(
  url: string,
  email: string,
  password: string,
  setupToken: string,
  user: WorkspaceUser,
) {
  const session = installServerSession(
    url,
    (await authRequest(url, '/setup', {
      email,
      password,
      setupToken,
      id: user.id,
      name: user.name,
    })) as ServerSession,
  );
  if (session.mustSetupTwoFactor && !session.mustChangePassword) throw new TwoFactorSetupRequired();
  return session;
}
export async function authenticatedFetch(url: string, path: string, init: RequestInit = {}) {
  let session = getServerSession(url);
  if (!session) session = await resumeServerSession(url, true);
  if (!session) throw new Error('Sign in with your server account from the workspace login page.');
  let response: Response;
  try {
    response = await transportFetch(normalizeApiUrl(url), path, {
      ...init,
      credentials: 'include',
      redirect: 'error',
      signal:
        init.signal ||
        AbortSignal.timeout(
          largeRequest(init.body) || path === '/workspace' || path === '/users' ? 180000 : 60000,
        ),
      headers: { ...init.headers, Authorization: `Bearer ${session.accessToken}` },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new Error(
      'The server connection was interrupted. Check your connection, then reload the record to confirm whether the change was saved before trying again.',
    );
  }
  // A response from an earlier session must not sign out a newly authenticated user.
  if (response.status === 401 && getServerSession(url)?.accessToken === session.accessToken)
    window.dispatchEvent(new Event('patra-session-expired'));
  return response;
}
export async function changeServerPassword(url: string, currentPassword: string, password: string) {
  const response = await authenticatedFetch(url, '/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not update your password.');
  return installServerSession(url, result);
}
export function signOutServer() {
  generation++;
  rememberSignedOut('workspace', true);
  clearTimeout(expiration);
  for (const [url, session] of sessions) {
    void fetch(`${url}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: '{}',
      credentials: 'include',
      redirect: 'error',
      keepalive: true,
      signal: AbortSignal.timeout(5000),
    }).catch(() => {});
  }
  sessions.clear();
  try {
    sessionStorage.removeItem(PERSISTED_SESSION_KEY);
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* Session storage may be disabled. */
  }
}
